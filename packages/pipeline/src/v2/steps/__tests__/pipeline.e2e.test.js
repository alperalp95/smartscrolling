import assert from 'node:assert/strict';
// Uçtan uca durum geçişleri: 10 adaylık fixture → beklenen queued/rejected dağılımı.
import { test } from 'node:test';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { REPAIR_MARKER } from '../../prompts/write.js';
import { DEFAULT_STEP_NAMES, runSteps } from '../index.js';
import {
  GOOD_CARD,
  baseCandidate,
  deps,
  fakeLlm,
  fakeWikiFetch,
  parseScoreRequest,
  userContent,
} from './helpers.js';

const C = (id, hook, title) =>
  baseCandidate({
    id,
    source_key: `enwiki-dyk:e2e:${id}`,
    hook_text: hook,
    source_url: `https://en.wikipedia.org/wiki/${title}`,
  });

const CANDIDATES = [
  C('c1', 'the octopus has three hearts and blue blood', 'Octopus'),
  C('c2', 'octopus has blue blood and three hearts', 'Octopus'), // anlamca c1'in tekrarı
  C('c3', 'Paris is the capital city of France', 'Paris'),
  C('c4', 'Mount Everest is a very tall mountain in Asia', 'Mount_Everest'),
  C('c5', 'Jim Doe served as mayor of Smallville Ohio', 'Jim_Doe'),
  C('c6', 'honey never spoils even after thousands of years', 'Honey'),
  C('c7', 'bananas are berries but strawberries are not', 'Banana'),
  C('c8', 'Napoleon was once attacked by a horde of rabbits', 'Napoleon'),
  C('c9', 'Oxford University is older than the Aztec Empire', 'University_of_Oxford'),
  C('c10', 'Venus spins backwards compared to most planets', 'Venus'),
];

// surprise / tr_relevance / is_definition
const SCORES = {
  octopus: [9, 8, false],
  paris: [1, 5, true],
  everest: [3, 6, false],
  smallville: [7, 2, false],
  honey: [8, 7, false],
  bananas: [8, 6, false],
  napoleon: [8, 6, false],
  oxford: [9, 7, false],
  venus: [7, 5, false],
};

function scoreFor(hook) {
  const key = Object.keys(SCORES).find((k) => hook.toLowerCase().includes(k));
  const [surprise, tr, def] = SCORES[key];
  return { surprise, tr_relevance: tr, is_definition: def, category: 'Bilim', reason: 'test' };
}

const PAGES = {
  Octopus: [
    'The octopus is a soft-bodied, eight-limbed mollusc found in every ocean of the world.',
    'An octopus has three hearts: two pump blood through the gills and one pumps it through the body. Its blood is blue because it is rich in a copper protein.',
    'Octopus species are known for camouflage and for squirting ink when an octopus is threatened.',
  ],
  Honey: [
    'Honey is a sweet and viscous substance made by honey bees and some related insects.',
    'Bees produce honey by regurgitating nectar and storing honey in wax combs inside the hive.',
  ],
  Banana: [
    'A banana is an elongated, edible fruit produced by several kinds of large herbaceous plants.',
    'Botanically, bananas are berries, while strawberries are not berries because their seeds sit outside the fruit.',
  ],
  Napoleon: [
    'Napoleon Bonaparte was a French military and political leader who rose to prominence during the revolution.',
    'In 1807 Napoleon organised a rabbit hunt, and a horde of rabbits attacked Napoleon and his party instead of fleeing.',
  ],
  University_of_Oxford: [
    'The University of Oxford is a collegiate research university in Oxford, England.',
    'Teaching at Oxford existed as early as 1096, which makes the university older than the Aztec Empire founded in 1325.',
  ],
};

const CARDS = {
  octopus: GOOD_CARD,
  napoleon: {
    title: "Napolyon'u tavşanlar bozguna uğrattı",
    content:
      'Napolyon bir tavşan avı düzenledi. Tavşanlar kaçmak yerine Napolyon ve adamlarına saldırdı. Olay 1807 yılında yaşandı. Bu, imparatorun en tuhaf yenilgisi sayılır.',
    tags: ['napolyon', 'tarih', 'tavşan'],
    read_time_sq: 20,
  },
  oxford: {
    title: "Oxford, Aztek İmparatorluğu'ndan eski",
    content:
      "Oxford'da eğitim 1096 yılında başlamıştı. Aztek İmparatorluğu ise 1325'te kuruldu. Yani üniversite imparatorluktan iki yüz yıldan fazla eskidir. Bu da onu dünyanın en köklü okullarından biri yapar.",
    tags: ['oxford', 'tarih', 'üniversite'],
    read_time_sq: 20,
  },
  oxford_fixed: {
    title: "Oxford, Aztek İmparatorluğu'ndan daha eski",
    content:
      "Oxford'da eğitim 1096 yılında vardı. Aztek İmparatorluğu ise 1325'te kuruldu. Yani üniversite imparatorluktan daha eskidir.",
    tags: ['oxford', 'tarih', 'üniversite'],
    read_time_sq: 15,
  },
  bananas_bad: { title: 'Muz', content: 'Muz bir meyvedir.', tags: ['muz'], read_time_sq: 5 },
};

const S = (claim) => ({ claim, verdict: 'supported', why: 'kaynakta var' });

test('uçtan uca: 10 aday → 2 queued, 8 farklı red nedeni', async () => {
  const repo = createMemoryStepsRepo({ candidates: CANDIDATES });
  const llm = fakeLlm({
    scorer: (req) => ({
      items: parseScoreRequest(req).map(({ id, hook }) => ({ id, ...scoreFor(hook) })),
    }),
    writer: (req) => {
      const u = userContent(req);
      if (u.includes('octopus')) return CARDS.octopus;
      if (u.includes('Napoleon')) return CARDS.napoleon;
      if (u.includes('bananas')) return CARDS.bananas_bad;
      if (u.includes('Oxford'))
        return u.includes(REPAIR_MARKER) ? CARDS.oxford_fixed : CARDS.oxford;
      throw new Error(`beklenmeyen yazım isteği: ${u.slice(0, 80)}`);
    },
    verifier: (req) => {
      const u = userContent(req);
      if (u.includes(CARDS.octopus.title)) return { claims: [S('üç kalp'), S('mavi kan')] };
      if (u.includes(CARDS.napoleon.title)) {
        return {
          claims: [
            S('tavşan avı'),
            { claim: 'en tuhaf yenilgisi sayılır', verdict: 'unsupported', why: 'kaynakta yok' },
          ],
        };
      }
      if (u.includes(CARDS.oxford_fixed.title)) return { claims: [S('1096'), S('1325')] };
      if (u.includes(CARDS.oxford.title)) {
        return {
          claims: [
            S('1096'),
            { claim: 'en köklü okullarından biri', verdict: 'unclear', why: 'genelleme' },
          ],
        };
      }
      throw new Error('beklenmeyen doğrulama isteği');
    },
    judge: { sameFact: false },
  });

  const { stats } = await runSteps(
    DEFAULT_STEP_NAMES,
    deps({
      llm,
      repo,
      fetch: fakeWikiFetch(PAGES),
      config: {
        scoring: { batchSize: 15, passPercent: 50 },
        dedup: { duplicateThreshold: 0.92, grayZoneLow: 0.85 },
      },
    }),
    { limit: 50 },
  );

  const byKey = Object.fromEntries(
    repo.candidates().map((c) => [c.source_key.split(':').pop(), c]),
  );
  const outcome = Object.fromEntries(
    Object.entries(byKey).map(([k, c]) => [
      k,
      c.status === 'rejected' ? `rejected:${c.reject_reason}` : c.status,
    ]),
  );
  assert.deepEqual(outcome, {
    c1: 'queued',
    c2: 'rejected:duplicate_semantic',
    c3: 'rejected:definition',
    c4: 'rejected:low_surprise',
    c5: 'rejected:low_relevance',
    c6: 'rejected:no_support',
    c7: 'rejected:write_rules',
    c8: 'rejected:unsupported_claim',
    c9: 'queued',
    c10: 'rejected:below_cut',
  });

  const facts = repo.facts();
  assert.equal(facts.length, 2);
  assert.ok(
    facts.every((f) => f.status === 'queued' && f.verified === true && f.category === '🔬 BİLİM'),
  );
  assert.equal(byKey.c1.fact_id, facts.find((f) => f.source_key === 'enwiki-dyk:e2e:c1').id);
  assert.equal(
    facts.find((f) => f.source_key === 'enwiki-dyk:e2e:c9').title,
    CARDS.oxford_fixed.title,
  );

  // Puanlama tek çağrı (9 aday, batchSize 15); yazar: c1, c7×2, c8, c9 + onarım c8 (unsupported,
  // onarımdan sonra da unsupported → red) + onarım c9 (unclear → verified) = 7. Doğrulama: c1, c8×2, c9×2.
  assert.equal(llm.count('scorer'), 1);
  assert.equal(llm.count('writer'), 7);
  assert.equal(llm.count('verifier'), 5);
  assert.equal(stats.score.advanced, 5);
  assert.equal(stats.enqueue.advanced, 2);
  const { modelEvents, rateEvents, ...stepStats } = stats;
  assert.deepEqual(modelEvents, [], 'kapanan model yok');
  assert.deepEqual(rateEvents, { waits: 0, waitMs: 0, tooLarge: 0, learned: [] });
  assert.ok(Object.values(stepStats).every((s) => s.deferred === 0 && s.failed === 0));
});
