import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLlm, LlmExhaustedError } from '../index.js';
import { FIXED_NOW, TEST_ENV, fakeFetch, fakeSleep, json, rateLimited, realConfig } from './helpers.js';

function vectorsFor(n, dim = 1024) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: dim }, (_, j) => (i + j) / dim));
}

function embedOk(texts, dim = 1024) {
  return json(200, { success: true, result: { shape: [texts.length, dim], data: vectorsFor(texts.length, dim) } });
}

function setup(handler) {
  const fetch = fakeFetch(handler);
  const sleep = fakeSleep();
  const llm = createLlm(realConfig(), { env: TEST_ENV, fetch, sleep, now: () => FIXED_NOW });
  return { llm, fetch, sleep };
}

test('embed 1024 boyutlu vektör döner ve batch’ler (batchSize=50)', async () => {
  const texts = Array.from({ length: 120 }, (_, i) => `kart metni ${i}`);
  const { llm, fetch } = setup((call) => embedOk(call.body.text));

  const res = await llm.embed(texts);

  assert.equal(res.provider, 'cloudflare');
  assert.equal(res.model, '@cf/baai/bge-m3');
  assert.equal(res.vectors.length, 120);
  assert.ok(res.vectors.every((v) => v.length === 1024));
  assert.deepEqual(fetch.calls.map((c) => c.body.text.length), [50, 50, 20]);
  assert.equal(fetch.calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/baai/bge-m3');
  assert.deepEqual(fetch.calls[2].body.text[0], 'kart metni 100');
  assert.ok(res.usage.inputTokens > 0);
  assert.ok(res.usage.neurons > 0);
});

test('embed OpenAI-uyumlu { data:[{embedding}] } yanıtını da kabul eder', async () => {
  const { llm } = setup((call) => json(200, { data: vectorsFor(call.body.text.length).map((embedding) => ({ embedding })) }));
  const res = await llm.embed(['tek metin']);
  assert.equal(res.vectors.length, 1);
  assert.equal(res.vectors[0].length, 1024);
});

test('embed yanlış boyut dönerse kabul etmez', async () => {
  const { llm } = setup((call) => embedOk(call.body.text, 384));
  await assert.rejects(() => llm.embed(['a']), (err) => {
    assert.ok(err instanceof LlmExhaustedError);
    assert.match(err.attempts[0].reason, /fatal/);
    return true;
  });
});

test('embed 429 -> üstel bekleme ile tekrar', async () => {
  const { llm, sleep } = setup((call, i) => (i === 0 ? rateLimited() : embedOk(call.body.text)));
  const res = await llm.embed(['a', 'b']);
  assert.equal(res.vectors.length, 2);
  assert.deepEqual(sleep.waits, [2000]);
});

test('embed boş liste -> çağrı yapılmaz', async () => {
  const { llm, fetch } = setup(() => {
    throw new Error('çağrılmamalı');
  });
  const res = await llm.embed([]);
  assert.deepEqual(res.vectors, []);
  assert.equal(fetch.calls.length, 0);
});
