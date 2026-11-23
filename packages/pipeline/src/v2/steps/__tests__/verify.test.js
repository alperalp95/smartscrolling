import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash } from '../../../dedup/index.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { cardText } from '../dedup-card.js';
import { parseVerification, runVerify } from '../verify.js';
import { GOOD_CARD, baseCandidate, deps, exhausted, fakeLlm, userContent } from './helpers.js';

const SUPPORT = 'An octopus has three hearts. Its blood is blue because of a copper-rich protein.';
const S = (claim) => ({ claim, verdict: 'supported', why: 'var' });
const U = (claim) => ({ claim, verdict: 'unclear', why: 'kısmen' });
const X = (claim) => ({ claim, verdict: 'unsupported', why: 'yok' });

function repoWith() {
  return createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'v1',
        status: 'written',
        support_paragraph: SUPPORT,
        scores: {
          category: '🔬 BİLİM',
          wow: 8,
          draft: { ...GOOD_CARD, content_hash: contentHash(cardText(GOOD_CARD)), rewrites: 0 },
          dedup_card: { verdict: 'unique', reason: 'no_match' },
          draft_embedding: [1, 0, 0],
        },
      }),
    ],
  });
}

const FIXED = {
  ...GOOD_CARD,
  title: 'Ahtapotun üç ayrı kalbi vardır',
  content: 'Bu hayvanda üç kalp bulunur. Kanı mavidir. Bunun nedeni bakırlı bir proteindir.',
};

test('parseVerification: kararlar normalize edilir, tanınmayan → unclear, boş liste hata', () => {
  const r = parseVerification({
    claims: [S('a'), { claim: 'b', verdict: 'Destekleniyor' }, { claim: 'c', verdict: '???' }],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.claims.map((c) => c.verdict),
    ['supported', 'supported', 'unclear'],
  );
  assert.equal(r.verdict, 'unclear');
  assert.equal(parseVerification({ claims: [S('a'), X('b'), U('c')] }).verdict, 'unsupported');
  assert.equal(parseVerification({ claims: [] }).ok, false);
});

test('runVerify: hepsi supported → verified, verification kaydı', async () => {
  const repo = repoWith();
  const llm = fakeLlm({ verifier: [{ claims: [S('üç kalp'), S('mavi kan')] }] });
  await runVerify(deps({ llm, repo }));
  const c = repo.get('v1');
  assert.equal(c.status, 'verified');
  assert.equal(c.scores.verification.result, 'supported');
  assert.equal(c.scores.verification.rounds.length, 1);
  assert.equal(c.scores.verification.rounds[0].claims.length, 2);
  const u = userContent({ messages: llm.calls[0].messages });
  assert.ok(u.includes(SUPPORT) && u.includes(GOOD_CARD.title));
});

test('runVerify: unsupported → hemen red yok, tek onarım; onarımdan sonra yine unsupported → rejected:unsupported_claim', async () => {
  const repo = repoWith();
  const llm = fakeLlm({
    verifier: [{ claims: [S('üç kalp'), X('kalpler 9 tane')] }, { claims: [X('kalpler 9 tane')] }],
    writer: [FIXED],
  });
  await runVerify(deps({ llm, repo }));
  assert.equal(repo.get('v1').reject_reason, 'unsupported_claim');
  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 2);
});

test("runVerify: unclear → bir yeniden yazım (unclear iddialar prompt'ta) + yeniden doğrulama → verified", async () => {
  const repo = repoWith();
  const llm = fakeLlm({
    verifier: [
      { claims: [S('üç kalp'), U('kanı bütün vücuda gönderir')] },
      { claims: [S('üç kalp'), S('mavi kan')] },
    ],
    writer: [FIXED],
  });
  await runVerify(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 2);
  const fix = llm.calls.find((c) => c.role === 'writer').messages.at(-1).content;
  assert.ok(fix.includes('kanı bütün vücuda gönderir'));
  const c = repo.get('v1');
  assert.equal(c.status, 'verified');
  assert.equal(c.scores.draft.title, FIXED.title);
  assert.equal(c.scores.draft.content_hash, contentHash(cardText(FIXED)));
  assert.equal(c.scores.draft.rewrites, 1);
  assert.equal(c.scores.verification.rounds.length, 2);
  // ikinci doğrulama yeni kartı görür
  assert.ok(
    userContent({ messages: llm.calls.filter((x) => x.role === 'verifier')[1].messages }).includes(
      FIXED.title,
    ),
  );
});

test('runVerify: yeniden yazımdan sonra yine unclear → rejected:unclear_claim', async () => {
  const repo = repoWith();
  const llm = fakeLlm({
    verifier: [{ claims: [U('a')] }, { claims: [S('b'), U('c')] }],
    writer: [FIXED],
  });
  await runVerify(deps({ llm, repo }));
  assert.equal(repo.get('v1').reject_reason, 'unclear_claim');
  assert.equal(llm.count('verifier'), 2);
});

test('runVerify: yeniden yazım kod kurallarını ihlal ederse → write_rules (ek retry yok)', async () => {
  const repo = repoWith();
  const llm = fakeLlm({
    verifier: [{ claims: [U('a')] }],
    writer: [{ ...FIXED, content: 'Tek cümle.' }],
  });
  await runVerify(deps({ llm, repo }));
  assert.equal(repo.get('v1').reject_reason, 'write_rules');
  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 1);
});

test('runVerify: dedup_card işareti olmayan written adayı almaz; verifier tükenirse deferred', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'n',
        status: 'written',
        support_paragraph: SUPPORT,
        scores: { draft: GOOD_CARD },
      }),
    ],
  });
  const llm = fakeLlm({ verifier: [] });
  await runVerify(deps({ llm, repo }));
  assert.equal(llm.count('verifier'), 0);

  const repo2 = repoWith();
  const stats = await runVerify(
    deps({ llm: fakeLlm({ verifier: () => exhausted('verifier') }), repo: repo2 }),
  );
  assert.equal(stats.deferred, 1);
  assert.equal(repo2.get('v1').status, 'written');
  assert.equal(repo2.get('v1').attempts, 0);
});
