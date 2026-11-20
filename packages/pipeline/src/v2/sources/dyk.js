// EN "Did you know" (DYK) ortak yardımcıları: S1 (HF arşivi) ve S2 (Recent additions) aynı
// anahtar şemasını ve aynı kanca temizliğini kullanır.
import { articleLinksFromHtml, boldLinkFromHtml, htmlToText, wikiUrl } from './markup.js';
import { cleanHookText, isUsableHook, makeCandidate } from './types.js';

export const DYK_SOURCE = 'enwiki_dyk';

/**
 * DYK kancasının kalıcı anahtarı: `enwiki-dyk:<YYYY-MM-DD>T<HHMM>:<sıra>`.
 * DYK günde 1–3 set yayınlar (00:00, 12:00, bazen 00:11 gibi saatler); sıra set içindedir
 * (0 tabanlı). Bu yüzden set saati anahtarın parçasıdır, yoksa aynı günün setleri çakışır.
 *
 * @param {string} date  YYYY-MM-DD
 * @param {string} hhmm  "HHMM" ya da "HH:MM"
 * @param {number} order 0 tabanlı set içi sıra
 */
export function dykSourceKey(date, hhmm, order) {
  const time = String(hhmm ?? '0000').replace(':', '').padStart(4, '0');
  return `enwiki-dyk:${date}T${time}:${order}`;
}

/**
 * Tek bir DYK kancasının HTML'inden metin ve linkleri çıkarır.
 * @param {string} html  "... that <b><a href=...>X</a></b> ...?" biçiminde parça
 * @returns {{ hookText: string, boldTitle: string | null, firstTitle: string | null }}
 */
export function parseDykHookHtml(html) {
  const hookText = cleanHookText(htmlToText(html), 'en');
  const boldTitle = boldLinkFromHtml(html);
  const [firstTitle = null] = articleLinksFromHtml(html);
  return { hookText, boldTitle, firstTitle };
}

/**
 * DYK adayını kurar; kanca kullanılamazsa null döner.
 * @param {object} input
 * @param {string} input.date
 * @param {string} input.hhmm
 * @param {number} input.order
 * @param {string} input.hookText
 * @param {string | null} input.articleTitle  kalın makale (yoksa ilk makale linki)
 * @param {Record<string, unknown>} [input.meta]
 */
export function buildDykCandidate({ date, hhmm, order, hookText, articleTitle, meta = {} }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isInteger(order) || order < 0) return null;
  if (!isUsableHook(hookText)) return null;
  return makeCandidate({
    source_key: dykSourceKey(date, hhmm, order),
    source: DYK_SOURCE,
    lang: 'en',
    hook_text: hookText,
    source_url: wikiUrl('en', articleTitle),
    source_meta: meta,
  });
}
