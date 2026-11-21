import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLlm, createMemoryUsageStore, LlmExhaustedError } from '../index.js';
import {
  FIXED_NOW,
  TEST_ENV,
  chatOk,
  fakeFetch,
  fakeSleep,
  isCloudflare,
  isGemini,
  isGroq,
  json,
  rateLimited,
  realConfig,
} from './helpers.js';

const MESSAGES = [{ role: 'user', content: 'merhaba' }];

function setup(handler, { env = TEST_ENV, usageStore } = {}) {
  const fetch = fakeFetch(handler);
  const sleep = fakeSleep();
  const llm = createLlm(realConfig(), {
    env,
    fetch,
    sleep,
    now: () => FIXED_NOW,
    usageStore: usageStore ?? createMemoryUsageStore(),
  });
  return { llm, fetch, sleep };
}

test('birincil başarılı -> doğru provider/model/usage döner', async () => {
  const { llm, fetch, sleep } = setup(() => chatOk('{"score": 7}', { prompt: 120, completion: 30 }));

  const res = await llm.chat('scorer', { messages: MESSAGES, json: true, maxTokens: 500 });

  assert.equal(res.provider, 'groq');
  assert.equal(res.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(res.json, { score: 7 });
  assert.deepEqual(res.usage, { inputTokens: 120, outputTokens: 30 });
  assert.equal(fetch.calls.length, 1);
  const call = fetch.calls[0];
  assert.equal(call.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(call.headers.authorization, `Bearer ${TEST_ENV.GROQ_API_KEY}`);
  assert.equal(call.body.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(call.body.response_format, { type: 'json_object' });
  assert.equal(call.body.max_completion_tokens, 500);
  assert.deepEqual(sleep.waits, []);
  assert.deepEqual(llm.events, []);

  const snap = await llm.usage.snapshot();
  assert.equal(snap.date, '2026-11-20');
  assert.deepEqual(
    { r: snap.providers.groq.models['qwen/qwen3.8-27b'].requests, t: snap.providers.groq.models['qwen/qwen3.8-27b'].tokens },
    { r: 1, t: 150 },
  );
});

test('429 iki kez sonra başarı -> üstel bekleme uygulandı, aynı sağlayıcı', async () => {
  const { llm, fetch, sleep } = setup((call, i) => (i < 2 ? rateLimited() : chatOk('tamam')));

  const res = await llm.chat('scorer', { messages: MESSAGES });

  assert.equal(res.provider, 'groq');
  assert.equal(res.model, 'qwen/qwen3.8-27b');
  assert.equal(res.text, 'tamam');
  assert.equal(fetch.calls.length, 3);
  assert.ok(fetch.calls.every(isGroq));
  assert.deepEqual(sleep.waits, [2000, 4000]);
  assert.equal(llm.events.filter((e) => e.type === 'retry').length, 2);
});

test('429 retry-after başlığına uyar (maxDelayMs ile sınırlı)', async () => {
  const { llm, sleep } = setup((call, i) => {
    if (i === 0) return rateLimited({ 'retry-after': '7' });
    if (i === 1) return rateLimited({ 'retry-after': '120' });
    return chatOk('ok');
  });
  await llm.chat('scorer', { messages: MESSAGES });
  assert.deepEqual(sleep.waits, [7000, 30000]);
});

test('5xx ve timeout da tekrar denenir', async () => {
  const { llm, fetch, sleep } = setup((call, i) => {
    if (i === 0) return json(503, { error: { message: 'unavailable' } });
    if (i === 1) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    return chatOk('ok');
  });
  const res = await llm.chat('scorer', { messages: MESSAGES });
  assert.equal(res.provider, 'groq');
  assert.equal(fetch.calls.length, 3);
  assert.deepEqual(sleep.waits, [2000, 4000]);
});

test('istek zaman aşımı (requestTimeoutMs) iptal eder ve tekrar dener', async () => {
  const config = realConfig();
  config.retry.requestTimeoutMs = 20;
  const fetch = fakeFetch((call, i) => {
    if (i > 0) return chatOk('ok');
    return new Promise((resolve, reject) => {
      call.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  });
  const sleep = fakeSleep();
  const llm = createLlm(config, { env: TEST_ENV, fetch, sleep, now: () => FIXED_NOW });
  const res = await llm.chat('scorer', { messages: MESSAGES });
  assert.equal(res.text, 'ok');
  assert.deepEqual(sleep.waits, [2000]);
  assert.match(llm.events[0].error, /zaman aşımı \(20 ms\)/);
});

test('429 maxAttempts kadar -> yedeğe geçer (iki Groq puanlayıcı da dolu → Cloudflare Mistral)', async () => {
  const { llm, fetch, sleep } = setup((call) => (isGroq(call) ? rateLimited() : chatOk('yedekten', { prompt: 1000, completion: 1000 })));

  const res = await llm.chat('scorer', { messages: MESSAGES });

  assert.equal(res.provider, 'cloudflare');
  assert.equal(res.model, '@cf/mistralai/mistral-small-3.1-24b-instruct');
  assert.equal(fetch.calls.filter(isGroq).length, 6, 'qwen 3 + gpt-oss-20b 3 deneme');
  assert.equal(fetch.calls.filter(isCloudflare).length, 1);
  assert.equal(fetch.calls[6].url, 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1/chat/completions');
  assert.equal(fetch.calls[6].headers.authorization, `Bearer ${TEST_ENV.CLOUDFLARE_API_TOKEN}`);
  assert.deepEqual(sleep.waits, [2000, 4000, 2000, 4000]);
  // Neuron tahmini: 1000*31876/1e6 + 1000*50488/1e6 = 82.364
  assert.equal(res.usage.neurons, 82.364);
  assert.ok(llm.events.some((e) => e.type === 'provider_failed' && e.provider === 'groq'));
});

test('404 decommissioned -> anında yedeğe geçer + model_unavailable olayı; aynı run’da tekrar denenmez', async () => {
  const isQwen = (call) => isGroq(call) && call.body.model === 'qwen/qwen3.8-27b';
  const { llm, fetch, sleep } = setup((call) =>
    isQwen(call)
      ? json(404, { error: { message: 'The model `qwen/qwen3.8-27b` has been decommissioned', code: 'model_decommissioned' } })
      : chatOk('yedek'),
  );

  const res = await llm.chat('scorer', { messages: MESSAGES });

  assert.equal(res.provider, 'groq');
  assert.equal(res.model, 'openai/gpt-oss-20b');
  assert.equal(fetch.calls.filter(isQwen).length, 1);
  assert.deepEqual(sleep.waits, []);
  // İkinci çağrıda kapanan model hiç denenmez (tek model_unavailable olayı).
  const res2 = await llm.chat('scorer', { messages: MESSAGES });
  assert.equal(res2.model, 'openai/gpt-oss-20b');
  assert.equal(fetch.calls.filter(isQwen).length, 1);
  assert.equal(llm.events.filter((e) => e.type === 'model_unavailable').length, 1);
  const ev = llm.events.find((e) => e.type === 'model_unavailable');
  assert.ok(ev);
  assert.equal(ev.provider, 'groq');
  assert.equal(ev.model, 'qwen/qwen3.8-27b');
});

test('400 + model_decommissioned kodu da model_unavailable sayılır', async () => {
  const { llm, fetch } = setup((call) =>
    isGroq(call)
      ? json(400, { error: { message: 'model decommissioned', type: 'invalid_request_error', code: 'model_decommissioned' } })
      : chatOk('yedek'),
  );
  const res = await llm.chat('scorer', { messages: MESSAGES });
  assert.equal(res.provider, 'cloudflare');
  assert.equal(fetch.calls.filter(isGroq).length, 2, 'iki Groq üyesi birer kez');
  assert.ok(llm.events.some((e) => e.type === 'model_unavailable' && e.provider === 'groq'));
});

test('bütçe %90 -> sağlayıcı atlanır (model başına istek sınırı)', async () => {
  const usageStore = createMemoryUsageStore({
    '2026-11-20': {
      date: '2026-11-20',
      providers: {
        groq: {
          requests: 900, tokens: 0, neurons: 0, exhausted: false,
          models: { 'qwen/qwen3.8-27b': { requests: 900, inputTokens: 0, outputTokens: 0, tokens: 0, neurons: 0, exhausted: false } },
        },
      },
    },
  });
  const { llm, fetch } = setup(() => chatOk('cf'), { usageStore });

  const res = await llm.chat('scorer', { messages: MESSAGES });

  // Sınır model başına: qwen atlanır, Groq'taki ikinci puanlayıcı (gpt-oss-20b) kullanılır.
  assert.equal(res.provider, 'groq');
  assert.equal(res.model, 'openai/gpt-oss-20b');
  assert.equal(fetch.calls.filter((c) => c.body.model === 'qwen/qwen3.8-27b').length, 0);
  const ev = llm.events.find((e) => e.type === 'budget_skip');
  assert.equal(ev.provider, 'groq');
  assert.equal(ev.metric, 'requests');
  assert.equal(ev.threshold, 900);
});

test('bütçe %90 -> Cloudflare Neuron (sağlayıcı geneli) dolunca doğrulayıcı Gemini’ye geçer', async () => {
  const usageStore = createMemoryUsageStore({
    '2026-11-20': {
      date: '2026-11-20',
      providers: { cloudflare: { requests: 50, tokens: 0, neurons: 9000.5, exhausted: false, models: {} } },
    },
  });
  const { llm, fetch } = setup(() => chatOk('gemini cevabı'), { usageStore });

  const res = await llm.chat('verifier', { messages: MESSAGES });

  assert.equal(res.provider, 'gemini');
  assert.equal(res.model, 'gemini-3.1-flash-lite');
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.ok(isGemini(fetch.calls[0]));
  assert.equal(res.usage.neurons, undefined);
});

test('bütçe sayacı kullanım biriktikçe sağlayıcıyı kapatır', async () => {
  const config = realConfig();
  config.providers.groq.dailyLimits.perModel = { requests: 2, tokens: null };
  config.providers.groq.stopAtPercent = 100;
  const fetch = fakeFetch(() => chatOk('x'));
  const llm = createLlm(config, { env: TEST_ENV, fetch, sleep: fakeSleep(), now: () => FIXED_NOW });

  const models = [];
  for (let i = 0; i < 5; i += 1) models.push((await llm.chat('scorer', { messages: MESSAGES })).model);
  assert.deepEqual(models, [
    'qwen/qwen3.8-27b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-20b',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
  ]);
});

test('gün değişince sayaç sıfırlanır (UTC)', async () => {
  const config = realConfig();
  config.providers.groq.dailyLimits.perModel = { requests: 1 };
  config.providers.groq.stopAtPercent = 100;
  let nowValue = Date.parse('2026-11-20T23:59:00Z');
  const fetch = fakeFetch(() => chatOk('x'));
  const llm = createLlm(config, { env: TEST_ENV, fetch, sleep: fakeSleep(), now: () => nowValue });

  assert.equal((await llm.chat('scorer', { messages: MESSAGES })).model, 'qwen/qwen3.8-27b');
  assert.equal((await llm.chat('scorer', { messages: MESSAGES })).model, 'openai/gpt-oss-20b');
  assert.equal((await llm.chat('scorer', { messages: MESSAGES })).provider, 'cloudflare');
  nowValue = Date.parse('2026-11-21T00:01:00Z');
  assert.equal((await llm.chat('scorer', { messages: MESSAGES })).model, 'qwen/qwen3.8-27b');
});

test('tüm zincir dolu -> LlmExhaustedError', async () => {
  const { llm, fetch } = setup(() => rateLimited());

  await assert.rejects(
    () => llm.chat('scorer', { messages: MESSAGES }),
    (err) => {
      assert.ok(err instanceof LlmExhaustedError);
      assert.equal(err.role, 'scorer');
      assert.deepEqual(
        err.attempts.map((a) => `${a.provider}/${a.model}`),
        [
          'groq/qwen/qwen3.8-27b',
          'groq/openai/gpt-oss-20b',
          'cloudflare/@cf/mistralai/mistral-small-3.1-24b-instruct',
          'cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct',
        ],
      );
      assert.ok(err.events.length > 0);
      return true;
    },
  );
  assert.equal(fetch.calls.length, 12);
});

test('günlük kota (TPD) 429 -> tekrar denenmez, model bugün için kapanır', async () => {
  const { llm, fetch, sleep } = setup((call) =>
    isGroq(call) ? rateLimited({}, 'Rate limit reached ... on tokens per day (TPD): Limit 200000') : chatOk('cf'),
  );
  assert.equal((await llm.chat('scorer', { messages: MESSAGES })).provider, 'cloudflare');
  assert.equal(fetch.calls.filter(isGroq).length, 2, 'iki Groq üyesi birer kez');
  assert.deepEqual(sleep.waits, []);
  assert.ok(llm.events.some((e) => e.type === 'quota_exhausted' && e.scope === 'model'));

  // İkinci çağrıda Groq hiç denenmez
  await llm.chat('scorer', { messages: MESSAGES });
  assert.equal(fetch.calls.filter(isGroq).length, 2);
});

test('anahtar env’de yoksa sağlayıcı atlanır; anahtar değeri hiçbir yere yazılmaz', async () => {
  const env = { ...TEST_ENV, GROQ_API_KEY: undefined };
  const { llm, fetch } = setup(() => rateLimited(), { env });

  const err = await llm.chat('scorer', { messages: MESSAGES }).catch((e) => e);
  assert.ok(err instanceof LlmExhaustedError);
  assert.equal(fetch.calls.filter(isGroq).length, 0);
  const missing = llm.events.find((e) => e.type === 'missing_credentials');
  assert.deepEqual(missing.env, ['GROQ_API_KEY']);

  const dump = JSON.stringify(llm.events) + err.message + JSON.stringify(err.attempts) + JSON.stringify(await llm.usage.snapshot());
  for (const v of Object.values(TEST_ENV)) {
    if (v.includes('SECRET')) assert.ok(!dump.includes(v), 'anahtar değeri sızdı');
  }
});

test('writer round_robin iki Groq modeli arasında dağıtır', async () => {
  const { llm, fetch } = setup(() => chatOk('kart'));

  const models = [];
  for (let i = 0; i < 4; i += 1) models.push((await llm.chat('writer', { messages: MESSAGES })).model);

  assert.deepEqual(models, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  assert.ok(fetch.calls.every((c) => c.body.reasoning_effort === 'low'));
});

test('writer havuzunda bir model doluysa diğer havuz üyesine, ikisi de doluysa Cloudflare’e geçer', async () => {
  const { llm } = setup((call) => {
    if (isGroq(call) && call.body.model === 'openai/gpt-oss-120b') {
      return rateLimited({}, 'Rate limit reached on tokens per day (TPD)');
    }
    return chatOk('kart');
  });
  const first = await llm.chat('writer', { messages: MESSAGES });
  assert.equal(first.model, 'openai/gpt-oss-20b');
  const second = await llm.chat('writer', { messages: MESSAGES });
  assert.equal(second.model, 'openai/gpt-oss-20b');

  const { llm: llm2 } = setup((call) => (isGroq(call) ? rateLimited({}, 'tokens per day (TPD)') : chatOk('kart')));
  const res = await llm2.chat('writer', { messages: MESSAGES });
  assert.equal(res.provider, 'cloudflare');
  assert.equal(res.model, '@cf/openai/gpt-oss-20b');
});

test('judge, scorer zincirini kullanır', async () => {
  const { llm } = setup(() => chatOk('aynı olgu değil'));
  const res = await llm.chat('judge', { messages: MESSAGES });
  assert.equal(res.provider, 'groq');
  assert.equal(res.model, 'qwen/qwen3.8-27b');
});
