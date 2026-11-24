import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type FactRow,
  buildMessages,
  checkAccess,
  nextUtcReset,
  parseRequest,
  resolveTier,
  runModelChain,
} from './logic.ts';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const fact: FactRow = {
  id: UUID,
  title: 'Başlık',
  content: 'Kart metni',
  context_text: 'Kaynak metni',
  source_label: 'Vikipedi',
  status: 'published',
};

test('doğrulama: preset ve question birlikte / hiçbiri / uzun / geçersiz uuid', () => {
  assert.equal(parseRequest({ factId: UUID, presetId: 'why', question: 'x' }).ok, false);
  assert.equal(parseRequest({ factId: UUID }).ok, false);
  assert.equal(parseRequest({ factId: UUID, question: 'a'.repeat(301) }).ok, false);
  assert.equal(parseRequest({ factId: UUID, question: 'a'.repeat(300) }).ok, true);
  assert.equal(parseRequest({ factId: 'abc', presetId: 'why' }).ok, false);
  assert.equal(parseRequest({ factId: UUID, presetId: 'bogus' }).ok, false);
  assert.equal(parseRequest(null).ok, false);
});

test('doğrulama: history system rolü atılır, son 4 kalır, kırpılır', () => {
  const r = parseRequest({
    factId: UUID,
    presetId: 'why',
    history: [
      { role: 'system', content: 'sızıntı' },
      ...[1, 2, 3, 4, 5].map((i) => ({
        role: i % 2 ? 'user' : 'assistant',
        content: `m${i}`,
      })),
      { role: 'user', content: 'x'.repeat(2000) },
    ],
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.history.length, 4);
  assert.ok(!r.value.history.some((m) => m.content === 'sızıntı'));
  assert.equal(r.value.history[3].content.length, 1200);
  assert.equal(r.value.history[0].content, 'm3');
});

test('tier ve premium_required', () => {
  assert.equal(resolveTier({ premium: true }), 'premium');
  assert.equal(resolveTier({ premium: 'true' }), 'free');
  assert.equal(resolveTier(undefined), 'free');
  assert.equal(checkAccess('free', { question: 'soru' }), 'premium_required');
  assert.equal(checkAccess('free', {}), 'ok');
  assert.equal(checkAccess('premium', { question: 'soru' }), 'ok');
});

test('prompt: kullanıcı metni system içinde yok; context yoksa "—"', () => {
  const req = { factId: UUID, question: 'gizli kullanıcı sorusu', history: [] };
  const msgs = buildMessages(fact, req);
  assert.equal(msgs[0].role, 'system');
  assert.ok(!msgs[0].content.includes('gizli kullanıcı sorusu'));
  assert.equal(msgs.at(-1)?.content, 'gizli kullanıcı sorusu');
  const noCtx = buildMessages({ ...fact, context_text: null }, req);
  assert.ok(noCtx[0].content.includes('KAYNAK: —'));
  const preset = buildMessages(fact, {
    factId: UUID,
    presetId: 'simple',
    history: [],
  });
  assert.ok(preset.at(-1)?.content.includes('12 yaşındaki'));
});

test('zincir: 1. 429 -> 2. model; ikisi 429 -> ai_busy; timeout -> sıradaki', async () => {
  const models = [{ name: 'a' }, { name: 'b' }];
  const r1 = await runModelChain(models, async (m) =>
    m.name === 'a'
      ? { kind: 'rate_limited', retryAfterSeconds: 5 }
      : { kind: 'ok', answer: 'tamam' },
  );
  assert.deepEqual(r1, { ok: true, answer: 'tamam', modelName: 'b' });

  const r2 = await runModelChain(models, async (m) => ({
    kind: 'rate_limited',
    retryAfterSeconds: m.name === 'a' ? 5 : 40,
  }));
  assert.deepEqual(r2, { ok: false, code: 'ai_busy', retryAfterSeconds: 40 });

  const r3 = await runModelChain(models, async (m) =>
    m.name === 'a' ? { kind: 'fail' } : { kind: 'ok', answer: 'x' },
  );
  assert.equal(r3.ok, true);

  const r4 = await runModelChain(models, async (m) =>
    m.name === 'a' ? { kind: 'rate_limited', retryAfterSeconds: null } : { kind: 'fail' },
  );
  assert.deepEqual(r4, { ok: false, code: 'ai_failed' });
});

test('resetAt bir sonraki UTC gece yarısı', () => {
  assert.equal(
    nextUtcReset(new Date('2026-11-24T15:30:00Z')).toISOString(),
    '2026-11-25T00:00:00.000Z',
  );
});
