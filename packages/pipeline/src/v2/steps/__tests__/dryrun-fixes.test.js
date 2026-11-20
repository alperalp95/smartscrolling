// V2-05c: ilk gerçek dry-run bulguları için adım testleri (sahte LLM, bellek içi repo, fixture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LlmOutputError } from '../../../llm/index.js';
import { formatLlmEvent } from '../../../runners/v2-process.js';
import { contentHash } from '../../../dedup/index.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { VERIFY_SYSTEM_PROMPT } from '../../prompts/verify.js';
import { SCORE_SYSTEM_PROMPT } from '../../prompts/score.js';
import { WRITE_SYSTEM_PROMPT } from '../../prompts/write.js';
import { cardText, runDedupCard } from '../dedup-card.js';
import { runDedupHook } from '../dedup-hook.js';
import { runSteps } from '../index.js';
import { decideBatch, runScore, scoringThresholds } from '../score.js';
import { MAX_SUPPORT_CHARS, hookTerms, selectSupport } from '../support-parse.js';
import { runVerify } from '../verify.js';
import { checkWriteRules, isTitleCase, runWrite } from '../write.js';
import { GOOD_CARD, baseCandidate, bowEmbed, deps, exhausted, fakeLlm, parseScoreRequest, userContent } from './helpers.js';

const passedHook = { dedup_hook: { verdict: 'unique', reason: 'no_match' } };

function outputError(role) {
  return new LlmOutputError(role, {
    attempts: [
      { provider: 'groq', model: 'qwen', kind: 'invalid_json', reason: 'invalid_json: tamir sonrası da geçersiz JSON' },
      { provider: 'cloudflare', model: 'qwen3', kind: 'truncated', reason: 'truncated: finish_reason=length' },
    ],
  });
}

function scoreRepo(n) {
  return createMemoryStepsRepo({
    candidates: Array.from({ length: n }, (_, i) =>
      baseCandidate({ id: `s${i + 1}`, source_key: `k${i + 1}`, hook_text: `hook number ${i + 1}`, scores: passedHook }),
    ),
  });
}

const allGood = (req) => ({
  items: parseScoreRequest(req).map(({ id }) => ({ id, surprise: 8, tr_relevance: 8, is_definition: false, category: 'Bilim' })),
});

// --- Madde 1: zincir / hata nedeni -------------------------------------------------------

test('madde 1 · puanlayıcı JSON hatası (LlmOutputError) tükenme sayılmaz: batch hata sayılır, sonraki batch puanlanır', async () => {
  const repo = scoreRepo(4);
  const llm = fakeLlm({ scorer: (req, n) => (n === 1 ? outputError('scorer') : allGood(req)) });
  const logs = [];
  const stats = await runScore(deps({ llm, repo, log: (m) => logs.push(m), config: { scoring: { batchSize: 2, passPercent: 50 } } }));
  assert.equal(llm.count('scorer'), 2, 'ikinci batch de denendi');
  assert.equal(stats.deferred, 0);
  assert.equal(stats.exhaustedRole, null);
  assert.equal(stats.failed, 2);
  assert.equal(repo.get('s1').attempts, 1);
  assert.equal(repo.get('s1').status, 'new');
  assert.equal(repo.get('s3').status, 'scored');
  assert.ok(logs.some((l) => /s1 hata \(deneme 1\/3\): LLM çıktısı kullanılamadı/.test(l)));
});

test('madde 1 · zincir tükenince neden (model + hata türü + mesaj) log satırına ve stats.exhaustedReason\'a yazılır', async () => {
  const repo = scoreRepo(3);
  const logs = [];
  const llm = fakeLlm({ scorer: () => exhausted('scorer') });
  const stats = await runScore(deps({ llm, repo, log: (m) => logs.push(m) }));
  assert.equal(stats.deferred, 3);
  assert.equal(stats.exhaustedReason, 'fake/fake: quota');
  const line = logs.find((l) => l.includes('LLM zinciri tükendi'));
  assert.match(line, /role=scorer/);
  assert.match(line, /Neden: fake\/fake: quota/);
});

test('madde 1 · runner LLM olayını tek satıra çevirir (hata nedeni, anahtar yok)', () => {
  const line = formatLlmEvent({
    type: 'provider_failed',
    role: 'scorer',
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    kind: 'retryable',
    status: 429,
    error: 'HTTP 429: Rate limit reached on tokens per minute (TPM)',
  });
  assert.equal(
    line,
    '[llm] provider_failed role=scorer groq/qwen/qwen3.8-27b kind=retryable status=429 :: HTTP 429: Rate limit reached on tokens per minute (TPM)',
  );
  assert.match(formatLlmEvent({ type: 'truncated', role: 'verifier', provider: 'cloudflare', model: 'gemma', maxTokens: 1500, outputTokens: 1500 }), /maxTokens=1500 çıktı=1500/);
});

test('madde 1 · hakem çıktısı bozuksa aday "tekrar" (judge_error) sayılmaz, hata sayılır', async () => {
  const vecAt = (cos) => [cos, Math.sqrt(1 - cos * cos), 0];
  const repo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'a', source_key: 'k-a', hook_text: 'kanca a' })],
    facts: [{ id: 'f1', title: 'T', content: 'C', embedding: vecAt(0.88), status: 'published' }],
  });
  const llm = fakeLlm({ embed: (texts) => texts.map(() => vecAt(1)), judge: () => outputError('judge') });
  const stats = await runDedupHook(deps({ llm, repo }));
  const a = repo.get('a');
  assert.equal(a.status, 'new');
  assert.equal(a.attempts, 1);
  assert.equal(a.scores?.dedup_hook, undefined);
  assert.equal(stats.failed, 1);
});

// --- Madde 2 + 9: rol başına maxTokens ve eşikler config'ten ------------------------------

test('madde 2/9 · maxTokens config.roles.<rol>.maxTokens\'tan gelir (scorer, writer, verifier, judge)', async () => {
  const config = {
    scoring: { batchSize: 15, passPercent: 30 },
    roles: { scorer: { maxTokens: 1111 }, writer: { maxTokens: 2222 }, verifier: { maxTokens: 3333 }, judge: { maxTokens: 44 } },
  };
  const seen = {};
  const capture = (role, out) => (req) => {
    seen[role] = req.maxTokens;
    return typeof out === 'function' ? out(req) : out;
  };
  await runScore(deps({ llm: fakeLlm({ scorer: capture('scorer', allGood) }), repo: scoreRepo(1), config }));

  const wrepo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w1', status: 'scored', support_paragraph: 'An octopus has three hearts.', scores: { category: '🔬 BİLİM' } })],
  });
  await runWrite(deps({ llm: fakeLlm({ writer: capture('writer', GOOD_CARD) }), repo: wrepo, config }));

  const vrepo = verifyRepo();
  await runVerify(deps({ llm: fakeLlm({ verifier: capture('verifier', { claims: [{ claim: 'a', verdict: 'supported' }] }) }), repo: vrepo, config }));

  const vecAt = (cos) => [cos, Math.sqrt(1 - cos * cos), 0];
  const jrepo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'j', source_key: 'k-j', hook_text: 'kanca' })],
    facts: [{ id: 'f1', title: 'T', content: 'C', embedding: vecAt(0.88), status: 'published' }],
  });
  await runDedupHook(deps({ llm: fakeLlm({ embed: (t) => t.map(() => vecAt(1)), judge: capture('judge', { same_fact: false }) }), repo: jrepo, config }));

  assert.deepEqual(seen, { scorer: 1111, writer: 2222, verifier: 3333, judge: 44 });
});

test('madde 9 · scoring.minSurprise / minTrRelevance config\'ten kullanılır', async () => {
  assert.deepEqual(scoringThresholds({}), { minSurprise: 6, minTrRelevance: 4 });
  assert.deepEqual(scoringThresholds({ scoring: { minSurprise: 8, minTrRelevance: 5 } }), { minSurprise: 8, minTrRelevance: 5 });
  const mk = (id, s, r) => ({ cand: { id }, score: { surprise: s, tr_relevance: r, is_definition: false, category: '🔬 BİLİM', wow: 0.6 * s + 0.4 * r } });
  const out = decideBatch([mk('a', 7, 9), mk('b', 9, 4.5), mk('c', 9, 9)], 3, 100, { minSurprise: 8, minTrRelevance: 5 });
  const d = Object.fromEntries(out.map((e) => [e.cand.id, e.decision]));
  assert.deepEqual(d, { a: 'low_surprise', b: 'low_relevance', c: 'scored' });

  const repo = scoreRepo(2);
  const llm = fakeLlm({
    scorer: [{ items: [{ id: 1, surprise: 7, tr_relevance: 9, is_definition: false, category: 'Bilim' }, { id: 2, surprise: 9, tr_relevance: 9, is_definition: false, category: 'Bilim' }] }],
  });
  await runScore(deps({ llm, repo, config: { scoring: { batchSize: 15, passPercent: 100, minSurprise: 8 } } }));
  assert.equal(repo.get('s1').reject_reason, 'low_surprise');
  assert.equal(repo.get('s2').status, 'scored');
});

// --- Madde 3: destek paragrafı ------------------------------------------------------------

const GORBY_HOOK = 'Raisa Gorbacheva is buried in Novodevichy Cemetery, Moscow\'s third-most popular tourist destination';

test('madde 3 · hookTerms: sayılar (yazıyla da) ve özel adlar "anchor"; ilk kelime özel ad sayılmaz', () => {
  const terms = Object.fromEntries(hookTerms('a rehearsal for a 1998 raid on Tarnak Farm lasted four days').map((t) => [t.key, t.anchor]));
  assert.equal(terms['1998'], true);
  assert.equal(terms['4'], true, '"four" → 4');
  assert.equal(terms.tarna, true);
  assert.equal(terms.farm, true);
  assert.equal(terms.rehea, false);
  assert.equal(Object.fromEntries(hookTerms('Kurrik studied blood').map((t) => [t.key, t.anchor])).kurri, false);
});

test('madde 3 · paragraf seçimi: sayı/özel ad eşleşmesi genel kelime örtüşmesinden ağır basar', () => {
  // Eski algoritma (ağırlıksız) ikisini eşit puanlayıp genel paragrafı da ekliyordu ([1,2]).
  const hook = 'the ethnographer Helmi Kurrik wrote a thesis in 1938 about blood in food';
  const filler = 'The Estonian National Museum collected folk costumes from many villages across the country for decades.';
  const generic = 'An ethnographer often wrote a thesis about food traditions, and food was a common thesis topic for every ethnographer.';
  const specific = 'Helmi Kurrik defended her work in 1938 at Tartu, writing on blood sausages.';
  const r = selectSupport([filler, generic, specific], hook);
  assert.ok(r);
  assert.deepEqual(r.indexes, [2]);
  assert.equal(r.text, specific);
  assert.equal(r.mainFact, true);
});

test('madde 3 · en iyi paragraf kancanın sayısını içermiyorsa ikinci aday (sayıyı içeren) eklenir, toplam ≤ 1.500', () => {
  const hook = 'a rehearsal for a 1998 planned raid to capture Osama bin Laden lasted four days and stretched across three time zones';
  const lead = 'In 1998, the CIA planned to capture Osama bin Laden from Tarnak Farm, a compound in Afghanistan. The plan for the raid was drafted in 1997.';
  const other = 'Tarnak Farm was a compound just outside Kandahar Airport. It consisted of roughly 80 buildings surrounded by a wall.';
  const longFiller = 'Officials discussed legal authorities and the risks of the operation at great length in many meetings. '.repeat(12);
  const rehearsal = `${longFiller}From May 20 to 24, the CIA ran a final rehearsal of the operation. It spread over three time zones and brought in personnel from the region.`;
  const r = selectSupport([lead, other, rehearsal], hook);
  assert.deepEqual(r.indexes, [0, 2]);
  assert.ok(r.text.includes('final rehearsal'), 'ana olgu (tatbikat) metinde');
  assert.ok(r.text.includes('In 1998'), 'en iyi paragraf korunur');
  assert.ok(r.text.length <= MAX_SUPPORT_CHARS);
  assert.ok(!r.text.includes(longFiller.trim()), 'ikinci adayın sadece ilgili cümleleri alınır');
  assert.equal(r.mainFact, true);
});

test('madde 3 · ana olgu en iyi paragrafta varsa ikinci paragraf eklenmez (kancayla ilgisiz bağlam taşınmaz)', () => {
  const p1 = 'Raisa Gorbacheva died on 20 September 1999. She is buried at Novodevichy Cemetery in Moscow.';
  const p2 = 'Novodevichy Cemetery is one of the most popular tourist destinations in Moscow.';
  const p3 = 'In July 1999, Raisa Gorbacheva was diagnosed with leukemia and was treated in Germany.';
  const r = selectSupport([p3, p1, p2], GORBY_HOOK);
  assert.ok(r.indexes.includes(1));
  assert.ok(!r.indexes.includes(0), 'hastalık paragrafı eklenmez');
});

// --- Madde 4: doğrulama kanıtı = kanca + paragraf -----------------------------------------

function verifyRepo(hook = GORBY_HOOK) {
  const draft = { ...GOOD_CARD, content_hash: contentHash(cardText(GOOD_CARD)), rewrites: 0 };
  return createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'v1',
        status: 'written',
        hook_text: hook,
        support_paragraph: 'She is buried at Novodevichy Cemetery in Moscow.',
        scores: { category: '👤 BİYOGRAFİ', draft, dedup_card: { verdict: 'unique', reason: 'no_match' }, draft_embedding: [1, 0, 0] },
      }),
    ],
  });
}

test('madde 4 · doğrulayıcıya KANCA + DESTEK PARAGRAFI birlikte verilir; sistem istemi ikisini de kanıt sayar', async () => {
  const repo = verifyRepo();
  const llm = fakeLlm({ verifier: { claims: [{ claim: 'turistik mezarlık', verdict: 'supported' }] } });
  await runVerify(deps({ llm, repo }));
  const u = userContent({ messages: llm.calls[0].messages });
  assert.match(u, /^KANCA:\nRaisa Gorbacheva is buried in Novodevichy Cemetery, Moscow's third-most popular tourist destination/);
  assert.match(u, /DESTEK PARAGRAFI:\nShe is buried at Novodevichy Cemetery in Moscow\./);
  assert.match(u, /KART:\nBaşlık: /);
  assert.ok(u.indexOf('KANCA') < u.indexOf('DESTEK PARAGRAFI') && u.indexOf('DESTEK PARAGRAFI') < u.indexOf('KART'));
  assert.match(VERIFY_SYSTEM_PROMPT, /KANCA ya da DESTEK PARAGRAFI'ndan biri/);
  assert.match(VERIFY_SYSTEM_PROMPT, /en fazla 6 atomik/);
  assert.equal(repo.get('v1').status, 'verified');
});

// --- Madde 5-7: yazar kuralları -----------------------------------------------------------

test('madde 5/6 · yazar istemi: kanca odaklı, ilgisiz ayrıntı yok, yabancı terim Türkçe + parantez, ilk cümle yabancı terimle başlamaz', () => {
  assert.match(WRITE_SYSTEM_PROMPT, /kancadaki şaşırtıcı olgunun etrafında kalır/);
  assert.match(WRITE_SYSTEM_PROMPT, /Kancayla ilgisi olmayan ayrıntı/);
  assert.match(WRITE_SYSTEM_PROMPT, /Yabancı terimleri Türkçeye çevir; gerekirse orijinalini .* parantezde/);
  assert.match(WRITE_SYSTEM_PROMPT, /İlk cümle yabancı bir terimle ya da kısaltmayla başlamaz/);
  assert.match(WRITE_SYSTEM_PROMPT, /zorla din değiştirtme/);
});

test('madde 7 · "Her Kelimesi Büyük" başlık kural ihlali → tek yeniden yazım; özel adlı cümle düzeni geçer', async () => {
  assert.equal(isTitleCase('Kafatası Elektrik Tedavisi Uykusuzluğu Hafifletebilir'), true);
  assert.equal(isTitleCase('Kochin Yahudileri 16. Yüzyıldan Bugüne'), true);
  assert.equal(isTitleCase('Raisa Gorbaçova Moskova’nın turistik mezarlığında'), false);
  assert.equal(isTitleCase('CIA, bin Ladin baskınını üç saat diliminde prova etti'), false);
  assert.equal(isTitleCase(GOOD_CARD.title), false);
  assert.ok(checkWriteRules({ ...GOOD_CARD, title: 'Ahtapotun Üç Ayrı Kalbi Var' }).some((v) => v.includes('cümle düzeninde')));
  assert.match(WRITE_SYSTEM_PROMPT, /Türkçe cümle düzeni/);

  const repo = createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w1', status: 'scored', support_paragraph: 'An octopus has three hearts.', scores: { category: '🔬 BİLİM' } })],
  });
  const llm = fakeLlm({ writer: [{ ...GOOD_CARD, title: 'Ahtapotun Üç Ayrı Kalbi Var' }, GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 2);
  assert.match(llm.calls[1].messages.at(-1).content, /cümle düzeninde/);
  assert.equal(repo.get('w1').scores.draft.title, GOOD_CARD.title);
});

// --- Madde 8: puanlayıcı kalibrasyonu -----------------------------------------------------

test('madde 8 · kalibrasyon: "tedavi/ürün şunu yapar" ve olağan haber düşük; zıtlık/rekor/yanlış bilinen yüksek', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /zıtlık, rekor, beklenmedik bağlantı, yaygın yanlış bilinen gerçek/);
  assert.match(SCORE_SYSTEM_PROMPT, /"X şunu tedavi eder \/ şunu yapar/);
  assert.match(SCORE_SYSTEM_PROMPT, /kaygı ve uykusuzluk tedavisinde kullanılabilir\." 3\/5/);
  assert.match(SCORE_SYSTEM_PROMPT, /Vikingler boynuzlu miğfer takmazdı/);
});

// --- Madde 9: aynı run içi kart tekrarı ---------------------------------------------------

function writtenCand(id, draft) {
  return baseCandidate({ id, source_key: `k-${id}`, status: 'written', support_paragraph: 'p', scores: { category: '🔬 BİLİM', draft } });
}

test('madde 9 · dedup-card aynı run\'da daha önce geçen taslağa karşı da bakar (facts\'te yokken)', async () => {
  // İki farklı kanca, aynı olgu: kelimeleri aynı, sırası farklı kart → hash farklı, anlam aynı.
  const second = { ...GOOD_CARD, content: GOOD_CARD.content.split('. ').reverse().join('. ') };
  assert.notEqual(contentHash(cardText(second)), contentHash(cardText(GOOD_CARD)));
  const repo = createMemoryStepsRepo({ candidates: [writtenCand('w1', GOOD_CARD), writtenCand('w2', second)] });
  const stats = await runDedupCard(deps({ llm: fakeLlm({}), repo }));
  assert.equal(repo.get('w1').status, 'written');
  assert.equal(repo.get('w2').status, 'rejected');
  assert.equal(repo.get('w2').reject_reason, 'duplicate_card_semantic');
  assert.equal(repo.get('w2').scores.dedup_card.matchId, 'w1');
  assert.equal(stats.advanced, 1);
  assert.deepEqual(repo.lastMatchArgs().kinds, ['fact'], 'match_similar sadece kartlara bakar');
});

test('madde 9 · runSteps run başına tek liste paylaşır; ayrı run\'lar birbirini görmez', async () => {
  const shared = [];
  const repoA = createMemoryStepsRepo({ candidates: [writtenCand('a1', GOOD_CARD)] });
  await runSteps(['dedup-card'], deps({ llm: fakeLlm({}), repo: repoA, runDrafts: shared }));
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].embedding, bowEmbed(cardText(GOOD_CARD)));

  const repoB = createMemoryStepsRepo({ candidates: [writtenCand('b1', GOOD_CARD)] });
  await runSteps(['dedup-card'], deps({ llm: fakeLlm({}), repo: repoB }));
  assert.equal(repoB.get('b1').status, 'written', 'yeni run boş listeyle başlar');
});

test('madde 10 · dedup-hook match_similar\'ı p_kinds=[fact,candidate] ve p_exclude_candidate=aday id ile çağırır', async () => {
  const repo = createMemoryStepsRepo({ candidates: [baseCandidate({ id: 'h1', source_key: 'k-h1', hook_text: 'kanca bir' })] });
  await runDedupHook(deps({ llm: fakeLlm({}), repo }));
  assert.deepEqual(repo.lastMatchArgs().kinds, ['fact', 'candidate']);
  assert.equal(repo.lastMatchArgs().excludeCandidate, 'h1');
});
