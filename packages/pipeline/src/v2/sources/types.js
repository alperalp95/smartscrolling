// Ortak aday biçimi (content pipeline v2, spec §5 adım 1).
// Her toplayıcı bu biçimde aday üretir; `fact_candidates` tablosunun kolonlarıyla eşleşir.
import { contentHash } from '../../dedup/index.js';

/**
 * @typedef {'enwiki_dyk' | 'trwiki_bm' | 'enwiki_misconceptions' | 'enwiki_unusual'} CandidateSource
 */

/**
 * Bir kanca adayı.
 *
 * @typedef {object} Candidate
 * @property {string} source_key  Kalıcı, deterministik kimlik. Örnekler:
 *   - `enwiki-dyk:2024-02-02T1200:3`  (DYK seti tarihi + set saati HHMM + set içi 0 tabanlı sıra; S1 ve S2 aynı şemayı kullanır)
 *   - `trwiki-bm:2026-10-05:0`        (günlük BM sayfası tarihi + sayfa içi sıra)
 *   - `trwiki-bm:arsiv-2010-2019:12`  (eski arşiv sayfası + sayfa içi sıra)
 *   - `enwiki-misconceptions:history:ancient-rome:2`
 *   - `enwiki-unusual:Ant_egg_soup`
 * @property {CandidateSource} source
 * @property {'en' | 'tr'} lang
 * @property {string} hook_text   Düz metin kanca ("... that" / "...ki" öneki ve sondaki "?" temizlenmiş).
 * @property {string} hook_hash   `contentHash(hook_text)` (dedup modülü, sha256 hex).
 * @property {string | null} source_url  Kancanın kalın linkli makalesi (yoksa ilk makale linki).
 * @property {Record<string, unknown>} source_meta  Kaynağa özgü ek bilgi (görüntülenme, sayfa adı vb.).
 */

/**
 * Bir toplayıcının dönüşü.
 *
 * @typedef {object} CollectResult
 * @property {Candidate[]} candidates
 * @property {unknown} nextCursor  Bir sonraki run'ın başlangıç noktası (null = kaynak bitti / her seferinde baştan).
 * @property {Record<string, unknown>} stats
 */

const EN_PREFIX = /^\s*(?:did you know\s*)?(?:\.{2,}|…)\s*that\b[\s,]*/i;
const TR_PREFIX = /^\s*(?:\.{2,}|…)\s*ki\b[\s,]*/i;
const PICTURED = /\s*\((?:[^()]*\s)?(?:pictured|illustrated|depicted|shown)\)/gi;

/**
 * Kanca metnini temizler: baştaki "... that" / "...ki" kalıbı, "(pictured)" notları,
 * sondaki "?" ve noktalama öncesi boşluklar. Girdi zaten düz metin olmalı (bkz. markup.js).
 *
 * @param {string | null | undefined} text
 * @param {'en' | 'tr'} [lang]
 * @returns {string}
 */
export function cleanHookText(text, lang = 'en') {
  let out = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  out = out.replace(lang === 'tr' ? TR_PREFIX : EN_PREFIX, '');
  out = out.replace(PICTURED, '');

  out = out
    .replace(/\s*\?+\s*$/, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}

/**
 * Ortak aday nesnesini kurar; `hook_hash` her zaman `contentHash(hook_text)`.
 *
 * @param {object} input
 * @param {string} input.source_key
 * @param {CandidateSource} input.source
 * @param {'en' | 'tr'} input.lang
 * @param {string} input.hook_text  Temizlenmiş düz metin.
 * @param {string | null} [input.source_url]
 * @param {Record<string, unknown>} [input.source_meta]
 * @returns {Candidate}
 */
export function makeCandidate({ source_key, source, lang, hook_text, source_url = null, source_meta = {} }) {
  return {
    source_key,
    source,
    lang,
    hook_text,
    hook_hash: contentHash(hook_text),
    source_url: source_url ?? null,
    source_meta,
  };
}

/** Kanca olarak kabul edilecek en kısa metin (karakter). */
export const MIN_HOOK_LENGTH = 20;

/**
 * Temizlenmiş metnin kanca olarak kullanılabilir olup olmadığı (boş/bozuk satırları atlamak için).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isUsableHook(text) {
  if (!text || text.length < MIN_HOOK_LENGTH) return false;
  // Ayrıştırılmamış işaretleme kalıntısı → bozuk satır.
  if (/\{\{|\}\}|\[\[|\]\]|<\/?[a-z][^>]*>/i.test(text)) return false;
  return /\p{L}/u.test(text);
}
