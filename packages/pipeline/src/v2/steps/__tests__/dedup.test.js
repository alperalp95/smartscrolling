import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { cardText, runDedupCard } from '../dedup-card.js';
import { runDedupHook } from '../dedup-hook.js';
import { runScore } from '../score.js';
import { GOOD_CARD, baseCandidate, bowEmbed, deps, exhausted, fakeLlm } from './helpers.js';

const hookCand = (id, hook, over = {}) =>
  baseCandidate({ id, source_key: `k-${id}`, hook_text: hook, ...over });

/** Verilen benzerlikte (cos) birim vektör: [cos, sin, 0...] */
function vecAt(cos) {
  return [cos, Math.sqrt(1 - cos * cos), 0];
}

test('dedup-hook: anlamca aynı kanca → rejected:duplicate_semantic; embedding kaydedilir', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [
      hookCand('a', 'the octopus has three hearts and blue blood'),
      hookCand('b', 'octopus has blue blood and three hearts'),
    ],
  });
  const llm = fakeLlm({ judge: { sameFact: true } });
  const stats = await runDedupHook(deps({ llm, repo }));
  assert.equal(repo.get('a').status, 'new');
  assert.equal(repo.get('a').scores.dedup_hook.verdict, 'unique');
  assert.ok(Array.isArray(repo.get('a').embedding));
  assert.equal(repo.get('b').status, 'rejected');
  assert.equal(repo.get('b').reject_reason, 'duplicate_semantic');
  assert.equal(repo.get('b').scores.dedup_hook.matchId, 'a');
  assert.ok(Array.isArray(repo.get('b').embedding));
  assert.equal(llm.count('embedding'), 1, 'tek embed çağrısı');
  assert.equal(stats.advanced, 1);
});

test('dedup-hook: kendisi ve rejected adaylar eşleşmeden çıkarılır', async () => {
  const hook = 'the octopus has three hearts and blue blood';
  const repo = createMemoryStepsRepo({
    candidates: [
      hookCand('old', hook.replace('the ', ''), {
        status: 'rejected',
        reject_reason: 'low_surprise',
        embedding: bowEmbed(hook),
      }),
      hookCand('self', hook, { embedding: bowEmbed(hook), attempts: 1 }),
    ],
  });
  await runDedupHook(deps({ llm: fakeLlm({}), repo }));
  assert.equal(repo.get('self').status, 'new');
  assert.equal(repo.get('self').scores.dedup_hook.reason, 'no_match');
});

test('dedup-hook: mevcut yayınlanmış karta karşı gri bölge → hakem "aynı olgu" → duplicate_judge_same_fact', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [hookCand('a', 'kanca a')],
    facts: [
      {
        id: 'f1',
        title: 'Ahtapot',
        content: 'Üç kalp.',
        embedding: vecAt(0.88),
        status: 'published',
      },
    ],
  });
  const llm = fakeLlm({
    embed: (texts) => texts.map(() => vecAt(1)),
    judge: { same_fact: true, reason: 'aynı' },
  });
  await runDedupHook(deps({ llm, repo }));
  assert.equal(repo.get('a').reject_reason, 'duplicate_judge_same_fact');
  assert.equal(llm.count('judge'), 1);
});

test('dedup-hook: gri bölgede hakem zinciri tükenirse tekrar sayılmaz → deferred, aday new', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [hookCand('a', 'kanca a'), hookCand('b', 'kanca b')],
    facts: [{ id: 'f1', title: 'T', content: 'C', embedding: vecAt(0.88), status: 'published' }],
  });
  const llm = fakeLlm({
    embed: (texts) => texts.map(() => vecAt(1)),
    judge: () => exhausted('judge'),
  });
  const stats = await runDedupHook(deps({ llm, repo }));
  assert.equal(stats.deferred, 2);
  assert.equal(stats.exhaustedRole, 'judge');
  for (const id of ['a', 'b']) {
    assert.equal(repo.get(id).status, 'new');
    assert.equal(repo.get(id).scores, null);
    assert.equal(repo.get(id).attempts, 0);
  }
});

test('dedup-hook: embedding servisi hatası → aday new kalır (attempts++), puanlamaya geçmez', async () => {
  const repo = createMemoryStepsRepo({ candidates: [hookCand('a', 'kanca a')] });
  const llm = fakeLlm({ embed: () => new Error('cloudflare 500'), scorer: [] });
  const stats = await runDedupHook(deps({ llm, repo }));
  const c = repo.get('a');
  assert.equal(c.status, 'new');
  assert.equal(c.attempts, 1);
  assert.equal(c.embedding, null);
  assert.equal(c.scores, null);
  assert.equal(stats.failed, 1);
  await runScore(deps({ llm, repo }));
  assert.equal(llm.count('scorer'), 0, 'tekrar-1 geçmemiş aday puanlanmaz');
});

test('dedup-hook: embedding zinciri tükenirse → deferred, attempts değişmez', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [hookCand('a', 'kanca a'), hookCand('b', 'kanca b')],
  });
  const stats = await runDedupHook(
    deps({ llm: fakeLlm({ embed: () => exhausted('embedding') }), repo }),
  );
  assert.equal(stats.deferred, 2);
  assert.equal(repo.get('a').attempts, 0);
});

function writtenCand(id, draft, over = {}) {
  return baseCandidate({
    id,
    source_key: `k-${id}`,
    status: 'written',
    support_paragraph: 'p',
    scores: { category: '🔬 BİLİM', draft },
    ...over,
  });
}

test('dedup-card: yayınlanmış karta anlamca aynı → rejected:duplicate_card_semantic; adaylar yok sayılır', async () => {
  const text = cardText(GOOD_CARD);
  const repo = createMemoryStepsRepo({
    candidates: [
      writtenCand('w', GOOD_CARD),
      // kendi kancası aynı vektörde olsa bile aday eşleşmesi kart tekrarı sayılmaz
      baseCandidate({
        id: 'other',
        source_key: 'o',
        status: 'scored',
        hook_text: text,
        embedding: bowEmbed(text),
      }),
    ],
    facts: [
      {
        id: 'f1',
        title: GOOD_CARD.title,
        content: GOOD_CARD.content.replace('Üçüncüsü', 'Sonuncusu'),
        embedding: bowEmbed(text),
        status: 'queued',
      },
    ],
  });
  await runDedupCard(deps({ llm: fakeLlm({}), repo }));
  const c = repo.get('w');
  assert.equal(c.reject_reason, 'duplicate_card_semantic');
  assert.equal(c.scores.dedup_card.matchId, 'f1');
});

test('dedup-card: birebir aynı metin → duplicate_card_exact_hash', async () => {
  const text = cardText(GOOD_CARD);
  const repo = createMemoryStepsRepo({
    candidates: [writtenCand('w', GOOD_CARD)],
    facts: [
      {
        id: 'f1',
        title: GOOD_CARD.title,
        content: GOOD_CARD.content,
        embedding: bowEmbed(text),
        status: 'published',
      },
    ],
  });
  await runDedupCard(deps({ llm: fakeLlm({}), repo }));
  assert.equal(repo.get('w').reject_reason, 'duplicate_card_exact_hash');
});

test('dedup-card: benzersiz → written kalır, hash + embedding saklanır, archived kart sayılmaz', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [writtenCand('w', GOOD_CARD)],
    facts: [
      {
        id: 'f1',
        title: GOOD_CARD.title,
        content: GOOD_CARD.content,
        embedding: bowEmbed(cardText(GOOD_CARD)),
        status: 'archived',
      },
    ],
  });
  const stats = await runDedupCard(deps({ llm: fakeLlm({}), repo }));
  const c = repo.get('w');
  assert.equal(c.status, 'written');
  assert.equal(c.scores.dedup_card.verdict, 'unique');
  assert.match(c.scores.draft.content_hash, /^[0-9a-f]{64}$/);
  assert.ok(Array.isArray(c.scores.draft_embedding));
  assert.equal(stats.advanced, 1);
});

test('dedup-card: embedding hatası → aday written kalır, işaret konmaz', async () => {
  const repo = createMemoryStepsRepo({ candidates: [writtenCand('w', GOOD_CARD)] });
  await runDedupCard(deps({ llm: fakeLlm({ embed: () => new Error('cloudflare 500') }), repo }));
  const c = repo.get('w');
  assert.equal(c.status, 'written');
  assert.equal(c.attempts, 1);
  assert.equal(c.scores.dedup_card, undefined);
});
