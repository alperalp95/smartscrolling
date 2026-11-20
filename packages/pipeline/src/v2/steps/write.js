// src/v2/steps/write.js
// Yaz: `scored` + destek paragrafı olan aday → Türkçe kart taslağı (scores.draft), durum `written`.
// Kod tarafı kurallar (basit kurallar, içerik regex'i yok): başlık 12–58 karakter,
// başlıkta "nedir"/"kimdir" yok, başlık Türkçe cümle düzeninde (Her Kelimesi Büyük değil),
// gövde config writing.minSentences–maxSentences cümle (varsayılan 2–4), Türkçe karakter var.
// maxTokens: config roles.writer.maxTokens.
// İhlal → BİR kez yeniden yazım (ihlaller prompt'a eklenir); yine ihlal → rejected:write_rules.
// Model `{ skip: true }` dönerse → rejected:writer_skip, yeniden deneme yok.
import { WRITE_MAX_TOKENS, buildRuleFixMessages, buildWritePrompt } from '../prompts/write.js';
import { STATUS, forEachCandidate, newStats, nowIso, reject, roleMaxTokens } from './common.js';

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
  return v;
}

function estimateReadTime(content) {
  const words = String(content).split(/\s+/).filter(Boolean).length;
  return Math.min(60, Math.max(10, Math.round(words / 3)));
}

/** Model çıktısını kart taslağına çevirir (etiket ve okuma süresi normalize edilir). */
export function normalizeDraft(json) {
  const title = String(json?.title ?? '').replace(/\s+/g, ' ').trim();
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
export async function writeWithRules(llm, messages, { maxTokens = WRITE_MAX_TOKENS, limits } = {}) {
  let res = await llm.chat('writer', { messages, json: true, maxTokens });
  if (isSkip(res?.json)) return { outcome: 'skip', reason: String(res.json.reason ?? '').slice(0, 200) };
  let draft = normalizeDraft(res?.json);
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
    draft = normalizeDraft(res?.json);
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
    const r = await writeWithRules(deps.llm, messages, { maxTokens, limits });
    if (r.outcome === 'skip') {
      await reject(deps, cand, 'writer_skip', stats, { scores: { ...(cand.scores ?? {}), writer_skip: r.reason } });
      return;
    }
    if (r.outcome === 'rules') {
      await reject(deps, cand, 'write_rules', stats, { scores: { ...(cand.scores ?? {}), write_violations: r.violations } });
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
