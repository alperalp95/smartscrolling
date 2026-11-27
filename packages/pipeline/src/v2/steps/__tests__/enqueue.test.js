import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash } from '../../../dedup/index.js';
import { deriveFactVisualKey } from '../../../lib/fact-visual-key.js';
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
    visual_key: deriveFactVisualKey({
      sourceLabel: 'Wikipedia',
      category: '🔬 BİLİM',
      title: GOOD_CARD.title,
      tags: GOOD_CARD.tags,
      content: GOOD_CARD.content,
    }),
  });
});

test('buildFactRow: TARİH kategorisinde visual_key dolu', () => {
  const cand = verifiedCand();
  cand.scores.category = '📜 TARİH';
  const k = buildFactRow(cand).visual_key;
  assert.equal(typeof k, 'string');
  assert.ok(k.length > 0);
});

test('buildFactRow: bilinmeyen kategoride varsayılan visual_key', () => {
  const cand = verifiedCand();
  cand.scores.category = 'zzz';
  const k = buildFactRow(cand).visual_key;
  assert.equal(typeof k, 'string');
  assert.ok(k.length > 0);
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

test('runEnqueue: görsel bulunursa satırda media_url, sayaç found', async () => {
  const repo = createMemoryStepsRepo({ candidates: [verifiedCand()] });
  const seen = [];
  const stats = await runEnqueue(
    deps({
      repo,
      resolveImage: async (url) => {
        seen.push(url);
        return 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Octopus.jpg';
      },
    }),
  );
  assert.deepEqual(seen, ['https://en.wikipedia.org/wiki/Octopus']);
  assert.equal(
    repo.facts()[0].media_url,
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/Octopus.jpg',
  );
  assert.deepEqual(stats.media, { found: 1, missing: 0 });
});

test('runEnqueue: görsel yoksa kart yine eklenir, media_url null, sayaç missing', async () => {
  const repo = createMemoryStepsRepo({ candidates: [verifiedCand()] });
  const stats = await runEnqueue(deps({ repo, resolveImage: async () => null }));
  assert.equal(repo.facts().length, 1);
  assert.equal(repo.facts()[0].media_url, null);
  assert.equal(repo.get('q1').status, 'queued');
  assert.deepEqual(stats.media, { found: 0, missing: 1 });
});

test('runEnqueue: fetchImpl enjekte edilir (özet adresi çağrılır)', async () => {
  const repo = createMemoryStepsRepo({ candidates: [verifiedCand()] });
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: false, status: 404 };
  };
  await runEnqueue(deps({ repo, fetchImpl }));
  assert.deepEqual(urls, ['https://en.wikipedia.org/api/rest_v1/page/summary/Octopus']);
  assert.equal(repo.facts().length, 1);
});

const REVIEW_CFG = { review: { sensitiveStems: ['cinayet'], sensitiveWords: [] } };

test('runEnqueue: hassas kelimeli aday review durumunda eklenir, aday queued', async () => {
  const cand = verifiedCand();
  cand.hook_text = 'Gerçek bir cinayete dayanan öykü';
  const repo = createMemoryStepsRepo({ candidates: [cand] });
  const stats = await runEnqueue(deps({ repo, config: REVIEW_CFG }));
  const facts = repo.facts();
  assert.equal(facts[0].status, 'review');
  assert.deepEqual(facts[0].verification.review.terms, ['cinayet']);
  assert.equal(facts[0].verification.result, 'supported');
  assert.equal(stats.review, 1);
  assert.equal(repo.get('q1').status, 'queued');
  assert.equal(repo.get('q1').fact_id, facts[0].id);
});

test('runEnqueue: temiz aday queued kalır, verification.review yok', async () => {
  const repo = createMemoryStepsRepo({ candidates: [verifiedCand()] });
  const stats = await runEnqueue(deps({ repo, config: REVIEW_CFG }));
  const f = repo.facts()[0];
  assert.equal(f.status, 'queued');
  assert.equal(f.verification.review, undefined);
  assert.ok(!stats.review);
});
