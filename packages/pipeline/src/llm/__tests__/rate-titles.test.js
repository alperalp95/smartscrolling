import assert from 'node:assert/strict';
// V2-05e: Groq dakikalık sınırları (TPM / OTPM), "Request too large", kapanan model (410).
// Sahte saat + sahte fetch + sahte sleep (sleep saati ilerletir). Gerçek ağ çağrısı yok.
import { test } from 'node:test';
import { LlmRequestTooLargeError, createLlm, createMemoryUsageStore } from '../index.js';
import { classifyHttpFailure, parseRateLimitInfo } from '../providers/openai-compatible.js';
import { MAX_WAIT_MS, createRateLimiter } from '../rate.js';
import { TEST_ENV, chatOk, fakeFetch, isCloudflare, isGroq, json, realConfig } from './helpers.js';

const MESSAGES = [{ role: 'user', content: 'puanla' }];
const T0 = Date.parse('2026-11-21T10:00:00Z');

const OTPM_429 =
  'Rate limit reached for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Used 900, Requested 400. Please try again in 6.5s.';
const TOO_LARGE =
  'Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1500, please reduce your message size and try again.';
const DEPRECATED_410 =
  'AiError: Model has been deprecated: @cf/mistralai/mistral-small-3.1-24b-instruct was deprecated on 2026-11-20. See the model catalog for alternatives.';

/** Sahte saat: sleep(ms) saati ilerletir; fetch istenirse her çağrıda saati ilerletir. */
function clockSetup(handler, { fetchMs = 0, config = realConfig() } = {}) {
  const clock = { t: T0 };
  const waits = [];
  const sleep = async (ms) => {
    waits.push(ms);
    clock.t += ms;
  };
  const fetch = fakeFetch(async (call, i) => {
    const res = await handler(call, i);
    clock.t += fetchMs;
    return res;
  });
  const llm = createLlm(config, {
    env: TEST_ENV,
    fetch,
    sleep,
    now: () => clock.t,
    usageStore: createMemoryUsageStore(),
  });
  return { llm, fetch, waits, clock };
}

test('429 / "Request too large" / 410 sınıflandırması: Limit N ve "try again in Xs" okunur', () => {
  assert.deepEqual(parseRateLimitInfo(OTPM_429), {
    metric: 'OTPM',
    limit: 1000,
    used: 900,
    requested: 400,
  });
  assert.deepEqual(parseRateLimitInfo('on tokens per minute (TPM): Limit 8000, Requested 9100'), {
    metric: 'TPM',
    limit: 8000,
    requested: 9100,
  });
  assert.equal(parseRateLimitInfo('başka hata'), undefined);

  const r = classifyHttpFailure(429, JSON.stringify({ error: { message: OTPM_429 } }));
  assert.equal(r.kind, 'retryable');
  assert.equal(r.retryAfterMs, 6500);
  assert.deepEqual(r.rateLimit, { metric: 'OTPM', limit: 1000, used: 900, requested: 400 });

  const big = classifyHttpFailure(429, JSON.stringify({ error: { message: TOO_LARGE } }));
  assert.equal(big.kind, 'too_large');
  assert.deepEqual(big.rateLimit, { metric: 'OTPM', limit: 1000, requested: 1500 });
  assert.equal(classifyHttpFailure(413, 'payload too large').kind, 'too_large');

  const gone = classifyHttpFailure(410, JSON.stringify({ errors: [{ message: DEPRECATED_410 }] }));
  assert.equal(gone.kind, 'unavailable');
  // Durum kodu farklı olsa bile "deprecated" metni model_unavailable sayılır.
  assert.equal(classifyHttpFailure(400, DEPRECATED_410).kind, 'unavailable');
  // Model dışı "deprecated" uyarısı model kapanması değildir.
  assert.equal(
    classifyHttpFailure(400, 'parameter `functions` is deprecated, use tools').kind,
    'fatal',
  );
});

test('OTPM penceresi: son 60 sn çıktısı + yeni istek > 1000 ise pencere açılana kadar beklenir', async () => {
  // Her Groq yanıtı 400 çıktı token; fetch 10 sn sürer.
  const { llm, waits, fetch } = clockSetup(
    () => chatOk('{"items":[]}', { prompt: 300, completion: 400 }),
    { fetchMs: 10_000 },
  );

  await llm.chat('scorer', { messages: MESSAGES, json: true }); // t=0 → kayıt t=10 sn (400)
  await llm.chat('scorer', { messages: MESSAGES, json: true }); // pencere 400 + 400 = 800 ≤ 1000 → beklemez; kayıt t=20 sn
  assert.deepEqual(waits, []);
  await llm.chat('scorer', { messages: MESSAGES, json: true }); // 800 + 400 > 1000 → ilk kayıt (t=10) düşene kadar: 70 - 20 = 50 sn
  assert.deepEqual(waits, [50_000]);
  assert.ok(fetch.calls.every(isGroq), 'yedeğe geçilmedi, sadece beklendi');

  const ev = llm.events.find((e) => e.type === 'rate_wait');
  assert.equal(ev.provider, 'groq');
  assert.equal(ev.model, 'qwen/qwen3.8-27b');
  assert.equal(ev.delayMs, 50_000);
  assert.equal(ev.windowOutputTokens, 800);
  assert.equal(ev.needOutput, 400, 'roles.scorer.expectedOutputTokens');
  assert.equal(ev.outputTokensPerMinute, 1000);
});

test('TPM penceresi (girdi + çıktı) da sayılır; Cloudflare gibi sınırı tanımsız sağlayıcıda bekleme yok', async () => {
  const config = realConfig();
  config.providers.groq.perMinuteLimits['qwen/qwen3.8-27b'] = {
    tokensPerMinute: 3000,
    outputTokensPerMinute: null,
  };
  const { llm, waits } = clockSetup(() => chatOk('{"a":1}', { prompt: 2600, completion: 100 }), {
    config,
    fetchMs: 1000,
  });
  await llm.chat('scorer', { messages: MESSAGES, json: true }); // 2700 token, kayıt t=1 sn
  await llm.chat('scorer', { messages: MESSAGES, json: true }); // 2700 + (girdi ~2 + 400) > 3000 → 61 - 1 = 60 sn
  assert.deepEqual(waits, [60_000]);

  const cf = clockSetup(() => chatOk('{"claims":[]}', { prompt: 5000, completion: 5000 }));
  for (let i = 0; i < 5; i += 1) await cf.llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.deepEqual(cf.waits, []);
});

test('rate limiter: bekleme en fazla 60 sn; boş pencerede tek başına sığmayan istek beklemez', async () => {
  const clock = { t: T0 };
  const waits = [];
  const limiter = createRateLimiter({
    providers: {
      groq: { perMinuteLimits: { default: { tokensPerMinute: 1000, outputTokensPerMinute: 500 } } },
    },
    now: () => clock.t,
    sleep: async (ms) => {
      waits.push(ms);
      clock.t += ms;
    },
  });
  assert.equal(
    await limiter.acquire('groq', 'm', { input: 5000, output: 100 }),
    0,
    'boş pencere: sağlayıcı karar versin',
  );
  limiter.record('groq', 'm', { input: 100, output: 450 });
  clock.t += 5_000;
  const w = await limiter.acquire('groq', 'm', { input: 10, output: 100 });
  assert.equal(w, 55_000);
  assert.ok(w <= MAX_WAIT_MS);
  assert.deepEqual(limiter.windowUsage('groq', 'm'), { total: 0, output: 0 }, 'pencere boşaldı');
});

test('429 "try again in 6.5s" ipucuna uyulur ve mesajdaki "Limit N" o modelin sınırı olarak öğrenilir', async () => {
  const limited = OTPM_429.replace('Limit 1000', 'Limit 800');
  const { llm, waits } = clockSetup((call, i) =>
    i === 0 ? json(429, { error: { message: limited } }) : chatOk('{"a":1}'),
  );
  const res = await llm.chat('scorer', { messages: MESSAGES, json: true });
  assert.equal(res.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(waits, [6500]);
  const learned = llm.events.find((e) => e.type === 'rate_limit_learned');
  assert.deepEqual(
    { metric: learned.metric, limit: learned.limit, previous: learned.previous },
    { metric: 'OTPM', limit: 800, previous: 1000 },
  );
  assert.equal(llm.rate.limitsFor('groq', 'qwen/qwen3.8-27b').outputTokensPerMinute, 800);
});

test('"Request too large" + splittable → LlmRequestTooLargeError (yedeğe geçmez, tekrar denemez); splittable değilse yedek model', async () => {
  const big = () => json(429, { error: { message: TOO_LARGE } });
  const a = clockSetup((call) =>
    isGroq(call) && call.body.model === 'qwen/qwen3.8-27b' ? big() : chatOk('{"items":[]}'),
  );
  const err = await a.llm
    .chat('scorer', { messages: MESSAGES, json: true, splittable: true })
    .catch((e) => e);
  assert.ok(err instanceof LlmRequestTooLargeError, err?.name);
  assert.equal(err.provider, 'groq');
  assert.equal(err.model, 'qwen/qwen3.8-27b');
  assert.equal(err.metric, 'OTPM');
  assert.equal(err.limit, 1000);
  assert.equal(a.fetch.calls.length, 1, 'aynı istek tekrar gönderilmez, yedek denenmez');
  assert.deepEqual(a.waits, []);
  assert.ok(a.llm.events.some((e) => e.type === 'request_too_large' && e.limit === 1000));

  const b = clockSetup((call) =>
    isGroq(call) && call.body.model === 'qwen/qwen3.8-27b' ? big() : chatOk('{"items":[]}'),
  );
  const res = await b.llm.chat('scorer', { messages: MESSAGES, json: true });
  assert.equal(res.model, 'openai/gpt-oss-20b');
  assert.equal(
    b.fetch.calls[1].body.max_completion_tokens,
    1000,
    'düşünen yedek kendi maxTokens değeriyle',
  );
  assert.equal(
    b.fetch.calls[0].body.max_completion_tokens,
    600,
    'puanlayıcı maxTokens OTPM altında',
  );
});

test('410 deprecated → model_unavailable + zincirde sıradaki yedek; aynı run’da kapanan model bir daha denenmez', async () => {
  const { llm, fetch } = clockSetup((call) =>
    isCloudflare(call) && call.body.model === '@cf/mistralai/mistral-small-3.1-24b-instruct'
      ? json(410, { errors: [{ message: DEPRECATED_410 }] })
      : chatOk('{"claims":[{"claim":"a","verdict":"supported"}]}'),
  );
  const r1 = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(r1.model, '@cf/google/gemma-4-26b-a4b-it');
  const r2 = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(r2.model, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(
    fetch.calls.filter((c) => c.body.model === '@cf/mistralai/mistral-small-3.1-24b-instruct')
      .length,
    1,
  );
  const ev = llm.events.filter((e) => e.type === 'model_unavailable');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].status, 410);
  assert.match(ev[0].error, /deprecated/);
  assert.ok(
    !llm.events.some((e) => e.type === 'provider_failed'),
    'fatal değil, model_unavailable',
  );
});

test('config: perMinuteLimits / expectedOutputTokens / zincir üyesi maxTokens doğrulanır', async () => {
  const { validateConfig, LlmConfigError } = await import('../index.js');
  const { readFileSync } = await import('node:fs');
  const { DEFAULT_CONFIG_PATH } = await import('../config.js');
  const raw = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  const bad = [
    [
      (c) => {
        c.providers.groq.perMinuteLimits['qwen/qwen3.8-27b'].outputTokensPerMinute = -5;
      },
      /perMinuteLimits\.qwen\/qwen3\.8-27b\.outputTokensPerMinute/,
    ],
    [
      (c) => {
        c.providers.groq.perMinuteLimits.default.tokensPerMin = 1;
      },
      /bilinmeyen alan/,
    ],
    [
      (c) => {
        c.roles.scorer.expectedOutputTokens = 0;
      },
      /roles\.scorer\.expectedOutputTokens/,
    ],
    [
      (c) => {
        c.roles.scorer.chain[1].maxTokens = 'çok';
      },
      /roles\.scorer\.chain\[1\]\.maxTokens/,
    ],
  ];
  for (const [mutate, pattern] of bad) {
    const c = raw();
    mutate(c);
    assert.throws(
      () => validateConfig(c),
      (err) => err instanceof LlmConfigError && pattern.test(err.message),
    );
  }
  const ok = raw();
  ok.providers.groq.perMinuteLimits['openai/gpt-oss-120b'].outputTokensPerMinute = null;
  assert.doesNotThrow(() => validateConfig(ok));
});
