import assert from 'node:assert/strict';
// V2-05e: puanlayıcı batch bölme ("Request too large"), kısa anahtarlı puan çıktısı, kapanan model
// (410) → stats.modelEvents, başlık büyük harf düzeltmesi, başlık-anlam uyumsuzluğu → onarım.
// Sahte LLM / sahte fetch; gerçek LLM / ağ / DB çağrısı yok.
import { test } from 'node:test';
import { contentHash } from '../../../dedup/index.js';
import { TEST_ENV, chatOk, fakeFetch, isGroq, json } from '../../../llm/__tests__/helpers.js';
import {
  LlmRequestTooLargeError,
  createLlm,
  createMemoryUsageStore,
  loadConfig,
} from '../../../llm/index.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { SCORE_SYSTEM_PROMPT } from '../../prompts/score.js';
import { VERIFY_SYSTEM_PROMPT } from '../../prompts/verify.js';
import { REPAIR_MARKER, WRITE_SYSTEM_PROMPT } from '../../prompts/write.js';
import { cardText } from '../dedup-card.js';
import { runSteps, summarizeModelEvents, summarizeRateEvents } from '../index.js';
import { parseScoreItem, runScore } from '../score.js';
import { parseTitleMatch, parseVerification, runVerify } from '../verify.js';
import { checkWriteRules, normalizeTitle, runWrite } from '../write.js';
import {
  GOOD_CARD,
  baseCandidate,
  deps,
  fakeLlm,
  parseScoreRequest,
  userContent,
} from './helpers.js';

const passedHook = { dedup_hook: { verdict: 'unique', reason: 'no_match' } };

function scoreRepo(n) {
  return createMemoryStepsRepo({
    candidates: Array.from({ length: n }, (_, i) =>
      baseCandidate({
        id: `s${i + 1}`,
        source_key: `k${i + 1}`,
        hook_text: `hook number ${i + 1}`,
        scores: passedHook,
      }),
    ),
  });
}

const shortItem = (i) => ({
  i,
  s: 6 + (i % 4),
  r: 5,
  d: 0,
  c: 'TARİH',
  ...(i % 2 ? { w: 'yaygın inanışın tersi' } : {}),
});

// --- 1-2. Puanlayıcı: kısa anahtarlar + batch bölme -----------------------------------------

test('parseScoreItem: kısa anahtarlar (i, s, r, d=0/1, c emojisiz, w) ve eski uzun anahtarlar', () => {
  const a = parseScoreItem({ i: 1, s: 8, r: 6, d: 0, c: 'TARİH', w: 'beklenmedik bağlantı' });
  assert.ok(a.ok);
  assert.deepEqual(
    {
      s: a.value.surprise,
      r: a.value.tr_relevance,
      d: a.value.is_definition,
      c: a.value.category,
      w: a.value.reason,
    },
    { s: 8, r: 6, d: false, c: '📜 TARİH', w: 'beklenmedik bağlantı' },
  );
  assert.equal(parseScoreItem({ i: 2, s: 1, r: 5, d: 1, c: 'BİLİM' }).value.is_definition, true);
  assert.equal(
    parseScoreItem({ i: 3, s: 2, r: 3, d: 0, c: 'SANAT' }).value.category,
    '🎨 SANAT & KÜLTÜR',
  );
  assert.equal(
    parseScoreItem({ i: 4, s: 2, r: 3, d: 0, c: 'SPOR' }).value.reason,
    '',
    'w yoksa boş gerekçe',
  );
  assert.ok(
    parseScoreItem({ id: 5, surprise: 7, tr_relevance: 4, is_definition: false, category: 'Bilim' })
      .ok,
  );
  assert.equal(parseScoreItem({ i: 6, s: 7, r: 4 }).ok, false, 'd eksik');
});

test('puanlayıcı istemi kısa anahtar + koşullu gerekçe ister; config batchSize 10, maxTokens OTPM altında', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /\{"items":\[\{"i":1,"s":3,"r":5,"d":0,"c":"BİLİM"\}/);
  assert.match(SCORE_SYSTEM_PROMPT, /w \(gerekçe\): SADECE s 6 ve üstüyse, en fazla 6 kelime/);
  assert.ok(!/"surprise":|"reason":/.test(SCORE_SYSTEM_PROMPT), 'uzun anahtar örneği yok');
  const cfg = loadConfig();
  assert.equal(cfg.scoring.batchSize, 10);
  assert.ok(
    cfg.roles.scorer.maxTokens <
      cfg.providers.groq.perMinuteLimits['qwen/qwen3.8-27b'].outputTokensPerMinute,
  );
});

test('runScore: kısa anahtarlı yanıt işlenir (i ile eşleşir, kategori normalize)', async () => {
  const repo = scoreRepo(10);
  const llm = fakeLlm({
    scorer: (req) => ({ items: parseScoreRequest(req).map(({ id }) => shortItem(id)) }),
  });
  const stats = await runScore(
    deps({ llm, repo, config: { scoring: { batchSize: 10, passPercent: 30 } } }),
  );
  assert.equal(llm.count('scorer'), 1);
  assert.equal(stats.failed, 0);
  assert.equal(stats.advanced, 3);
  const scored = repo.candidates().filter((c) => c.status === 'scored');
  assert.ok(scored.every((c) => c.scores.category === '📜 TARİH' && c.scores.surprise >= 6));
});

test('runScore: "Request too large" → batch ikiye bölünür (10 → 5 + 5) ve tekrar denenir; tek aday bölünemez', async () => {
  const repo = scoreRepo(10);
  const seen = [];
  const llm = fakeLlm({
    scorer: (req) => {
      const items = parseScoreRequest(req);
      seen.push({ size: items.length, splittable: req.splittable });
      if (items.length > 5) {
        return new LlmRequestTooLargeError('scorer', {
          provider: 'groq',
          model: 'qwen/qwen3.8-27b',
          metric: 'OTPM',
          limit: 1000,
        });
      }
      return { items: items.map(({ id }) => shortItem(id)) };
    },
  });
  const logs = [];
  const stats = await runScore(
    deps({
      llm,
      repo,
      log: (m) => logs.push(m),
      config: { scoring: { batchSize: 10, passPercent: 30 } },
    }),
  );

  assert.deepEqual(seen, [
    { size: 10, splittable: true },
    { size: 5, splittable: true },
    { size: 5, splittable: true },
  ]);
  assert.equal(stats.splits, 1);
  assert.equal(stats.seen, 10);
  assert.equal(stats.failed, 0);
  assert.equal(stats.deferred, 0);
  assert.equal(repo.candidates().filter((c) => c.status === 'new').length, 0, 'hepsi puanlandı');
  assert.ok(
    logs.some((m) =>
      /istek dakikalık sınırdan büyük \(groq\/qwen\/qwen3\.8-27b OTPM limit=1000\); batch 10 → 5 \+ 5/.test(
        m,
      ),
    ),
  );

  // Tek adaylık batch: splittable=false (LLM katmanı çok büyük isteği yedek modele verir).
  let splittable;
  const one = fakeLlm({
    scorer: (req) => {
      splittable = req.splittable;
      return { items: [shortItem(1)] };
    },
  });
  await runScore(
    deps({ llm: one, repo: scoreRepo(1), config: { scoring: { batchSize: 10, passPercent: 30 } } }),
  );
  assert.equal(one.calls.length, 1);
  assert.equal(splittable, false);
});

test("runScore: bölünen batch'lerden biri zincir tükenmesi → kalan tüm adaylar ertelenir", async () => {
  const repo = scoreRepo(10);
  const { LlmExhaustedError } = await import('../../../llm/index.js');
  const llm = fakeLlm({
    scorer: [
      new LlmRequestTooLargeError('scorer', { provider: 'groq', model: 'q' }),
      { items: [1, 2, 3, 4, 5].map(shortItem) },
      new LlmExhaustedError('scorer', {
        attempts: [{ provider: 'groq', model: 'q', reason: 'quota' }],
      }),
    ],
  });
  const stats = await runScore(
    deps({ llm, repo, config: { scoring: { batchSize: 10, passPercent: 30 } } }),
  );
  assert.equal(stats.seen, 5);
  assert.equal(stats.deferred, 5);
  assert.equal(repo.candidates().filter((c) => c.status === 'new').length, 5);
});

// --- 3. Kapanan model: 410 → model_unavailable → yedek + stats.modelEvents ------------------

test('410 deprecated → model_unavailable, yedek puanlayıcıya geçilir; run sonunda stats.modelEvents', async () => {
  const fetch = fakeFetch((call) => {
    if (isGroq(call) && call.body.model === 'qwen/qwen3.8-27b') {
      return json(410, {
        error: { message: 'The model `qwen/qwen3.8-27b` was deprecated on 2026-11-20.' },
      });
    }
    const lines = call.body.messages.at(-1).content.split('\n').slice(1);
    const items = lines.map((l, k) => shortItem(k + 1));
    return chatOk(JSON.stringify({ items }), { prompt: 800, completion: 300 });
  });
  const config = loadConfig();
  const llm = createLlm(config, {
    env: TEST_ENV,
    fetch,
    sleep: async () => {},
    now: () => Date.parse('2026-11-21T10:00:00Z'),
    usageStore: createMemoryUsageStore(),
  });
  const repo = scoreRepo(20);
  const logs = [];
  const { stats } = await runSteps(
    ['score'],
    deps({ llm, repo, config, log: (m) => logs.push(m) }),
    { limit: 50 },
  );

  assert.equal(stats.score.seen, 20);
  assert.equal(stats.score.failed, 0);
  assert.equal(stats.score.deferred, 0);
  // İki batch (10 + 10): qwen bir kez denendi (410), ikinci batch'te hiç denenmedi.
  assert.equal(fetch.calls.filter((c) => c.body.model === 'qwen/qwen3.8-27b').length, 1);
  assert.equal(fetch.calls.filter((c) => c.body.model === 'openai/gpt-oss-20b').length, 2);
  assert.equal(stats.modelEvents.length, 1);
  const [ev] = stats.modelEvents;
  assert.deepEqual(
    {
      type: ev.type,
      provider: ev.provider,
      model: ev.model,
      status: ev.status,
      roles: ev.roles,
      count: ev.count,
    },
    {
      type: 'model_unavailable',
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      status: 410,
      roles: ['scorer'],
      count: 1,
    },
  );
  assert.match(ev.error, /deprecated/);
  assert.ok(
    logs.some((m) => m.includes('model olayı: model_unavailable groq/qwen/qwen3.8-27b (HTTP 410)')),
  );
});

test('summarizeModelEvents: sağlayıcı/model başına tek satır, roller birleşir, diğer olaylar sayılmaz', () => {
  const out = summarizeModelEvents([
    {
      type: 'model_unavailable',
      role: 'scorer',
      provider: 'cloudflare',
      model: 'm',
      status: 410,
      error: 'deprecated',
      at: 'a',
    },
    { type: 'retry', role: 'scorer', provider: 'groq', model: 'q' },
    {
      type: 'model_unavailable',
      role: 'judge',
      provider: 'cloudflare',
      model: 'm',
      status: 410,
      error: 'deprecated',
      at: 'b',
    },
  ]);
  assert.deepEqual(out, [
    {
      type: 'model_unavailable',
      provider: 'cloudflare',
      model: 'm',
      roles: ['scorer', 'judge'],
      status: 410,
      error: 'deprecated',
      count: 2,
      first_at: 'a',
      last_at: 'b',
    },
  ]);
  assert.deepEqual(summarizeModelEvents([]), []);
});

test('summarizeRateEvents: bekleme sayısı/süresi, çok büyük istek ve öğrenilen sınırlar', () => {
  assert.deepEqual(
    summarizeRateEvents([
      { type: 'rate_wait', delayMs: 50_000 },
      { type: 'rate_wait', delayMs: 12_000 },
      { type: 'request_too_large', provider: 'groq', model: 'q' },
      { type: 'rate_limit_learned', provider: 'groq', model: 'q', metric: 'OTPM', limit: 800 },
      { type: 'retry' },
    ]),
    {
      waits: 2,
      waitMs: 62_000,
      tooLarge: 1,
      learned: [{ provider: 'groq', model: 'q', metric: 'OTPM', limit: 800 }],
    },
  );
});

// --- 5. Başlık kuralları ---------------------------------------------------------------------

test('normalizeTitle: ilk harf büyük (tr-TR), sonda nokta yok; özel durumlar korunur', () => {
  assert.equal(
    normalizeTitle('hamlet en çok filme çekilen öykü.'),
    'Hamlet en çok filme çekilen öykü',
  );
  assert.equal(normalizeTitle('istanbul iki kıtaya yayılır'), 'İstanbul iki kıtaya yayılır');
  assert.equal(normalizeTitle('ılık suyun donma hızı.'), 'Ilık suyun donma hızı');
  assert.equal(normalizeTitle('"çay" aslında Çince bir kelime'), '"Çay" aslında Çince bir kelime');
  assert.equal(normalizeTitle('iPhone ilk kez 2007’de satıldı'), 'iPhone ilk kez 2007’de satıldı');
  assert.equal(normalizeTitle('1930’larda yazılan tez...'), '1930’larda yazılan tez');
  assert.equal(normalizeTitle('Bunu biliyor muydunuz?'), 'Bunu biliyor muydunuz?');
});

test('runWrite: küçük harfle başlayan, noktayla biten başlık kodda düzeltilir (yeniden yazım gerekmez)', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 'w1',
        status: 'scored',
        support_paragraph: 'Hamlet is the most filmed story after Cinderella.',
        scores: { category: '🎨 SANAT & KÜLTÜR' },
      }),
    ],
  });
  const llm = fakeLlm({
    writer: [{ ...GOOD_CARD, title: "hamlet, Külkedisi'nden sonra en çok filme çekilen hikâye." }],
  });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 1);
  const c = repo.get('w1');
  assert.equal(c.status, 'written');
  assert.equal(c.scores.draft.title, "Hamlet, Külkedisi'nden sonra en çok filme çekilen hikâye");
  assert.deepEqual(checkWriteRules(c.scores.draft), []);
});

test('yazar istemi: başlık yüklemli tam cümle, sonda nokta yok, "rehearsal" = prova; 3 kötü/iyi başlık örneği', () => {
  assert.match(WRITE_SYSTEM_PROMPT, /yüklemli, tam ve doğal bir Türkçe cümle/);
  assert.match(WRITE_SYSTEM_PROMPT, /Sonda nokta yok/);
  assert.match(WRITE_SYSTEM_PROMPT, /"rehearsal" = prova/);
  assert.equal(WRITE_SYSTEM_PROMPT.match(/^Kötü başlık: .* · İyi: ".*"$/gm)?.length, 3);
  // İyi başlık örnekleri kod kurallarını geçer (12-58 karakter, cümle düzeni).
  for (const m of WRITE_SYSTEM_PROMPT.matchAll(/· İyi: "(.*)"$/gm)) {
    const title = m[1];
    assert.deepEqual(checkWriteRules({ title, content: GOOD_CARD.content }), [], title);
  }
});

const SUPPORT =
  'In May 2011 the CIA held a final rehearsal of the raid on bin Laden. It lasted four days and spanned three time zones.';
const S = (claim) => ({ claim, verdict: 'supported' });
const BAD_TITLE_CARD = {
  ...GOOD_CARD,
  title: 'Rehberlik tatbikatı dört gün sürdü',
  content:
    'CIA, bin Ladin baskınının son provasını dört gün boyunca yaptı. Prova üç saat dilimini kapsadı.',
};
const FIXED_TITLE_CARD = {
  ...BAD_TITLE_CARD,
  title: 'Bin Ladin baskınının son provası dört gün sürdü',
};

function titleRepo() {
  return createMemoryStepsRepo({
    candidates: [
      baseCandidate({
        id: 't1',
        status: 'written',
        hook_text: 'the final rehearsal of the bin Laden raid lasted four days',
        support_paragraph: SUPPORT,
        scores: {
          category: '📜 TARİH',
          draft: {
            ...BAD_TITLE_CARD,
            content_hash: contentHash(cardText(BAD_TITLE_CARD)),
            rewrites: 0,
          },
          dedup_card: { verdict: 'unique', reason: 'no_match' },
          draft_embedding: [1, 0, 0],
        },
      }),
    ],
  });
}

test('parseVerification: title_match=false → başlık iddiası unsupported (kind=title); true/eksik etkilemez', () => {
  const bad = parseVerification(
    {
      claims: [S('dört gün sürdü'), S('üç saat dilimi')],
      title_match: false,
      title_why: 'rehearsal = prova',
    },
    { title: 'Rehberlik tatbikatı dört gün sürdü' },
  );
  assert.equal(bad.verdict, 'unsupported');
  assert.equal(bad.title_match, false);
  assert.deepEqual(bad.claims[0], {
    claim: 'Başlık: Rehberlik tatbikatı dört gün sürdü',
    verdict: 'unsupported',
    why: 'rehearsal = prova',
    kind: 'title',
  });
  assert.equal(parseVerification({ claims: [S('a')], title_match: true }).verdict, 'supported');
  assert.equal(parseVerification({ claims: [S('a')] }).verdict, 'supported');
  assert.equal(parseVerification({ claims: [S('a')] }).title_match, undefined);
  assert.equal(parseTitleMatch({ title_match: 'hayır' }), false);
  assert.equal(parseTitleMatch({ title_match: 'Evet' }), true);
  assert.equal(parseTitleMatch({ title_match: 'belki' }), null);
});

test('doğrulayıcı istemi: ilk iddia başlık, title_match ile anlam/çeviri uyumu sorulur', () => {
  assert.match(VERIFY_SYSTEM_PROMPT, /İlk iddia her zaman başlığın kendisidir/);
  assert.match(
    VERIFY_SYSTEM_PROMPT,
    /başlık, metindeki ve kanıttaki olguyla aynı şeyi mi söylüyor\? Terimler doğru çevrilmiş mi\?/,
  );
  assert.match(VERIFY_SYSTEM_PROMPT, /"title_match":false/);
  assert.match(VERIFY_SYSTEM_PROMPT, /rehearsal = prova/);
});

test('başlık-anlam uyumsuzluğu → onarım turu (başlık düzeltilir) → verified', async () => {
  const repo = titleRepo();
  const llm = fakeLlm({
    verifier: [
      {
        claims: [S('Rehberlik tatbikatı dört gün sürdü'), S('dört gün'), S('üç saat dilimi')],
        title_match: false,
        title_why: 'rehearsal = prova, rehberlik değil',
      },
      { claims: [S('son prova dört gün sürdü'), S('üç saat dilimi')], title_match: true },
    ],
    writer: [FIXED_TITLE_CARD],
  });
  const stats = await runVerify(deps({ llm, repo }));

  assert.equal(llm.count('verifier'), 2);
  assert.equal(llm.count('writer'), 1);
  const fix = llm.calls.find((c) => c.role === 'writer').messages.at(-1).content;
  assert.ok(fix.includes(REPAIR_MARKER));
  assert.ok(fix.includes('Başlık: Rehberlik tatbikatı dört gün sürdü'));
  assert.match(
    fix,
    /başlık metindeki olguyla aynı şeyi söylemiyor ya da bir terim yanlış çevrilmiş: rehearsal = prova/,
  );
  assert.match(fix, /yüklemli, doğal bir Türkçe cümle/);

  const c = repo.get('t1');
  assert.equal(c.status, 'verified');
  assert.equal(stats.advanced, 1);
  assert.equal(c.scores.draft.title, FIXED_TITLE_CARD.title);
  assert.equal(c.scores.verification.repair.title, true);
  assert.deepEqual(
    c.scores.verification.rounds.map((r) => r.title_match),
    [false, true],
  );
  // ikinci doğrulama düzeltilmiş başlığı görür
  const second = llm.calls.filter((c2) => c2.role === 'verifier')[1];
  assert.ok(
    userContent({ messages: second.messages }).includes(`Başlık: ${FIXED_TITLE_CARD.title}`),
  );
});

test('başlık onarımdan sonra da uyumsuz → rejected:unsupported_claim (ikinci onarım yok)', async () => {
  const repo = titleRepo();
  const llm = fakeLlm({
    verifier: [
      { claims: [S('a'), S('b')], title_match: false, title_why: 'yanlış çeviri' },
      { claims: [S('a'), S('b')], title_match: 'hayır', title_why: 'hâlâ uyumsuz' },
    ],
    writer: [BAD_TITLE_CARD],
  });
  await runVerify(deps({ llm, repo }));
  const c = repo.get('t1');
  assert.equal(c.status, 'rejected');
  assert.equal(c.reject_reason, 'unsupported_claim');
  assert.equal(llm.count('writer'), 1);
});
