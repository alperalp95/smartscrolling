import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// V2-05d: doğrulayıcı zinciri (Mistral → Gemma düşünme kapalı → Gemini) ve 'writing' config doğrulaması.
// Sahte fetch; gerçek ağ yok.
import { test } from 'node:test';
import { DEFAULT_CONFIG_PATH } from '../config.js';
import { LlmConfigError, createLlm, createMemoryUsageStore, validateConfig } from '../index.js';
import {
  FIXED_NOW,
  TEST_ENV,
  chatOk,
  fakeFetch,
  fakeSleep,
  isCloudflare,
  isGemini,
  json,
  realConfig,
} from './helpers.js';

const MESSAGES = [{ role: 'user', content: 'doğrula' }];
const OK = '{"claims":[{"claim":"a","verdict":"supported"}]}';

function setup(handler) {
  const fetch = fakeFetch(handler);
  const llm = createLlm(realConfig(), {
    env: TEST_ENV,
    fetch,
    sleep: fakeSleep(),
    now: () => FIXED_NOW,
    usageStore: createMemoryUsageStore(),
  });
  return { llm, fetch };
}

const MISTRAL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const GEMMA = '@cf/google/gemma-4-26b-a4b-it';

test('doğrulayıcı zinciri: birincil Mistral Small 3.1 (Cloudflare); düşünme parametresi yok, maxTokens 800', async () => {
  const { llm, fetch } = setup(() => chatOk(OK));
  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(res.provider, 'cloudflare');
  assert.equal(res.model, MISTRAL);
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].body.model, MISTRAL);
  assert.equal(fetch.calls[0].body.max_tokens, 800);
  assert.equal(fetch.calls[0].body.chat_template_kwargs, undefined);
});

test('doğrulayıcı zinciri: Mistral düşerse Gemma (chat_template_kwargs.enable_thinking=false), o da düşerse Gemini', async () => {
  const order = [];
  const { llm, fetch } = setup((call) => {
    order.push(isGemini(call) ? 'gemini' : call.body.model);
    if (isCloudflare(call) && call.body.model === MISTRAL)
      return json(404, { errors: [{ message: 'No such model' }] });
    if (isCloudflare(call) && call.body.model === GEMMA)
      return json(500, { errors: [{ message: 'internal' }] });
    return chatOk(OK);
  });
  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(res.provider, 'gemini');
  assert.equal(order[0], MISTRAL);
  assert.equal(order.at(-1), 'gemini');
  assert.ok(order.includes(GEMMA));
  assert.ok(order.indexOf(GEMMA) < order.indexOf('gemini'));
  const gemmaCall = fetch.calls.find((c) => c.body?.model === GEMMA);
  assert.deepEqual(gemmaCall.body.chat_template_kwargs, { enable_thinking: false });
});

test('doğrulayıcı zinciri: Mistral düşer, Gemma yanıt verir → Gemini çağrılmaz', async () => {
  const { llm, fetch } = setup((call) =>
    call.body?.model === MISTRAL
      ? json(404, { errors: [{ message: 'No such model' }] })
      : chatOk(OK),
  );
  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });
  assert.equal(res.model, GEMMA);
  assert.equal(fetch.calls.filter(isGemini).length, 0);
});

test('config: Mistral Small için Neuron fiyatı tanımlı (girdi 31876 / çıktı 50488 per M)', () => {
  const cfg = realConfig();
  assert.deepEqual(cfg.providers.cloudflare.neuronsPerMillionTokens[MISTRAL], {
    input: 31876,
    output: 50488,
  });
});

function raw() {
  return JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
}

function expectError(mutate, pattern) {
  const r = raw();
  mutate(r);
  assert.throws(
    () => validateConfig(r),
    (err) => err instanceof LlmConfigError && pattern.test(err.message),
  );
}

test('config doğrulama: writing.minSentences / maxSentences', () => {
  assert.deepEqual(validateConfig(raw()).writing, { minSentences: 3, maxSentences: 5, maxWrittenBacklog: 40 });
  expectError((c) => {
    c.writing.minSentences = 0;
  }, /writing\.minSentences.*1-10 arası bir tam sayı/);
  expectError((c) => {
    c.writing.maxSentences = 2.5;
  }, /writing\.maxSentences/);
  expectError((c) => {
    c.writing.maxSentences = 'dört';
  }, /writing\.maxSentences/);
  expectError((c) => {
    c.writing = { minSentences: 5, maxSentences: 3 };
  }, /writing\.minSentences.*büyük olamaz/);
  expectError((c) => {
    c.writing = [2, 4];
  }, /'writing' bir nesne olmalı/);
  const noWriting = raw();
  Reflect.deleteProperty(noWriting, 'writing');
  assert.equal(
    validateConfig(noWriting).writing,
    undefined,
    'bölüm isteğe bağlı; adımlar varsayılanı kullanır',
  );
});
