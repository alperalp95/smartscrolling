import { createHash } from 'node:crypto';

/** Türkçe ve şapkalı harfler için ASCII karşılıkları (küçük harfe çevrildikten sonra uygulanır). */
const FOLD_MAP = {
  ı: 'i',
  ğ: 'g',
  ü: 'u',
  ş: 's',
  ö: 'o',
  ç: 'c',
  â: 'a',
  î: 'i',
  û: 'u',
};

const FOLD_PATTERN = /[ığüşöçâîû]/g;

/**
 * Metni hash için normalize eder: Türkçe-duyarlı küçük harf, Türkçe harfleri
 * ASCII'ye katlar, birleşik işaretleri siler, noktalama/sembolleri atar,
 * boşlukları sadeleştirir. Sayılar korunur.
 *
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function normalizeForHash(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(FOLD_PATTERN, (ch) => FOLD_MAP[ch])
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize edilmiş metnin sha256 özeti (hex).
 *
 * @param {string | null | undefined} text
 * @returns {string} 64 karakterlik hex
 */
export function contentHash(text) {
  return createHash('sha256').update(normalizeForHash(text), 'utf8').digest('hex');
}
