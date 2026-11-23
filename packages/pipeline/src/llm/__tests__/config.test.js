import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG_PATH, REQUIRED_ROLES } from '../config.js';
import { createLlm, loadConfig, LlmConfigError, validateConfig } from '../index.js';

function rawConfig() {
  return JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
}

function expectConfigError(mutate, pattern) {
  const raw = rawConfig();
  mutate(raw);
  assert.throws(() => validateConfig(raw), (err) => {
    assert.ok(err instanceof LlmConfigError, `LlmConfigError bekleniyordu: ${err}`);
    assert.match(err.message, pattern);
    return true;
  });
}

test('gerçek config dosyası geçerli ve beklenen değerleri içeriyor', () => {
  const cfg = loadConfig();
  for (const role of REQUIRED_ROLES) assert.ok(cfg.roles[role], role);
  assert.deepEqual(cfg.roles.scorer.steps.map((s) => s.members.map((m) => `${m.provider}:${m.model}`)), [
    ['groq:qwen/qwen3.8-27b'],
    ['groq:openai/gpt-oss-20b'],
    ['cloudflare:@cf/mistralai/mistral-small-3.1-24b-instruct'],
    ['cloudflare:@cf/meta/llama-4-scout-17b-16e-instruct'],
  ]);
  // Düşünen Groq yedeği kendi maxTokens'ı ile (rolün 600'ü onu keserdi).
  assert.equal(cfg.roles.scorer.steps[1].members[0].maxTokens, 1000);
  assert.ok(!JSON.stringify(cfg.roles).includes('qwen3-30b-a3b-fp8'), 'kapanan Cloudflare Qwen3 30B zincirde olmamalı');
  assert.deepEqual(cfg.providers.groq.perMinuteLimits['qwen/qwen3.8-27b'], { tokensPerMinute: 8000, outputTokensPerMinute: 1000 });
  for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'default']) {
    assert.deepEqual(cfg.providers.groq.perMinuteLimits[m], { tokensPerMinute: 8000, outputTokensPerMinute: 1000 }, m);
  }
  assert.deepEqual(cfg.providers.cloudflare.neuronsPerMillionTokens['@cf/meta/llama-4-scout-17b-16e-instruct'], { input: 24545, output: 77273 });
  assert.deepEqual(cfg.roles.writer.steps.map((s) => s.members[0].model), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', '@cf/openai/gpt-oss-20b']);
  assert.ok(cfg.roles.writer.steps.every((s) => s.members.length === 1 && s.strategy !== 'round_robin'));
  assert.deepEqual(cfg.roles.verifier.steps.map((s) => s.members[0].model), [
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
    '@cf/google/gemma-4-26b-a4b-it',
    'gemini-3.1-flash-lite',
  ]);
  assert.deepEqual(cfg.roles.judge.steps, cfg.roles.scorer.steps);
  assert.equal(cfg.roles.embedding.dimensions, 1024);
  assert.equal(cfg.roles.embedding.steps[0].members[0].model, '@cf/baai/bge-m3');
  assert.deepEqual(cfg.providers.groq.dailyLimits.perModel, { requests: 1000, tokens: 200000 });
  assert.deepEqual(cfg.providers.cloudflare.dailyLimits.provider, { neurons: 10000 });
  assert.equal(cfg.providers.groq.stopAtPercent, 90);
  assert.deepEqual(
    { a: cfg.retry.maxAttempts, b: cfg.retry.baseDelayMs, c: cfg.retry.maxDelayMs, t: cfg.retry.requestTimeoutMs },
    { a: 3, b: 2000, c: 30000, t: 60000 },
  );
  assert.deepEqual(cfg.scoring, { batchSize: 10, passPercent: 50, minSurprise: 6, minTrRelevance: 4 });
  assert.deepEqual(
    { s: cfg.roles.scorer.maxTokens, w: cfg.roles.writer.maxTokens, v: cfg.roles.verifier.maxTokens, j: cfg.roles.judge.maxTokens },
    { s: 600, w: 1000, v: 800, j: 200 },
  );
  // Groq'a giden maxTokens OTPM (1000) sınırını aşmaz.
  assert.ok(cfg.roles.scorer.maxTokens <= 1000 && cfg.roles.writer.maxTokens <= 1000);
  assert.deepEqual(
    { s: cfg.roles.scorer.expectedOutputTokens, w: cfg.roles.writer.expectedOutputTokens, v: cfg.roles.verifier.expectedOutputTokens },
    { s: 400, w: 350, v: 250 },
  );
  // Qwen3 düşünme kapalı: Groq reasoning_effort=none
  assert.deepEqual(cfg.roles.scorer.steps[0].members[0].params, { reasoning_effort: 'none' });
  assert.deepEqual(cfg.dedup, { duplicateThreshold: 0.92, grayZoneLow: 0.85 });
  assert.deepEqual(cfg.publish, { dailyCount: 100, minStockDays: 7 });
  assert.deepEqual(cfg.writing, { minSentences: 3, maxSentences: 5 });
  assert.ok(!JSON.stringify(cfg).includes('_aciklama'));
});

test('config doğrulama: eksik rol anlaşılır hata verir', () => {
  expectConfigError((c) => delete c.roles.writer, /roles\.writer.*'writer' rolü eksik/);
  expectConfigError((c) => delete c.roles.embedding, /embedding/);
});

test('config doğrulama: tanımsız sağlayıcı anlaşılır hata verir', () => {
  expectConfigError((c) => delete c.providers.gemini, /roles\.verifier\.chain\[2\]\.provider.*'gemini' providers bölümünde tanımlı değil/);
  expectConfigError((c) => { c.roles.scorer.chain[0].provider = 'openai'; }, /'openai'/);
  expectConfigError((c) => { c.providers.mistral = { baseUrl: 'https://x', apiKeyEnv: 'X' }; }, /providers\.mistral.*desteklenmeyen/);
});

test('config doğrulama: sağlayıcı alanları', () => {
  expectConfigError((c) => delete c.providers.groq.apiKeyEnv, /providers\.groq\.apiKeyEnv/);
  expectConfigError((c) => { c.providers.groq.baseUrl = 'http://insecure'; }, /baseUrl/);
  expectConfigError((c) => delete c.providers.cloudflare.accountIdEnv, /accountIdEnv/);
  expectConfigError((c) => { c.providers.groq.stopAtPercent = 150; }, /stopAtPercent/);
});

test('config doğrulama: zincir, strategy, sameAs, retry, embedding', () => {
  expectConfigError((c) => { c.roles.scorer.chain = []; }, /roles\.scorer\.chain/);
  expectConfigError((c) => { delete c.roles.scorer.chain[0].model; }, /'model' eksik/);
  expectConfigError((c) => { c.roles.writer.chain[0] = { strategy: 'random', pool: [c.roles.writer.chain[0]] }; }, /bilinmeyen strategy 'random'/);
  expectConfigError((c) => { c.roles.judge.sameAs = 'yok'; }, /sameAs 'yok'/);
  expectConfigError((c) => delete c.retry, /'retry' bölümü eksik/);
  expectConfigError((c) => { c.retry.maxAttempts = 0; }, /retry\.maxAttempts/);
  expectConfigError((c) => delete c.roles.embedding.dimensions, /roles\.embedding\.dimensions/);
  expectConfigError((c) => delete c.providers, /'providers' bölümü/);
});

test('createLlm ham config ile de çalışır, bilinmeyen rol anlaşılır hata verir', async () => {
  const llm = createLlm(rawConfig(), { env: {}, fetch: async () => { throw new Error('x'); } });
  await assert.rejects(() => llm.chat('poet', { messages: [{ role: 'user', content: 'x' }] }), /bilinmeyen rol 'poet'/);
  assert.throws(() => createLlm({ roles: {} }), LlmConfigError);
});

test('roles.<rol>.maxTokens pozitif tam sayı olmalı; userSuffix metin olmalı', () => {
  const raw = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  raw.roles.writer.maxTokens = -5;
  assert.throws(() => validateConfig(raw), /roles\.writer\.maxTokens/);
  const raw2 = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  raw2.roles.scorer.chain[1].userSuffix = 42;
  assert.throws(() => validateConfig(raw2), /userSuffix/);
});
