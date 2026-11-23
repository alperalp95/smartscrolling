import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLlm, extractJson } from '../index.js';
import { JSON_REPAIR_INSTRUCTION } from '../json.js';
import {
  FIXED_NOW,
  TEST_ENV,
  chatOk,
  fakeFetch,
  fakeSleep,
  isCloudflare,
  isGroq,
  json,
  realConfig,
} from './helpers.js';

const MESSAGES = [{ role: 'user', content: 'JSON ver' }];

function setup(handler) {
  const fetch = fakeFetch(handler);
  const llm = createLlm(realConfig(), {
    env: TEST_ENV,
    fetch,
    sleep: fakeSleep(),
    now: () => FIXED_NOW,
  });
  return { llm, fetch };
}

test('extractJson: çit, <think> ve ön/son metin temizlenir', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```').value, { a: 1 });
  assert.deepEqual(extractJson('<think>düşünüyorum {x}</think>Sonuç: {"a":[1,2]} bitti').value, {
    a: [1, 2],
  });
  assert.deepEqual(extractJson('[{"id":1}]').value, [{ id: 1 }]);
  assert.equal(extractJson('JSON yok').ok, false);
  assert.equal(extractJson('{"a":').ok, false);
  assert.equal(extractJson('').ok, false);
});

test('JSON tamir denemesi: geçersiz yanıt -> tek tamir çağrısı -> geçerli JSON', async () => {
  // verifier birincili Cloudflare (jsonMode=false): response_format gönderilmez, yanıttan ayıklanır
  const { llm, fetch } = setup((call, i) =>
    i === 0
      ? chatOk('Elbette, işte: {"claims": [ "eksik"', { prompt: 10, completion: 5 })
      : chatOk('```json\n{"claims":["tamam"]}\n```', { prompt: 20, completion: 6 }),
  );

  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });

  assert.equal(res.provider, 'cloudflare');
  assert.deepEqual(res.json, { claims: ['tamam'] });
  assert.deepEqual({ i: res.usage.inputTokens, o: res.usage.outputTokens }, { i: 30, o: 11 });
  assert.equal(fetch.calls.length, 2);
  assert.equal(fetch.calls[0].body.response_format, undefined);
  const repairMsgs = fetch.calls[1].body.messages;
  assert.equal(repairMsgs.length, 3);
  assert.equal(repairMsgs[1].role, 'assistant');
  assert.equal(repairMsgs[2].content, JSON_REPAIR_INSTRUCTION);
  assert.ok(llm.events.some((e) => e.type === 'json_repair' && e.provider === 'cloudflare'));
});

test('tamir de başarısızsa zincirde sonraki sağlayıcıya geçilir (tek tamir denemesi)', async () => {
  const { llm, fetch } = setup((call) =>
    isCloudflare(call) ? chatOk('hâlâ JSON değil') : chatOk('{"ok":true}'),
  );

  const res = await llm.chat('verifier', { messages: MESSAGES, json: true });

  assert.equal(res.provider, 'gemini');
  assert.deepEqual(res.json, { ok: true });
  // doğrulayıcı zincirinde iki Cloudflare üyesi var (Mistral, Gemma): her biri istek + tek tamir
  assert.equal(fetch.calls.filter(isCloudflare).length, 4);
  assert.ok(llm.events.some((e) => e.type === 'provider_failed' && e.kind === 'invalid_json'));
});

test('Groq json_validate_failed (400) -> failed_generation ile tamir edilir', async () => {
  const { llm, fetch } = setup((call, i) => {
    if (i === 0) {
      return json(400, {
        error: {
          message: 'Failed to validate JSON',
          type: 'invalid_request_error',
          code: 'json_validate_failed',
          failed_generation: '{"score": 7,',
        },
      });
    }
    return chatOk('{"score": 7}');
  });

  const res = await llm.chat('scorer', { messages: MESSAGES, json: true });

  assert.equal(res.provider, 'groq');
  assert.deepEqual(res.json, { score: 7 });
  assert.equal(fetch.calls.length, 2);
  assert.ok(fetch.calls.every(isGroq));
  assert.equal(fetch.calls[1].body.messages[1].content, '{"score": 7,');
});
