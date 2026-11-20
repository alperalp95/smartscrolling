// V2-05d: doğrulama verimi — yorum cümlesi yasağı, 2-4 cümle kuralı, tek onarım turu,
// doğrulayıcı istemi. Sahte LLM; gerçek LLM / ağ / DB çağrısı yok.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash } from '../../../dedup/index.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { VERIFY_SYSTEM_PROMPT } from '../../prompts/verify.js';
import { REPAIR_MARKER, WRITE_SYSTEM_PROMPT, buildRepairMessages, buildWritePrompt } from '../../prompts/write.js';
import { cardText } from '../dedup-card.js';
import { runVerify } from '../verify.js';
import { checkWriteRules, runWrite, writingLimits } from '../write.js';
import { GOOD_CARD, baseCandidate, deps, fakeLlm, userContent } from './helpers.js';

const SUPPORT = 'An octopus has three hearts. Its blood is blue because of a copper-rich protein.';
const S = (claim) => ({ claim, verdict: 'supported' });
const U = (claim, why = 'kısmen') => ({ claim, verdict: 'unclear', why });
const X = (claim, why = 'kaynakta yok') => ({ claim, verdict: 'unsupported', why });

const COMMENTARY = {
  ...GOOD_CARD,
  content: 'Ahtapotun üç ayrı kalbi vardır. Kanı bakırlı bir protein yüzünden mavidir. Bu da doğanın ne kadar yaratıcı olduğunu gösteriyor.',
};
const REPAIRED = {
  ...GOOD_CARD,
  content: 'Ahtapotun üç ayrı kalbi vardır. Kanı bakırlı bir protein yüzünden mavidir.',
};

function verifyRepo(draft = COMMENTARY) {
  return createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'v1',
        status: 'written',
        support_paragraph: SUPPORT,
        scores: {
          category: '🔬 BİLİM',
          draft: { ...draft, content_hash: contentHash(cardText(draft)), rewrites: 0 },
          dedup_card: { verdict: 'unique', reason: 'no_match' },
          draft_embedding: [1, 0, 0],
        },
      }),
    ],
  });
}

const verifierCalls = (llm) => llm.calls.filter((c) => c.role === 'verifier');
const writerCalls = (llm) => llm.calls.filter((c) => c.role === 'writer');

// --- Madde 2: onarım turu ----------------------------------------------------------------

test('madde 2 · unsupported → onarım (iddia + gerekçe prompt\'ta) → supported → verified', async () => {
  const repo = verifyRepo();
  const llm = fakeLlm({
    verifier: [
      { claims: [S('üç kalp'), S('mavi kan'), X('doğa yaratıcıdır', 'yorum, kanıtta yok')] },
      { claims: [S('üç kalp'), S('mavi kan')] },
    ],
    writer: [REPAIRED],
  });
  const stats = await runVerify(deps({ llm, repo }));

  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 2);
  const fix = writerCalls(llm)[0].messages.at(-1).content;
  assert.ok(fix.includes(REPAIR_MARKER));
  assert.ok(fix.includes('doğa yaratıcıdır') && fix.includes('yorum, kanıtta yok'), 'iddia ve gerekçe onarım mesajında');
  assert.ok(!fix.includes('üç kalp'), 'desteklenen iddia onarıma gönderilmez');
  assert.match(fix, /yeni bilgi, yorum ya da genelleme ekleme/i);
  // önceki kart assistant mesajı olarak verilir
  assert.ok(writerCalls(llm)[0].messages.at(-2).content.includes('doğanın ne kadar yaratıcı'));

  const c = repo.get('v1');
  assert.equal(c.status, 'verified');
  assert.equal(stats.advanced, 1);
  assert.equal(c.scores.draft.content, REPAIRED.content);
  assert.equal(c.scores.draft.content_hash, contentHash(cardText(REPAIRED)));
  assert.equal(c.scores.draft.rewrites, 1);
  assert.equal(c.scores.draft.rewritten_for, 'unsupported');
  assert.equal(c.scores.verification.result, 'supported');
  assert.equal(c.scores.verification.rounds.length, 2);
  assert.deepEqual(c.scores.verification.repair, { for: 'unsupported', claims: ['doğa yaratıcıdır'] });
  // ikinci doğrulama onarılmış kartı görür
  assert.ok(!userContent({ messages: verifierCalls(llm)[1].messages }).includes('yaratıcı'));
});

test('madde 2 · unsupported → onarım → yine unsupported → rejected:unsupported_claim (ikinci onarım yok)', async () => {
  const repo = verifyRepo();
  const llm = fakeLlm({
    verifier: [{ claims: [S('üç kalp'), X('doğa yaratıcıdır')] }, { claims: [S('üç kalp'), X('kanı yeşildir')] }],
    writer: [REPAIRED, REPAIRED],
  });
  await runVerify(deps({ llm, repo }));
  const c = repo.get('v1');
  assert.equal(c.status, 'rejected');
  assert.equal(c.reject_reason, 'unsupported_claim');
  assert.equal(llm.count('writer'), 1, 'en fazla 1 onarım');
  assert.equal(llm.count('verifier'), 2);
  assert.equal(c.scores.verification.rounds.length, 2);
  assert.equal(c.scores.draft.content, REPAIRED.content, 'onarılmış taslak kayıtta');
});

test('madde 2 · unclear + unsupported birlikte → tek onarım turu; ikinci turda sadece unclear → rejected:unclear_claim', async () => {
  const repo = verifyRepo();
  const llm = fakeLlm({
    verifier: [{ claims: [X('doğa yaratıcıdır'), U('kan vücuda gider')] }, { claims: [S('üç kalp'), U('kan mavidir')] }],
    writer: [REPAIRED],
  });
  await runVerify(deps({ llm, repo }));
  const fix = writerCalls(llm)[0].messages.at(-1).content;
  assert.ok(fix.includes('doğa yaratıcıdır') && fix.includes('kan vücuda gider'), 'iki türden iddia tek mesajda');
  assert.equal(repo.get('v1').reject_reason, 'unclear_claim');
  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 2);
});

test('madde 2 · sadece unclear → aynı onarım turu → supported → verified (rewritten_for=unclear)', async () => {
  const repo = verifyRepo();
  const llm = fakeLlm({ verifier: [{ claims: [S('üç kalp'), U('kan vücuda gider')] }, { claims: [S('üç kalp')] }], writer: [REPAIRED] });
  await runVerify(deps({ llm, repo }));
  const c = repo.get('v1');
  assert.equal(c.status, 'verified');
  assert.equal(c.scores.draft.rewritten_for, 'unclear');
});

test('madde 2 · başlık desteklenmiyorsa da onarım; yeni başlık yeniden doğrulanır', async () => {
  const badTitle = { ...REPAIRED, title: 'Ahtapot dünyanın en zeki canlısı' };
  const repo = verifyRepo(badTitle);
  const llm = fakeLlm({
    verifier: [{ claims: [X('Ahtapot dünyanın en zeki canlısı', 'kanıtta yok'), S('üç kalp')] }, { claims: [S('üç kalp'), S('mavi kan')] }],
    writer: [REPAIRED],
  });
  await runVerify(deps({ llm, repo }));
  const fix = writerCalls(llm)[0].messages.at(-1).content;
  assert.match(fix, /başlıktaysa başlığı da düzelt/);
  const c = repo.get('v1');
  assert.equal(c.status, 'verified');
  assert.equal(c.scores.draft.title, REPAIRED.title);
  assert.ok(userContent({ messages: verifierCalls(llm)[1].messages }).includes(`Başlık: ${REPAIRED.title}`));
});

test('madde 2 · onarım skip dönerse → writer_skip; onarım 2-4 cümle kuralını bozarsa → write_rules (ikinci doğrulama yok)', async () => {
  const r1 = verifyRepo();
  const l1 = fakeLlm({ verifier: [{ claims: [X('a')] }], writer: [{ skip: true, reason: 'geriye ilginç bir şey kalmadı' }] });
  await runVerify(deps({ llm: l1, repo: r1 }));
  assert.equal(r1.get('v1').reject_reason, 'writer_skip');
  assert.equal(r1.get('v1').scores.writer_skip, 'geriye ilginç bir şey kalmadı');
  assert.equal(l1.count('verifier'), 1);

  const r2 = verifyRepo();
  const l2 = fakeLlm({ verifier: [{ claims: [X('a')] }], writer: [{ ...REPAIRED, content: 'Ahtapotun üç kalbi vardır.' }] });
  await runVerify(deps({ llm: l2, repo: r2 }));
  assert.equal(r2.get('v1').reject_reason, 'write_rules');
  assert.ok(r2.get('v1').scores.write_violations.some((v) => v.includes('2-4 cümle')));
  assert.equal(l2.count('verifier'), 1);
});

test('madde 2 · hepsi supported → onarım yok, tek doğrulama', async () => {
  const repo = verifyRepo(REPAIRED);
  const llm = fakeLlm({ verifier: [{ claims: [S('üç kalp'), S('mavi kan')] }] });
  await runVerify(deps({ llm, repo }));
  assert.equal(repo.get('v1').status, 'verified');
  assert.equal(llm.count('writer'), 0);
  assert.equal(repo.get('v1').scores.verification.repair, undefined);
});

test('madde 2 · onarım mesajı: iddialar, gerekçeler, cümle aralığı config\'ten', () => {
  const msgs = buildRepairMessages('{"title":"x"}', [X('A iddiası', 'tarih yok'), U('B iddiası', '')], { minSentences: 3, maxSentences: 5 });
  assert.equal(msgs[0].role, 'assistant');
  assert.equal(msgs[0].content, '{"title":"x"}');
  const text = msgs[1].content;
  assert.ok(text.includes('"A iddiası" (kaynakta yok: tarih yok)'));
  assert.ok(text.includes('"B iddiası" (kaynakta açık değil)'));
  assert.ok(text.includes('3-5 cümle'));
});

// --- Madde 1: yazar kuralı ---------------------------------------------------------------

test('madde 1 · cümle sayısı 2-4: 1 ve 5 cümle ihlal, 2 ve 4 cümle geçer', () => {
  const card = (content) => ({ ...GOOD_CARD, content });
  assert.ok(checkWriteRules(card('Ahtapotun üç kalbi var.')).some((v) => v.includes('2-4 cümle')));
  assert.deepEqual(checkWriteRules(card('Ahtapotun üç kalbi var. Kanı mavidir.')), []);
  assert.deepEqual(checkWriteRules(card('Bir cümle ış. İki cümle. Üç cümle. Dört cümle.')), []);
  assert.ok(checkWriteRules(card('Bir cümle ış. İki. Üç. Dört. Beş.')).some((v) => v.includes('(şu an 5)')));
});

test('madde 1 · cümle sınırı config writing.minSentences / maxSentences\'tan gelir (runWrite)', async () => {
  assert.deepEqual(writingLimits({}), { minSentences: 2, maxSentences: 4 });
  assert.deepEqual(writingLimits({ writing: { minSentences: 3, maxSentences: 5 } }), { minSentences: 3, maxSentences: 5 });
  assert.deepEqual(writingLimits({ writing: { minSentences: 'x' } }), { minSentences: 2, maxSentences: 4 });

  const twoSentences = { ...GOOD_CARD, content: 'Ahtapotun üç kalbi var. Kanı mavidir.' };
  const repo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w1', status: 'scored', support_paragraph: SUPPORT, scores: { category: '🔬 BİLİM' } })],
  });
  const config = { writing: { minSentences: 3, maxSentences: 5 } };
  const llm = fakeLlm({ writer: [twoSentences, twoSentences] });
  await runWrite(deps({ llm, repo, config }));
  assert.equal(repo.get('w1').reject_reason, 'write_rules', '3-5 ayarında 2 cümle ihlal');
  assert.ok(llm.calls[0].messages[0].content.includes('content: 3-5 cümle'), 'istem config aralığını söyler');
  assert.ok(llm.calls[1].messages.at(-1).content.includes('gövde 3-5 cümle olmalı (şu an 2)'));

  // varsayılan (2-4) ile aynı kart geçer
  const repo2 = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w2', status: 'scored', support_paragraph: SUPPORT, scores: { category: '🔬 BİLİM' } })],
  });
  await runWrite(deps({ llm: fakeLlm({ writer: [twoSentences] }), repo: repo2 }));
  assert.equal(repo2.get('w2').status, 'written');
});

test('madde 1 · yazar istemi: 2-4 cümle, yorum/genelleme yasağı, 2 kötü + 2 iyi örnek', () => {
  assert.match(WRITE_SYSTEM_PROMPT, /content: 2-4 cümle/);
  assert.match(WRITE_SYSTEM_PROMPT, /Her cümle kancadaki ya da kaynak paragraftaki bir olguyu aktarır/);
  assert.match(WRITE_SYSTEM_PROMPT, /Yorum, genelleme, çıkarım, değerlendirme cümlesi yasak/);
  for (const phrase of ['bu da gösteriyor ki', 'nadir bir örnek', 'ilginç bir şekilde', 'hızla yayıldı']) {
    assert.ok(WRITE_SYSTEM_PROMPT.includes(phrase), phrase);
  }
  assert.equal(WRITE_SYSTEM_PROMPT.match(/^Kötü \(yorumlu\):/gm)?.length, 2);
  assert.equal(WRITE_SYSTEM_PROMPT.match(/^İyi \(olgusal\):/gm)?.length, 2);
  // iyi örnekler de 2-4 cümle kuralına uyar
  for (const line of WRITE_SYSTEM_PROMPT.match(/^İyi \(olgusal\): "(.*)"$/gm)) {
    const content = line.replace(/^İyi \(olgusal\): "/, '').replace(/"$/, '');
    assert.deepEqual(checkWriteRules({ title: 'Geçerli bir başlık örneği', content }), [], content);
  }
  const { messages } = buildWritePrompt({ hook: 'h', support: 's', category: 'c', minSentences: 3, maxSentences: 3 });
  assert.match(messages[0].content, /content: 3 cümle/);
});

// --- Madde 4: doğrulayıcı istemi -----------------------------------------------------------

test('madde 4 · doğrulayıcı istemi: açık ya da doğrudan çıkarılabilir = supported; eş anlam, birim/çeviri, isimden türetme; 2 örnek', () => {
  assert.match(VERIFY_SYSTEM_PROMPT, /açıkça ya da doğrudan çıkarılabilir/);
  assert.match(VERIFY_SYSTEM_PROMPT, /Eş anlamlı ifade/);
  assert.match(VERIFY_SYSTEM_PROMPT, /birim\/çeviri farkı/);
  assert.match(VERIFY_SYSTEM_PROMPT, /Adi \+ Dassler/);
  assert.match(VERIFY_SYSTEM_PROMPT, /unsupported: SADECE kanıtta olmayan yeni bir olgu, sayı, tarih, isim, neden-sonuç ya da yorum/);
  assert.equal(VERIFY_SYSTEM_PROMPT.match(/^Kanıt: .* · İddia: .* → (supported|unsupported)/gm)?.length, 2);
});
