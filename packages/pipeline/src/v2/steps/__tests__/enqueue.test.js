import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash } from '../../../dedup/index.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { cardText } from '../dedup-card.js';
import { attributionText, buildFactRow, contextText, runEnqueue } from '../enqueue.js';
import { GOOD_CARD, baseCandidate, deps } from './helpers.js';

const VERIFICATION = { rounds: [{ verdict: 'supported', claims: [] }], result: 'supported' };

function verifiedCand(over = {}) {
  return baseCandidate({
    id: 'q1',
    source_key: 'enwiki-dyk:2019-03-14:3',
    status: 'verified',
    support_paragraph: 'p',
    scores: {
      category: '🔬 BİLİM',
      wow: 8.6,
      draft: { ...GOOD_CARD, content_hash: contentHash(cardText(GOOD_CARD)) },
      draft_embedding: [0.1, 0.2, 0.3],
      verification: VERIFICATION,
    },
    ...over,
  });
}

test('buildFactRow: facts satırı alanları', () => {
  const row = buildFactRow(verifiedCand());
  assert.deepEqual(row, {
    title: GOOD_CARD.title,
    content: GOOD_CARD.content,
    category: '🔬 BİLİM',
    tags: GOOD_CARD.tags,
    read_time_sq: 20,
    source_url: 'https://en.wikipedia.org/wiki/Octopus',
    source_label: 'Wikipedia',
    verified: true,
    status: 'queued',
    source_key: 'enwiki-dyk:2019-03-14:3',
    content_hash: contentHash(cardText(GOOD_CARD)),
    embedding: [0.1, 0.2, 0.3],
    wow_score: 8.6,
    verification: VERIFICATION,
    attribution: 'Kaynak: Wikipedia (CC BY-SA 4.0) — https://en.wikipedia.org/wiki/Octopus',
    context_text: 'p',
  });
});

test('attribution: TR kaynakta "Vikipedi"', () => {
  const tr = verifiedCand({ lang: 'tr', source_url: 'https://tr.wikipedia.org/wiki/Ahtapot' });
  assert.equal(
    attributionText(tr),
    'Kaynak: Vikipedi (CC BY-SA 4.0) — https://tr.wikipedia.org/wiki/Ahtapot',
  );
  assert.equal(buildFactRow(tr).source_label, 'Vikipedi');
});

test('runEnqueue: facts satırı eklenir, aday queued + fact_id', async () => {
  const repo = createMemoryStepsRepo({ candidates: [verifiedCand()] });
  const stats = await runEnqueue(deps({ repo }));
  const facts = repo.facts();
  assert.equal(facts.length, 1);
  assert.equal(facts[0].status, 'queued');
  assert.equal(repo.get('q1').status, 'queued');
  assert.equal(repo.get('q1').fact_id, facts[0].id);
  assert.equal(stats.advanced, 1);
});

test('runEnqueue: source_key unique çakışması → rejected:duplicate_insert', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [verifiedCand()],
    facts: [
      {
        id: 'f0',
        title: 'x',
        content: 'y',
        source_key: 'enwiki-dyk:2019-03-14:3',
        status: 'published',
      },
    ],
  });
  const stats = await runEnqueue(deps({ repo }));
  assert.equal(repo.get('q1').status, 'rejected');
  assert.equal(repo.get('q1').reject_reason, 'duplicate_insert');
  assert.equal(repo.get('q1').fact_id, null);
  assert.equal(stats.rejected.duplicate_insert, 1);
});

test('runEnqueue: aynı içerikli ikinci kart content_hash çakışmasıyla reddedilir', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [verifiedCand(), verifiedCand({ id: 'q2', source_key: 'enwiki-dyk:other:1' })],
  });
  await runEnqueue(deps({ repo }));
  assert.equal(repo.get('q1').status, 'queued');
  assert.equal(repo.get('q2').reject_reason, 'duplicate_insert');
  assert.equal(repo.facts().length, 1);
});

test('contextText: boş → null, kısa → normalize, uzun → 2000 içinde kelime sınırı', () => {
  assert.equal(contextText({ support_paragraph: null }), null);
  assert.equal(contextText({ support_paragraph: '  \n ' }), null);
  assert.equal(contextText({ support_paragraph: ' Kısa   metin\n burada ' }), 'Kısa metin burada');
  const long = contextText({ support_paragraph: 'kelime '.repeat(400) });
  assert.ok(long.length <= 2000);
  assert.ok(long.endsWith('kelime'));
  const mid = contextText({ support_paragraph: `${'a'.repeat(1995)} bbbbbbbb ccc` });
  assert.equal(mid, 'a'.repeat(1995));
  const noSpace = contextText({ support_paragraph: 'a'.repeat(2500) });
  assert.equal(noSpace.length, 2000);
});
