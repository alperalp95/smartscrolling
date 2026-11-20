// V2-05c: ilk gerçek dry-run bulguları — zincir yedeğe geçişi, hata nedeni, <think> ayıklama,
// kesik yanıt (finish_reason=length), rol başına maxTokens. Sahte fetch; gerçek ağ yok.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLlm, createMemoryUsageStore, LlmExhaustedError, LlmOutputError, stripThinking } from '../index.js';
import { parseRetryHintMs } from '../providers/openai-compatible.js';
import { FIXED_NOW, TEST_ENV, chatOk, fakeFetch, fakeSleep, isCloudflare, isGemini, isGroq, json, realConfig } from './helpers.js';

const MESSAGES = [{ role: 'user', content: 'puanla' }];
const SECRETS = [TEST_ENV.GROQ_API_KEY, TEST_ENV.CLOUDFLARE_API_TOKEN, TEST_ENV.GEMINI_API_KEY, TEST_ENV.CLOUDFLARE_ACCOUNT_ID];

function setup(handler, { usageStore = createMemoryUsageStore() } = {}) {
  const fetch = fakeFetch(handler);
  const sleep = fakeSleep();
  const llm = createLlm(realConfig(), { env: TEST_ENV, fetch, sleep, now: () => FIXED_NOW, usageStore });
  return { llm, fetch, sleep, usageStore };
}

function chatWith(content, finishReason, { prompt = 100, completion = 50 } = {}) {
  return json(200, {
    choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage: { prompt_tokens: prompt, completion_tokens: completion },
  });
}

test('stripThinking: kapalı, kapanmamış ve açılışsız </think> blokları ayıklanır', () => {
  assert.equal(stripThinking('<think>uzun düşünce</think>\n{"a":1}'), '{"a":1}');
  assert.equal(stripThinking('düşünce şablonda açıldı </think>{"a":1}'), '{"a":1}');
  assert.equal(stripThinking('{"a":1}<think>yarım kalan düşünce...'), '{"a":1}');
  assert.equal(stripThinking('<think>sadece düşünce, kesildi'), '');
  assert.equal(stripThinking('<think></think>tamam'), 'tamam');
});

test('puanlayıcı: Groq geçersiz JSON (tamir de bozuk) → Cloudflare yedeği GERÇEKTEN denenir, neden olaya/usage dosyasına yazılır', async () => {
  const { llm, fetch } = setup((call) => {
    if (isGroq(call)) return chatOk('<think>önce düşüneyim</think>{"items": [ {"id":1, "surp');
    return chatOk('<think></think>{"items":[{"id":1,"surprise":7}]}');
  });

  const res = await llm.chat('scorer', { messages: MESSAGES, json: true });

  assert.equal(res.provider, 'cloudflare');
  assert.equal(res.model, '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.deepEqual(res.json, { items: [{ id: 1, surprise: 7 }] });
  assert.equal(fetch.calls.filter(isGroq).length, 2, 'ilk istek + bir tamir');
  assert.equal(fetch.calls.filter(isCloudflare).length, 1);
  const failed = llm.events.find((e) => e.type === 'provider_failed');
  assert.equal(failed.kind, 'invalid_json');
  assert.match(failed.error, /tamir sonrası da geçersiz JSON/);

  const snap = await llm.usage.snapshot();
  const groq = snap.providers.groq.models['qwen/qwen3.8-27b'];
  assert.equal(groq.failures, 1);
  assert.equal(groq.lastError.kind, 'invalid_json');
  assert.equal(snap.providers.cloudflare.models['@cf/qwen/qwen3-30b-a3b-fp8'].requests, 1);
});

test('tüm zincir sadece JSON hatası verirse LlmOutputError (tükenme DEĞİL); nedenler mesajda', async () => {
  const { llm } = setup(() => chatOk('JSON değil, düz metin'));
  const err = await llm.chat('scorer', { messages: MESSAGES, json: true }).catch((e) => e);
  assert.ok(err instanceof LlmOutputError, err?.name);
  assert.ok(!(err instanceof LlmExhaustedError));
  assert.equal(err.name, 'LlmOutputError');
  assert.equal(err.attempts.length, 2);
  assert.ok(err.attempts.every((a) => a.kind === 'invalid_json'));
  assert.match(err.message, /groq\/qwen\/qwen3\.8-27b: invalid_json/);
  assert.match(err.message, /cloudflare\/@cf\/qwen\/qwen3-30b-a3b-fp8: invalid_json/);
});

test('kapasite hatası + JSON hatası karışık → yine LlmOutputError; sadece kapasite → LlmExhaustedError', async () => {
  const mixed = setup((call) => (isGroq(call) ? json(400, { error: { message: 'bad request' } }) : chatOk('bozuk {')));
  const e1 = await mixed.llm.chat('scorer', { messages: MESSAGES, json: true }).catch((e) => e);
  assert.equal(e1.name, 'LlmOutputError');

  const capacity = setup(() => json(503, { error: { message: 'overloaded' } }));
  const e2 = await capacity.llm.chat('scorer', { messages: MESSAGES, json: true }).catch((e) => e);
  assert.equal(e2.name, 'LlmExhaustedError');
  assert.match(e2.message, /retryable \(503\): HTTP 503/);
});

test('hata nedeni log/olay/hata mesajına anahtar değeri olmadan yazılır', async () => {
  // Sağlayıcı gövdede anahtarı geri yansıtsa bile temizlenir.
  const { llm } = setup((call) =>
    json(401, { error: { message: `Invalid API Key ${call.headers.authorization} for account ${TEST_ENV.CLOUDFLARE_ACCOUNT_ID}` } }),
  );
  const err = await llm.chat('scorer', { messages: MESSAGES, json: true }).catch((e) => e);
  assert.equal(err.name, 'LlmExhaustedError');
  assert.match(err.message, /fatal \(401\)/);
  const everything = JSON.stringify({ message: err.message, attempts: err.attempts, events: llm.events, usage: await llm.usage.snapshot() });
  for (const secret of SECRETS) assert.ok(!everything.includes(secret), `sızan değer: ${secret}`);
  assert.match(everything, /\*\*\*/);
});

test('finish_reason=length → kesik yanıt hata sayılır, tamir denenmez, yedeğe geçilir (doğrulayıcı Gemma → Gemini)', async () => {
  const { llm, fetch } = setup((call) => {
    if (isCloudflare(call)) return chatWith('{"claims":[{"claim":"uzun uzun', 'length', { completion: 1500 });
    return chatWith('{"claims":[{"claim":"a","verdict":"supported"}]}', 'stop');
  });
  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(res.provider, 'gemini');
  assert.equal(fetch.calls.filter(isCloudflare).length, 1, 'kesik yanıt için tamir isteği yok');
  assert.equal(fetch.calls.filter(isGemini).length, 1);
  const truncated = llm.events.find((e) => e.type === 'truncated');
  assert.equal(truncated.model, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(truncated.maxTokens, 1500, 'config roles.verifier.maxTokens');
  const failed = llm.events.find((e) => e.type === 'provider_failed');
  assert.equal(failed.kind, 'truncated');
});

test('finish_reason=length JSON olmayan çağrıda da hata; geçerli JSON gibi görünse bile kabul edilmez', async () => {
  const { llm } = setup(() => chatWith('{"items":[]}', 'length'));
  const err = await llm.chat('scorer', { messages: MESSAGES, json: true }).catch((e) => e);
  assert.equal(err.name, 'LlmOutputError');
  assert.ok(err.attempts.every((a) => a.kind === 'truncated'));
});

test('Qwen3 düşünme kapalı: Groq gövdesinde reasoning_effort=none, Cloudflare isteğinde son kullanıcı mesajına " /no_think"', async () => {
  const { llm, fetch } = setup((call) => (isGroq(call) ? json(404, { error: { message: 'model_not_found' } }) : chatOk('{"ok":true}')));
  const msgs = [
    { role: 'system', content: 'sistem' },
    { role: 'user', content: 'kancalar' },
  ];
  await llm.chat('scorer', { messages: msgs, json: true });
  const [groqCall] = fetch.calls.filter(isGroq);
  const [cfCall] = fetch.calls.filter(isCloudflare);
  assert.equal(groqCall.body.reasoning_effort, 'none');
  assert.equal(groqCall.body.messages.at(-1).content, 'kancalar', 'Groq mesajı değişmez');
  assert.equal(cfCall.body.messages.at(-1).content, 'kancalar /no_think');
  assert.equal(cfCall.body.messages[0].content, 'sistem');
  assert.equal(msgs[1].content, 'kancalar', 'çağıranın mesaj dizisi değişmez');
});

test('JSON olmayan yanıtta da <think> ayıklanır; sadece düşünce dönerse hata (empty) ve yedek denenir', async () => {
  const ok = setup(() => chatOk('<think>hmm</think>Merhaba dünya'));
  const res = await ok.llm.chat('writer', { messages: MESSAGES });
  assert.equal(res.text, 'Merhaba dünya');

  const onlyThink = setup((call) => (isGroq(call) ? chatOk('<think>bitmeyen düşünce') : chatOk('cevap')));
  const r2 = await onlyThink.llm.chat('scorer', { messages: MESSAGES });
  assert.equal(r2.provider, 'cloudflare');
  assert.equal(onlyThink.llm.events.find((e) => e.type === 'provider_failed').kind, 'empty');
});

test('maxTokens çağrıda verilmezse config roles.<rol>.maxTokens kullanılır', async () => {
  const { llm, fetch } = setup(() => chatOk('{"a":1}'));
  await llm.chat('scorer', { messages: MESSAGES, json: true });
  await llm.chat('judge', { messages: MESSAGES, json: true });
  await llm.chat('scorer', { messages: MESSAGES, json: true, maxTokens: 321 });
  assert.deepEqual(
    fetch.calls.map((c) => c.body.max_completion_tokens),
    [1500, 200, 321],
  );
});

test('Groq 429 gövdesindeki "try again in 7.5s" ipucuna uyulur (retry-after başlığı yoksa)', async () => {
  assert.equal(parseRetryHintMs('Please try again in 7.5s.'), 7500);
  assert.equal(parseRetryHintMs('try again in 650ms'), 650);
  assert.equal(parseRetryHintMs('try again in 1m2.5s'), 62500);
  assert.equal(parseRetryHintMs('başka metin'), undefined);
  const { llm, sleep } = setup((call, i) =>
    i === 0
      ? json(429, { error: { message: 'Rate limit reached on tokens per minute (TPM): Limit 6000. Please try again in 7.5s.' } })
      : chatOk('{"a":1}'),
  );
  await llm.chat('scorer', { messages: MESSAGES, json: true });
  assert.deepEqual(sleep.waits, [7500]);
});
