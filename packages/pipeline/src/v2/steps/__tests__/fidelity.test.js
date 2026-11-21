// V2-05f: özel ad / sayı sadakati, bağımsız ilk cümle, başlık büyük harf kenar durumları,
// hassas konu elemesi (x), runner [rate] log satırları. Sahte LLM; gerçek LLM / ağ / DB yok.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash } from '../../../dedup/index.js';
import { formatRateEvent } from '../../../runners/v2-process.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { SCORE_SYSTEM_PROMPT } from '../../prompts/score.js';
import { REPAIR_MARKER, WRITE_SYSTEM_PROMPT } from '../../prompts/write.js';
import { cardText } from '../dedup-card.js';
import { checkFidelity, extractNameGroups } from '../fidelity.js';
import { decideBatch, parseScoreItem, runScore } from '../score.js';
import { runVerify } from '../verify.js';
import { checkWriteRules, firstSentenceIssue, normalizeTitle, runWrite } from '../write.js';
import { baseCandidate, deps, fakeLlm, parseScoreRequest } from './helpers.js';

const HOOK = 'a rehearsal for a 1998 planned raid to capture Osama bin Laden lasted four days and stretched across three time zones';
const SUPPORT = 'In 1998, the Central Intelligence Agency (CIA) of the United States planned to capture Osama bin Laden from Tarnak Farm, a compound in Afghanistan.';
const S = (claim) => ({ claim, verdict: 'supported' });

const WRONG_NAME = {
  title: 'Bin Laden baskınının provası dört gün sürdü',
  content: "1998'de CIA, Ömer bin Laden'i yakalamak için dört günlük bir prova yaptı. Prova üç saat dilimine yayıldı.",
  tags: ['cia', 'tarih', 'baskın'],
  read_time_sq: 15,
};
const RIGHT_NAME = { ...WRONG_NAME, content: "1998'de CIA, Osama bin Laden'i yakalamak için dört günlük bir prova yaptı. Prova üç saat dilimine yayıldı." };

function verifyRepo(draft) {
  return createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'f1',
        status: 'written',
        hook_text: HOOK,
        support_paragraph: SUPPORT,
        scores: {
          category: '📜 TARİH',
          draft: { ...draft, content_hash: contentHash(cardText(draft)), rewrites: 0 },
          dedup_card: { verdict: 'unique', reason: 'no_match' },
          draft_embedding: [1, 0, 0],
        },
      }),
    ],
  });
}

// --- Madde 1: özel ad ve sayı sadakati ------------------------------------------------------

test('sadakat: "Ömer bin Laden" kaynakta yok; "Osama bin Laden\'i" (ekli) ve "Usame bin Ladin" kabul', () => {
  const src = { hook: HOOK, support: SUPPORT };
  const bad = checkFidelity(WRONG_NAME, src);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.names, [{ text: 'Ömer bin Laden', missing: ['Ömer'] }]);
  assert.equal(checkFidelity(RIGHT_NAME, src).ok, true);
  assert.equal(checkFidelity({ ...WRONG_NAME, content: "Usame bin Ladin'i yakalama provası dört gün sürdü. ABD'li ajanlar 1998'de çalıştı." }, src).ok, true);
});

test('sadakat: kaynakta olmayan yıl/sayı yakalanır; ayırıcı farkı ve yazıyla sayı tolere edilir', () => {
  const src = { hook: HOOK, support: SUPPORT };
  const r = checkFidelity({ title: 'Prova dört gün sürdü', content: "Plan 1997'de yazıldı. Prova 4 gün ve 3 saat dilimi sürdü." }, src);
  assert.deepEqual(r.numbers, ['1997']);
  const ev = { hook: 'it sold 10,000 copies in 3.5 days', support: '' };
  assert.equal(checkFidelity({ title: 'Satış', content: '10.000 kopya 3,5 günde satıldı.' }, ev).ok, true);
});

test('sadakat: dry-run 4 kartlarındaki çeviriler yanlış alarm vermez', () => {
  const cochin = {
    title: "Cochin Yahudileri 16. yüzyıldan beri Hindistan'da yaşıyor",
    content: "Cochin Yahudileri, 16. yüzyıldan itibaren Hindistan'da yaşar. 1948'de çoğu İsrail'e göç etti. Günümüzde Kerala'da yalnızca 26 Yahudi kaldı.",
  };
  const cochinSrc = {
    hook: 'the Cochin Jews have had a settlement in India since the 16th century',
    support: 'Israel established itself as a nation in 1948 and most of the Cochin Jews emigrated. Only 26 Jews remain in Kerala.',
  };
  assert.deepEqual(checkFidelity(cochin, cochinSrc), { ok: true, names: [], numbers: [] });
  const bookland = {
    title: 'Bookland, barkodlarda kitapların geldiği hayali ülke',
    content: "Bookland, Avrupa Ürün Numarası (EAN) barkod sisteminde kitaplar için kullanılan hayali bir ülkedir. 1980'lerde 978 ön eki belirlendi.",
  };
  const booklandSrc = { hook: 'Bookland', support: 'Bookland exists solely in the European Article Number (EAN) system. The code "978" was designated in the 1980s.' };
  assert.equal(checkFidelity(bookland, booklandSrc).ok, true);
  const napoleon = { title: "Napolyon'u tavşanlar bozguna uğrattı", content: 'Tavşanlar 1807 yılında Napolyon ve adamlarına saldırdı. Bouvet Adası ise ıssızdır.' };
  assert.equal(checkFidelity(napoleon, { hook: 'In 1807 Napoleon organised a rabbit hunt', support: 'Bouvet Island' }).ok, true);
});

test('extractNameGroups: cümle başı tek kelime atlanır, çok kelimeli grup kontrol edilir', () => {
  const g = extractNameGroups("Tatbikat üç gün sürdü. Ömer bin Laden'i hedefliyordu. Bu Viyana sinagogu eskidir.");
  assert.deepEqual(g.map((x) => x.words), [['Ömer', 'bin', "Laden'i"], ['Viyana']]);
});

test('verify: "Ömer bin Laden" → onarım (gerekçe: bu ad kaynakta yok) → hâlâ yanlış → rejected:name_mismatch', async () => {
  const repo = verifyRepo(WRONG_NAME);
  const llm = fakeLlm({ verifier: { claims: [S('başlık'), S('prova')], title_match: true }, writer: [WRONG_NAME] });
  const stats = await runVerify(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 1);
  assert.equal(llm.count('verifier'), 1, 'onarım sonrası ad hâlâ yanlışsa ikinci doğrulama çağrısı yapılmaz');
  const fix = llm.calls.find((c) => c.role === 'writer').messages.at(-1).content;
  assert.ok(fix.includes(REPAIR_MARKER));
  assert.ok(fix.includes('bu ad kaynakta yok: Ömer bin Laden'), fix);
  const c = repo.get('f1');
  assert.equal(c.status, 'rejected');
  assert.equal(c.reject_reason, 'name_mismatch');
  assert.equal(stats.rejected.name_mismatch, 1);
  assert.equal(c.scores.verification.repair.for, 'name_mismatch');
  assert.deepEqual(c.scores.verification.rounds[0].fidelity.names[0].missing, ['Ömer']);
  assert.ok(c.scores.verification.repair.fidelity_after);
});

test('verify: yanlış ad onarımda düzelirse ("Osama bin Laden\'i") → verified', async () => {
  const repo = verifyRepo(WRONG_NAME);
  const llm = fakeLlm({ verifier: { claims: [S('başlık'), S('prova')], title_match: true }, writer: [RIGHT_NAME] });
  await runVerify(deps({ llm, repo }));
  assert.equal(llm.count('verifier'), 2);
  const c = repo.get('f1');
  assert.equal(c.status, 'verified');
  assert.equal(c.scores.draft.rewritten_for, 'name_mismatch');
});

test('verify: kaynakta olmayan yıl → onarım turu ("bu sayı kaynakta yok: 1997")', async () => {
  const withYear = { ...RIGHT_NAME, content: "1998'de CIA, Osama bin Laden'i yakalamak için prova yaptı. Plan 1997'de yazılmıştı." };
  const repo = verifyRepo(withYear);
  const llm = fakeLlm({ verifier: { claims: [S('başlık'), S('prova')], title_match: true }, writer: [RIGHT_NAME] });
  await runVerify(deps({ llm, repo }));
  const fix = llm.calls.find((c) => c.role === 'writer').messages.at(-1).content;
  assert.ok(fix.includes('bu sayı kaynakta yok: 1997'), fix);
  assert.equal(repo.get('f1').status, 'verified');
});

test('verify: ad ve sayılar kaynakta → ek onarım yok (tek doğrulama)', async () => {
  const repo = verifyRepo(RIGHT_NAME);
  const llm = fakeLlm({ verifier: { claims: [S('başlık'), S('prova')], title_match: true } });
  await runVerify(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 0);
  assert.equal(repo.get('f1').status, 'verified');
  assert.equal(repo.get('f1').scores.verification.rounds[0].fidelity, undefined);
});

test('yazar istemi: ad/sayı sadakati ve bağımsız ilk cümle kuralı var', () => {
  assert.match(WRITE_SYSTEM_PROMPT, /Osama bin Laden/);
  assert.match(WRITE_SYSTEM_PROMPT, /birim çevirme/);
  assert.match(WRITE_SYSTEM_PROMPT, /İlk cümle başlık okunmadan tek başına anlaşılır/);
});

// --- Madde 2: bağımsız ilk cümle ------------------------------------------------------------

const EZAN_BAD = {
  title: '1932-1950 yılları arasında ezan Türkçe okunmuş',
  content: "1932 yılında Türkiye Cumhuriyeti tarafından resmi olarak başlatıldı. 1950 yılına kadar bu uygulama devam etti. 1950'de Arapça ezan serbest bırakıldı.",
  tags: ['ezan', 'tarih'],
  read_time_sq: 15,
};
const EZAN_GOOD = {
  ...EZAN_BAD,
  content: "Türkiye'de ezan 1932'den 1950'ye kadar Türkçe okundu. Uygulama 1932'de resmi olarak başlatıldı. 1950'de Arapça ezan serbest bırakıldı.",
};

test('firstSentenceIssue: öznesiz ilk cümle yakalanır; konuyu adlandıran ilk cümle geçer', () => {
  assert.ok(firstSentenceIssue(EZAN_BAD));
  assert.equal(firstSentenceIssue(EZAN_GOOD), null);
  assert.equal(firstSentenceIssue({ title: 'Ahtapotun tam üç kalbi var', content: 'Ahtapotun vücudunda üç kalp çalışır. Kanı mavidir.' }), null);
  assert.equal(firstSentenceIssue({ title: 'Ulysses Grant\'in atı yolda kaydı', content: "Grant, 1863'te Chattanooga'ya yöneldi. Atı yolda kaydı." }), null);
  assert.ok(firstSentenceIssue({ title: 'Viyana\'daki sinagog Türk adını taşır', content: 'Bu yapı 1887\'de bitirildi. Adı Türk Tapınağı\'dır.' }));
});

test('runWrite: öznesiz ilk cümle → yeniden yazım (ihlal prompt\'ta) → geçer', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w1', status: 'scored', lang: 'tr', hook_text: "1932 - 1950 yılları arasında Türkiye'de ezan Türkçe okunmuştur.", support_paragraph: 'Türkçe ezan 1932 yılında başlatıldı ve 1950\'de bitti.', scores: { category: '📜 TARİH' } })],
  });
  const llm = fakeLlm({ writer: [EZAN_BAD, EZAN_GOOD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 2);
  assert.match(llm.calls.at(-1).messages.at(-1).content, /ilk cümle başlık okunmadan anlaşılmıyor/);
  assert.equal(repo.get('w1').status, 'written');
  assert.deepEqual(checkWriteRules(EZAN_GOOD), []);
});

// --- Madde 3: başlık büyük harf ---------------------------------------------------------------

test('normalizeTitle: ".bv", "iPhone", "eBay" büyütülmez; "hamlet" → "Hamlet"; kancada küçük harfli terim korunur', () => {
  assert.equal(normalizeTitle(".bv alan kodu ıssız Bouvet Adası'na ait."), ".bv alan kodu ıssız Bouvet Adası'na ait");
  assert.equal(normalizeTitle('iPhone ilk kez 2007’de satıldı'), 'iPhone ilk kez 2007’de satıldı');
  assert.equal(normalizeTitle('eBay ilk satışında bozuk bir lazer işaretçi sattı'), 'eBay ilk satışında bozuk bir lazer işaretçi sattı');
  assert.equal(normalizeTitle('hamlet en çok filme çekilen öykü'), 'Hamlet en çok filme çekilen öykü');
  assert.equal(normalizeTitle('#metoo etiketi 2017’de yayıldı'), '#metoo etiketi 2017’de yayıldı');
  assert.equal(normalizeTitle('x.com alan adı bir dönem PayPal’dı', { hook: 'that x.com was once PayPal' }), 'x.com alan adı bir dönem PayPal’dı');
  assert.equal(normalizeTitle('x.com alan adı bir dönem PayPal’dı'), 'X.com alan adı bir dönem PayPal’dı');
  assert.equal(normalizeTitle('ezan 18 yıl Türkçe okundu', { hook: 'ezan Türkçe okunmuştur' }), 'Ezan 18 yıl Türkçe okundu');
});

// --- Madde 5: hassas konu (x) ------------------------------------------------------------------

test('puanlayıcı: x:1 → rejected:sensitive (yazıma gitmez); x yoksa hassas değil', async () => {
  assert.equal(parseScoreItem({ i: 1, s: 9, r: 8, d: 0, c: 'TARİH', x: 1 }).value.sensitive, true);
  assert.equal(parseScoreItem({ i: 1, s: 9, r: 8, d: 0, c: 'TARİH' }).value.sensitive, false);
  const repo = createMemoryStepsRepo({
    candidates: [
      baseCandidate({ id: 'k', source_key: 'k1', hook_text: "Charlie Kirk's face was deepfaked onto memes after his assassination", scores: { dedup_hook: { verdict: 'unique' } } }),
      baseCandidate({ id: 'b', source_key: 'k2', hook_text: 'Bookland is the fictional country all books come from', scores: { dedup_hook: { verdict: 'unique' } } }),
    ],
  });
  const llm = fakeLlm({
    scorer: (req) => ({
      items: parseScoreRequest(req).map(({ id, hook }) => ({ i: id, s: 9, r: 8, d: 0, c: 'BİLİM', ...(hook.includes('Kirk') ? { x: 1 } : {}) })),
    }),
  });
  const stats = await runScore(deps({ llm, repo, config: { scoring: { batchSize: 10, passPercent: 100 } } }));
  assert.equal(repo.get('k').status, 'rejected');
  assert.equal(repo.get('k').reject_reason, 'sensitive');
  assert.equal(repo.get('k').scores.sensitive, true);
  assert.equal(repo.get('b').status, 'scored');
  assert.equal(stats.rejected.sensitive, 1);
  const d = decideBatch([{ cand: { id: 'z' }, score: { sensitive: true, is_definition: true, surprise: 9, tr_relevance: 9, category: 'x', wow: 9 } }], 10, 30);
  assert.equal(d[0].decision, 'sensitive');
});

test('puanlayıcı istemi: x alanı ve iki örnek (Kirk → x:1, Bookland → x yok)', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /- x \(hassas\)/);
  assert.match(SCORE_SYSTEM_PROMPT, /Charlie Kirk.*x:1/);
  assert.match(SCORE_SYSTEM_PROMPT, /Bookland.*x yok/);
});

// --- Madde 4: runner [rate] log satırları --------------------------------------------------------

test('formatRateEvent: bekleme / çok büyük istek / öğrenilen sınır satırları [rate] önekli', () => {
  const ctx = { role: 'scorer', provider: 'groq', model: 'qwen/qwen3.8-27b' };
  assert.equal(
    formatRateEvent({ type: 'rate_wait', ...ctx, delayMs: 41250, windowTokens: 7200, windowOutputTokens: 950, needInput: 860, needOutput: 400, tokensPerMinute: 8000, outputTokensPerMinute: 1000 }),
    '[rate] bekleme role=scorer groq/qwen/qwen3.8-27b süre=41.3sn pencere=7200/950çıktı istek=860+400 TPM=8000 OTPM=1000',
  );
  assert.match(formatRateEvent({ type: 'request_too_large', ...ctx, status: 413, metric: 'OTPM', limit: 1000, error: 'Request too large' }), /^\[rate\] çok büyük istek role=scorer .* status=413 OTPM limit=1000 :: Request too large$/);
  assert.equal(formatRateEvent({ type: 'rate_limit_learned', ...ctx, metric: 'OTPM', limit: 900, previous: 1000 }), '[rate] sınır öğrenildi role=scorer groq/qwen/qwen3.8-27b OTPM=900 (önceki=1000)');
});
