// src/v2/steps/write.js
// Yaz: `scored` + destek paragrafı olan aday → Türkçe kart taslağı (scores.draft), durum `written`.
// Başlık normalize edilir (kod): ilk harf büyük (Türkçe: i → İ), sondaki nokta silinir.
// Kod tarafı kurallar (basit kurallar, içerik regex'i yok): başlık 12–58 karakter,
// başlıkta "nedir"/"kimdir" yok, başlık Türkçe cümle düzeninde (Her Kelimesi Büyük değil),
// gövde config writing.minSentences–maxSentences cümle (varsayılan 2–4), Türkçe karakter var,
// ilk cümle başlık okunmadan anlaşılır (firstSentenceIssue, V2-05f).
// maxTokens: config roles.writer.maxTokens.
// İhlal → BİR kez yeniden yazım (ihlaller prompt'a eklenir); yine ihlal → rejected:write_rules.
// Model `{ skip: true }` dönerse → rejected:writer_skip, yeniden deneme yok.
import { WRITE_MAX_TOKENS, buildRuleFixMessages, buildWritePrompt } from '../prompts/write.js';
import { STATUS, forEachCandidate, newStats, nowIso, reject, roleMaxTokens } from './common.js';
import { firstSentence, fold } from './fidelity.js';

export const TITLE_MIN = 12;
export const TITLE_MAX = 58;
/** config.writing.minSentences / maxSentences yoksa kullanılır. */
export const SENTENCES_MIN = 2;
export const SENTENCES_MAX = 4;
const TR_CHARS = new Set(['ı', 'ğ', 'ş', 'ç', 'ö', 'ü', 'İ', 'Ğ', 'Ş', 'Ç', 'Ö', 'Ü']);
const BANNED_TITLE_WORDS = new Set(['nedir', 'kimdir']);
// Nokta ile biten ama cümle bitirmeyen kısaltmalar (küçük harfe çevrilmiş).
const ABBREVIATIONS = new Set(['m.ö.', 'm.s.', 'mö.', 'ms.', 'vb.', 'vs.', 'dr.', 'prof.', 'st.', 'örn.', 'yy.', 'bkz.', 'no.', 'mr.', 'mrs.', 'jr.', 'sr.']);

/** Cümle sayısı: . ! ? … ile biten kelimeler (kısaltma ve baş harf hariç). */
export function countSentences(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  let count = 0;
  let open = false;
  for (const w of words) {
    open = true;
    const last = w.replace(/["'”’»)\]]+$/u, '').slice(-1);
    if (!['.', '!', '?', '…'].includes(last)) continue;
    const lower = w.toLocaleLowerCase('tr-TR');
    if (ABBREVIATIONS.has(lower)) continue;
    if ([...w].length === 2 && w.endsWith('.') && /\p{Lu}/u.test(w[0])) continue; // "J." gibi baş harf
    count += 1;
    open = false;
  }
  return count + (open ? 1 : 0);
}

export function hasTurkishChars(text) {
  for (const ch of String(text ?? '')) if (TR_CHARS.has(ch)) return true;
  return false;
}

/**
 * Başlık "Her Kelimesi Büyük" mü? İlk kelimeden sonraki, en az 3 harfli ve tamamı büyük
 * olmayan (kısaltma değil) kelimelerin en az 3'ü varsa ve %75'i büyük harfle başlıyorsa evet.
 * Özel adlar büyük kalabilir: "Raisa Gorbaçova Moskova'da gömülü" geçer.
 */
export function isTitleCase(title) {
  const words = String(title ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter(Boolean)
    .slice(1)
    .filter((w) => [...w].length >= 3 && w !== w.toLocaleUpperCase('tr-TR'));
  if (words.length < 3) return false;
  const upper = words.filter((w) => /^\p{Lu}/u.test(w)).length;
  return upper / words.length >= 0.75;
}

/**
 * Gövde cümle sınırları: config.writing.minSentences / maxSentences, yoksa 2-4.
 * @returns {{ minSentences: number, maxSentences: number }}
 */
export function writingLimits(config) {
  const w = config?.writing ?? {};
  const pick = (v, d) => (Number.isInteger(v) && v > 0 ? v : d);
  const minSentences = pick(w.minSentences, SENTENCES_MIN);
  const maxSentences = Math.max(minSentences, pick(w.maxSentences, SENTENCES_MAX));
  return { minSentences, maxSentences };
}

function titleWords(title) {
  return String(title ?? '')
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Bağımsız ilk cümle kuralında konu sayılmayan sıradan kelimeler (katlanmış).
const ANCHOR_STOPWORDS = new Set(
  ['arasında', 'boyunca', 'sonra', 'önce', 'olarak', 'kadar', 'için', 'gibi', 'ile', 'daha', 'çok', 'en', 'bir', 'olan', 'oldu', 'olduğu', 'aslında',
    'tarafından', 'beri', 'itibaren', 'yaklaşık', 'sadece', 'yalnızca', 'ilk', 'son', 'kez', 'kere', 'resmi', 'resmî', 'var', 'yok', 'değil', 'aynı', 'tam',
    'yüzyıl', 'yüzyılda', 'yüzyıldan', 'yüzyılın', 'dönem', 'döneminde', 'zaman', 'sırasında', 'gün', 'günü', 'ay', 'hafta'].map(fold),
);
// Öznesiz başlangıç: zaman/sayı ifadesi ya da geri gönderme ("Bu uygulama...", "Ayrıca ...").
const SUBJECTLESS_STARTERS = new Set(
  ['bu', 'bunun', 'buna', 'bunu', 'şu', 'o', 'onun', 'ona', 'onu', 'bunlar', 'onlar', 'ayrıca', 'ancak', 'sonra', 'daha', 'ardından', 'böylece', 'üstelik', 'aynı', 'söz'].map(fold),
);
// Edilgen yüklem (katlanmış): başlatıldı, okundu, kurulmuştur, edilmiş, yapılacak...
const PASSIVE_END = /(?:[iu]l|[aeiou]n)(?:d[iu]|m[iu]s|[iu]r|[ae]c[ae]k|[iu]yor)(?:l[ae]r)?(?:d[iu]r|t[iu]r)?$/u;
const YEAR_WORD = /^yil/u;

function anchorWords(text) {
  return String(text ?? '')
    .split(/\s+/)
    .map((w) => fold(w.split(/['’]/u)[0]).replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((w) => w && !/^\d/u.test(w) && !ANCHOR_STOPWORDS.has(w) && !YEAR_WORD.test(w));
}

function sharesStem(a, b) {
  if (a === b) return true;
  const n = Math.min(5, a.length, b.length);
  return n >= 3 && a.slice(0, n) === b.slice(0, n);
}

/**
 * Bağımsız ilk cümle (V2-05f, basit sezgisel kural): ilk cümle başlıktaki ana adı ya da ana ismi
 * içermiyorsa VE öznesiz bir yüklemle başlıyorsa (sayı/zaman ifadesi ya da "Bu ..." ile başlıyor
 * veya yüklemi edilgen: "1932 yılında ... resmi olarak başlatıldı.") ihlal döner.
 * @returns {string|null}
 */
export function firstSentenceIssue(card) {
  const sentence = firstSentence(card?.content ?? '');
  if (!sentence) return null;
  const anchors = anchorWords(card?.title).filter((w) => w.length >= 3 || /^\p{L}{2}$/u.test(w));
  if (anchors.length === 0) return null;
  const words = anchorWords(sentence);
  if (words.some((w) => anchors.some((a) => (a.length < 3 ? w === a : sharesStem(a, w))))) return null;
  const firstRaw = sentence.split(/\s+/)[0] ?? '';
  const first = fold(firstRaw.split(/['’]/u)[0]).replace(/[^\p{L}\p{N}]+/gu, '');
  const last = fold(sentence.split(/\s+/).at(-1) ?? '').replace(/[^\p{L}]+/gu, '');
  const subjectless = /^\d/u.test(firstRaw) || SUBJECTLESS_STARTERS.has(first) || PASSIVE_END.test(last);
  if (!subjectless) return null;
  return 'ilk cümle başlık okunmadan anlaşılmıyor: konuyu açıkça adlandır (özne zorunlu), başlıktaki ana adı ya da ismi ilk cümlede kullan';
}

function normalizeForEcho(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bigram Dice benzerliği (0-1), normalize edilmiş iki metin için. */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (t) => {
    const m = new Map();
    for (let i = 0; i < t.length - 1; i += 1) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  const total = Math.max(0, a.length - 1) + Math.max(0, b.length - 1);
  return total === 0 ? 0 : (2 * inter) / total;
}

/**
 * İlk cümle başlığı tekrar ediyor mu (V2-05g)? Normalize edilmiş (küçük harf, noktalama yok)
 * ilk cümle başlıkla %80+ benzer ya da başlığı birebir içeriyorsa ihlal döner.
 * @returns {string|null}
 */
export function titleEchoIssue(card) {
  const title = normalizeForEcho(card?.title);
  const sentence = normalizeForEcho(firstSentence(card?.content ?? ''));
  if (!title || !sentence) return null;
  if (sentence.includes(title) || similarity(title, sentence) >= 0.8) {
    return 'ilk cümle başlığı tekrar etmesin, yeni bilgi versin';
  }
  return null;
}

/**
 * Kart taslağını kod kurallarına göre denetler.
 * @param {object} card
 * @param {{ minSentences?: number, maxSentences?: number }} [limits]  writingLimits(config)
 * @returns {string[]} ihlaller (Türkçe; prompt'a eklenir). Boşsa geçer.
 */
export function checkWriteRules(card, { minSentences = SENTENCES_MIN, maxSentences = SENTENCES_MAX } = {}) {
  const v = [];
  const title = typeof card?.title === 'string' ? card.title.trim() : '';
  const content = typeof card?.content === 'string' ? card.content.trim() : '';
  const len = [...title].length;
  if (len < TITLE_MIN || len > TITLE_MAX) v.push(`başlık ${TITLE_MIN}-${TITLE_MAX} karakter olmalı (şu an ${len})`);
  if (titleWords(title).some((w) => BANNED_TITLE_WORDS.has(w))) v.push('başlıkta "nedir"/"kimdir" olmamalı');
  if (isTitleCase(title)) v.push('başlık Türkçe cümle düzeninde olmalı: sadece ilk harf ve özel adlar büyük');
  const n = countSentences(content);
  if (n < minSentences || n > maxSentences) v.push(`gövde ${minSentences}-${maxSentences} cümle olmalı (şu an ${n})`);
  if (!hasTurkishChars(`${title} ${content}`)) v.push('Türkçe karakter (ı, ğ, ş, ç, ö, ü) kullanılmalı');
  const first = firstSentenceIssue({ title, content });
  if (first) v.push(first);
  const echo = titleEchoIssue({ title, content });
  if (echo) v.push(echo);
  return v;
}

function estimateReadTime(content) {
  const words = String(content).split(/\s+/).filter(Boolean).length;
  return Math.min(60, Math.max(10, Math.round(words / 3)));
}

/** Kancada küçük harfle başlayan ve sıradan kelime biçiminde olmayan terim mi (.bv, x.com, web3, eBay)? */
function lowercaseTermInHook(word, hook) {
  if (!hook || !word) return false;
  const special = (w) => /[.\d]/u.test(w) || /^\p{Ll}.*\p{Lu}/u.test(w);
  const terms = String(hook)
    .split(/\s+/)
    .map((w) => w.replace(/^["'“‘«(\[]+/u, '').replace(/[,;:!?)\]"”»]+$|\.$/gu, '').split(/['’]/u)[0])
    .filter((w) => w && /^[^\p{Lu}]/u.test(w) && special(w));
  return terms.includes(word);
}

/**
 * Başlık düzeltmesi (kod kuralı): ilk harf büyük (toLocaleUpperCase('tr-TR'): "istanbul" →
 * "İstanbul"), sondaki nokta(lar) silinir. Soru/ünlem işareti korunur.
 * Büyütme YAPILMAZ (V2-05f):
 *   - ilk karakter harf değilse (".bv", "1930'larda", "#etiket"); sadece açılış tırnağı/parantezi atlanır
 *   - ilk kelimenin içinde büyük harf varsa ("iPhone", "eBay", "macOS")
 *   - ilk kelime kancada küçük harfle geçen özel biçimli bir terimse ("x.com", "web3"; { hook } ile)
 */
export function normalizeTitle(raw, { hook } = {}) {
  let title = String(raw ?? '').replace(/\s+/g, ' ').trim();
  title = title.replace(/\s*\.+$/u, '').trim();
  const m = title.match(/^(["'“‘«(\[]*)(\p{L})/u);
  if (!m || !/\p{Ll}/u.test(m[2])) return title;
  const at = m[1].length;
  const firstWord = title.slice(at).split(/[\s,;:!?)"”»]/u)[0].split(/['’]/u)[0];
  if (/\p{Lu}/u.test(firstWord.slice(1))) return title; // iPhone, eBay, macOS
  if (lowercaseTermInHook(firstWord, hook)) return title;
  return title.slice(0, at) + m[2].toLocaleUpperCase('tr-TR') + title.slice(at + m[2].length);
}

/**
 * Model çıktısını kart taslağına çevirir (başlık, etiket ve okuma süresi normalize edilir).
 * @param {object} json
 * @param {{ hook?: string }} [opts]  kanca: başlık büyük harf kenar durumları için
 */
export function normalizeDraft(json, { hook } = {}) {
  const title = normalizeTitle(json?.title, { hook });
  const content = String(json?.content ?? '').replace(/\s+/g, ' ').trim();
  const tags = [
    ...new Set(
      (Array.isArray(json?.tags) ? json.tags : [])
        .filter((t) => typeof t === 'string')
        .map((t) => t.trim().toLocaleLowerCase('tr-TR').replace(/^#/, ''))
        .filter(Boolean),
    ),
  ].slice(0, 5);
  const rt = Number(json?.read_time_sq);
  const read_time_sq = Number.isInteger(rt) && rt >= 5 && rt <= 120 ? rt : estimateReadTime(content);
  return { title, content, tags, read_time_sq };
}

function isSkip(json) {
  return json?.skip === true || json?.skip === 'true';
}

/**
 * Yazar çağrısı + kural kontrolü + (gerekirse) tek kural düzeltmesi.
 * @param {object} llm
 * @param {Array} messages  ilk istem mesajları
 * @returns {Promise<{ outcome: 'ok', draft, text, model, rewrites } | { outcome: 'skip', reason } | { outcome: 'rules', violations }>}
 */
export async function writeWithRules(llm, messages, { maxTokens = WRITE_MAX_TOKENS, limits, hook } = {}) {
  let res = await llm.chat('writer', { messages, json: true, maxTokens });
  if (isSkip(res?.json)) return { outcome: 'skip', reason: String(res.json.reason ?? '').slice(0, 200) };
  let draft = normalizeDraft(res?.json, { hook });
  let violations = checkWriteRules(draft, limits);
  let rewrites = 0;
  if (violations.length > 0) {
    rewrites = 1;
    res = await llm.chat('writer', {
      messages: [...messages, ...buildRuleFixMessages(res?.text, violations)],
      json: true,
      maxTokens,
    });
    if (isSkip(res?.json)) return { outcome: 'skip', reason: String(res.json.reason ?? '').slice(0, 200) };
    draft = normalizeDraft(res?.json, { hook });
    violations = checkWriteRules(draft, limits);
    if (violations.length > 0) return { outcome: 'rules', violations };
  }
  return { outcome: 'ok', draft, text: res?.text ?? JSON.stringify(res?.json ?? {}), model: res?.model ?? null, rewrites };
}

export function writeInput(cand, limits = writingLimits(null)) {
  return {
    hook: cand.hook_text,
    lang: cand.lang,
    support: cand.support_paragraph,
    category: cand.scores?.category,
    ...limits,
  };
}

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runWrite(deps, { limit = 50 } = {}) {
  const stats = newStats('write');
  const cands = await deps.repo.listByStatus(STATUS.SCORED, limit, { hasSupport: true });
  const maxTokens = roleMaxTokens(deps.config, 'writer', WRITE_MAX_TOKENS);
  const limits = writingLimits(deps.config);

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const { messages } = buildWritePrompt(writeInput(cand, limits));
    const r = await writeWithRules(deps.llm, messages, { maxTokens, limits, hook: cand.hook_text });
    if (r.outcome === 'skip') {
      await reject(deps, cand, 'writer_skip', stats, { scores: { ...(cand.scores ?? {}), writer_skip: r.reason } });
      return;
    }
    if (r.outcome === 'rules') {
      deps.log?.(`[write] ${cand.id} write_rules nedeni: ${r.violations.join(' | ')}`);
      await reject(deps, cand, 'write_rules', stats, {
        scores: { ...(cand.scores ?? {}), write_violations: r.violations, write_issues: r.violations },
      });
      return;
    }
    const draft = { ...r.draft, writer_model: r.model, rewrites: r.rewrites, written_at: nowIso(deps.now) };
    await deps.repo.updateCandidate(cand.id, {
      status: STATUS.WRITTEN,
      scores: { ...(cand.scores ?? {}), draft },
    });
    stats.advanced += 1;
  });
  return stats;
}
