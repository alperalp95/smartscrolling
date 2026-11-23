import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { CATEGORY_NAMES, buildScorePrompt } from '../../prompts/score.js';
import { CATEGORIES, normalizeCategory } from '../common.js';
import { decideBatch, passCount, runScore, wowScore } from '../score.js';
import { baseCandidate, deps, exhausted, fakeLlm, parseScoreRequest } from './helpers.js';

const passedHook = { dedup_hook: { verdict: 'unique', reason: 'no_match' } };

function repoWith(n, over = () => ({})) {
  return createMemoryStepsRepo({
    candidates: Array.from({ length: n }, (_, i) =>
      baseCandidate({
        id: `s${i + 1}`,
        source_key: `k${i + 1}`,
        hook_text: `hook number ${i + 1}`,
        scores: passedHook,
        ...over(i),
      }),
    ),
  });
}

test('wowScore = 0.6*surprise + 0.4*tr_relevance', () => {
  assert.equal(wowScore(10, 5), 8);
  assert.equal(wowScore(7, 4), 5.8);
});

test('passCount: batch boyutunun %30u, en az 1', () => {
  assert.equal(passCount(10, 30), 3);
  assert.equal(passCount(15, 30), 5);
  assert.equal(passCount(2, 30), 1);
  assert.equal(passCount(1, 30), 1);
  assert.equal(passCount(0, 30), 0);
});

test('decideBatch: eşikler ve is_definition cezası', () => {
  const mk = (id, surprise, tr, def = false, category = '🔬 BİLİM') => ({
    cand: { id },
    score: {
      surprise,
      tr_relevance: tr,
      is_definition: def,
      category,
      wow: wowScore(surprise, tr),
    },
  });
  const out = decideBatch(
    [
      mk('def', 10, 10, true),
      mk('low_s', 5.9, 9),
      mk('low_r', 9, 3.9),
      mk('cat', 9, 9, false, null),
      mk('ok', 6, 4),
    ],
    10,
    30,
  );
  const d = Object.fromEntries(out.map((o) => [o.cand.id, o.decision]));
  assert.deepEqual(d, {
    def: 'definition',
    low_s: 'low_surprise',
    low_r: 'low_relevance',
    cat: 'invalid_category',
    ok: 'scored',
  });
});

test('normalizeCategory: kategori dışı değer normalize edilir ya da null', () => {
  assert.equal(normalizeCategory('🔬 BİLİM'), '🔬 BİLİM');
  assert.equal(normalizeCategory('Bilim'), '🔬 BİLİM');
  assert.equal(normalizeCategory('SAĞLIK'), '🌱 SAĞLIK');
  assert.equal(normalizeCategory('sanat & kültür'), '🎨 SANAT & KÜLTÜR');
  assert.equal(normalizeCategory('Sports'), '🏆 SPOR');
  assert.equal(normalizeCategory('science'), '🔬 BİLİM');
  assert.equal(normalizeCategory('history'), '📜 TARİH');
  assert.equal(normalizeCategory('Nature'), '🔬 BİLİM');
  assert.equal(normalizeCategory('Coğrafya'), '🔬 BİLİM');
  assert.equal(normalizeCategory('xyz'), null);
  assert.equal(normalizeCategory('Astroloji'), null);
  assert.equal(normalizeCategory(42), null);
  assert.equal(CATEGORIES.length, 8);
});

test('runScore: 10 aday tek çağrı, en iyi %30 (3) scored, kalanlar below_cut; puanlar scores jsonb', async () => {
  const repo = repoWith(10);
  const llm = fakeLlm({
    scorer: (req) => ({
      items: parseScoreRequest(req).map(({ id }) => ({
        id,
        surprise: 6 + (id % 5),
        tr_relevance: 4 + (id % 6),
        is_definition: false,
        category: 'Tarih',
        reason: 'r',
      })),
    }),
  });
  const stats = await runScore(deps({ llm, repo }));
  assert.equal(llm.count('scorer'), 1);
  const cands = repo.candidates();
  const scored = cands.filter((c) => c.status === 'scored');
  assert.equal(scored.length, 3);
  assert.equal(cands.filter((c) => c.reject_reason === 'below_cut').length, 7);
  assert.equal(stats.advanced, 3);
  const minScored = Math.min(...scored.map((c) => c.scores.wow));
  const maxCut = Math.max(
    ...cands.filter((c) => c.reject_reason === 'below_cut').map((c) => c.scores.wow),
  );
  assert.ok(minScored >= maxCut);
  const s = scored[0].scores;
  assert.equal(s.category, '📜 TARİH');
  assert.equal(typeof s.surprise, 'number');
  assert.equal(typeof s.tr_relevance, 'number');
  assert.equal(s.is_definition, false);
  assert.ok(s.dedup_hook, 'önceki scores alanları korunur');
});

test('runScore: hepsi eşik altındaysa kimse geçmez; tek uygun aday en az 1 kuralıyla geçer', async () => {
  const repo = repoWith(3);
  const llm = fakeLlm({
    scorer: [
      {
        items: [
          {
            id: 1,
            surprise: 9,
            tr_relevance: 9,
            is_definition: true,
            category: 'Bilim',
            reason: '',
          },
          {
            id: 2,
            surprise: 2,
            tr_relevance: 9,
            is_definition: false,
            category: 'Bilim',
            reason: '',
          },
          {
            id: 3,
            surprise: 7,
            tr_relevance: 5,
            is_definition: 'false',
            category: 'Astroloji',
            reason: '',
          },
        ],
      },
    ],
  });
  await runScore(deps({ llm, repo }));
  const r = Object.fromEntries(repo.candidates().map((c) => [c.id, c.reject_reason]));
  assert.deepEqual(r, { s1: 'definition', s2: 'low_surprise', s3: 'invalid_category' });

  const repo2 = repoWith(2);
  const llm2 = fakeLlm({
    scorer: [
      {
        items: [
          { id: 1, surprise: 8, tr_relevance: 8, is_definition: false, category: 'Spor' },
          { id: 2, surprise: 9, tr_relevance: 9, is_definition: false, category: 'Spor' },
        ],
      },
    ],
  });
  await runScore(deps({ llm: llm2, repo: repo2 }));
  assert.equal(repo2.get('s2').status, 'scored');
  assert.equal(repo2.get('s1').reject_reason, 'below_cut');
});

test('runScore: batchSize kadar gruplar halinde çağırır; dedup_hook işareti olmayanı almaz', async () => {
  const repo = repoWith(7, (i) => (i === 6 ? { scores: null } : {}));
  const llm = fakeLlm({
    scorer: (req) => ({
      items: parseScoreRequest(req).map(({ id }) => ({
        id,
        surprise: 8,
        tr_relevance: 8,
        is_definition: false,
        category: 'Bilim',
      })),
    }),
  });
  await runScore(deps({ llm, repo, config: { scoring: { batchSize: 3, passPercent: 30 } } }));
  assert.equal(llm.count('scorer'), 2);
  assert.equal(repo.get('s7').status, 'new');
});

test('runScore: modelin döndürmediği aday aynı run içinde küçük batch ile bir kez daha puanlanır', async () => {
  const repo = repoWith(3);
  const ok = (id) => ({
    id,
    surprise: 8,
    tr_relevance: 8,
    is_definition: false,
    category: 'Bilim',
  });
  const llm = fakeLlm({ scorer: [{ items: [ok(1)] }, { items: [ok(1), ok(2)] }] });
  const stats = await runScore(deps({ llm, repo }));
  assert.equal(llm.count('scorer'), 2, 'tek ek çağrı');
  assert.equal(
    llm.calls[1].messages[1].content.split('\n').length,
    3,
    'ikinci çağrıda sadece 2 eksik aday',
  );
  assert.equal(repo.get('s1').status, 'scored');
  assert.notEqual(repo.get('s2').status, 'new');
  assert.notEqual(repo.get('s3').status, 'new');
  assert.equal(stats.failed, 0);
});

test('runScore: eksik aday ikinci denemede de dönmezse attempts++ ile new kalır', async () => {
  const repo = repoWith(2);
  const llm = fakeLlm({
    scorer: [
      { items: [{ id: 1, surprise: 8, tr_relevance: 8, is_definition: false, category: 'Bilim' }] },
      { items: [] },
    ],
  });
  const stats = await runScore(deps({ llm, repo }));
  assert.equal(llm.count('scorer'), 2);
  assert.equal(repo.get('s1').status, 'scored');
  assert.equal(repo.get('s2').status, 'new');
  assert.equal(repo.get('s2').attempts, 1);
  assert.equal(stats.failed, 1);
});

test('runScore: LlmExhaustedError → stats.deferred, adaylar new kalır, attempts değişmez', async () => {
  const repo = repoWith(4);
  const llm = fakeLlm({ scorer: () => exhausted('scorer') });
  const stats = await runScore(
    deps({ llm, repo, config: { scoring: { batchSize: 2, passPercent: 30 } } }),
  );
  assert.equal(stats.deferred, 4);
  assert.equal(stats.exhaustedRole, 'scorer');
  assert.equal(llm.count('scorer'), 1, 'ilk batch sonrası adım durur');
  assert.ok(repo.candidates().every((c) => c.status === 'new' && c.attempts === 0));
});

test('buildScorePrompt: kısa id + dil + kanca satırları, 3+3 kalibrasyon örneği, emojisiz kategori adları', () => {
  const { messages } = buildScorePrompt([{ id: 1, lang: 'tr', hook: 'Ahtapotun  üç\nkalbi var' }]);
  assert.equal(messages[1].content, 'Kancalar:\n1 [tr] Ahtapotun üç kalbi var');
  assert.match(messages[0].content, /ÇOK İLGİNÇ/);
  assert.match(messages[0].content, /SIKICI \/ TANIM/);
  // Kategori adları emojisiz yazılır (çıktı token'ı) ama hepsi 8 sabit değere geri çevrilir.
  assert.equal(CATEGORY_NAMES.length, CATEGORIES.length);
  CATEGORY_NAMES.forEach((name, i) => {
    assert.ok(messages[0].content.includes(name), name);
    assert.equal(normalizeCategory(name), CATEGORIES[i]);
  });
});
