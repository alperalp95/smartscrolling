// S2 — EN DYK yeni kancalar: `Wikipedia:Recent_additions` (bu ay; `Wikipedia:Did you know archive`
// sayfasına yönlenir) + geçen ayın arşivi `Wikipedia:Did_you_know_archive/YYYY/Month`.
// MediaWiki API `action=parse` ile HTML okunur; her setin başlığı "12:00, 2 February 2024 (UTC)".
import { buildDykCandidate, parseDykHookHtml } from './dyk.js';
import { parsePage } from './http.js';
import { htmlToText } from './markup.js';

export const EN_WIKI_HOST = 'en.wikipedia.org';
export const RECENT_ADDITIONS_PAGE = 'Wikipedia:Recent_additions';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SET_HEADER = /<b>\s*(\d{1,2}):(\d{2}),\s*(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})\s*\(UTC\)\s*<\/b>/g;

/**
 * Okunacak sayfalar: bu ay (Recent additions) + geçen ayın arşivi.
 * @param {Date} [now]
 * @returns {string[]}
 */
export function recentAdditionsPages(now = new Date()) {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return [RECENT_ADDITIONS_PAGE, `Wikipedia:Did_you_know_archive/${prev.getUTCFullYear()}/${MONTHS[prev.getUTCMonth()]}`];
}

/**
 * Recent additions / DYK arşiv sayfası HTML'ini adaylara çevirir (saf).
 * Sıra (order) set içindeki kanca konumudur (0 tabanlı) — HF veri setindeki `order` ile aynı.
 *
 * @param {string} html
 * @param {{ page?: string }} [context]
 * @returns {{ candidates: import('./types.js').Candidate[], skipped: number, sets: number }}
 */
export function parseRecentAdditionsHtml(html, { page = RECENT_ADDITIONS_PAGE } = {}) {
  const source = String(html ?? '');
  const headers = [...source.matchAll(SET_HEADER)];
  const candidates = [];
  let skipped = 0;

  headers.forEach((header, index) => {
    const [, hh, mm, day, monthName, year] = header;
    const month = MONTHS.indexOf(monthName);
    if (month === -1) return;
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hhmm = `${hh.padStart(2, '0')}${mm}`;
    const chunkEnd = index + 1 < headers.length ? headers[index + 1].index : source.length;
    const chunk = source.slice(header.index + header[0].length, chunkEnd);

    let order = 0;
    for (const li of chunk.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = htmlToText(li[1]);
      if (!/^(?:\.{2,}|…)/.test(text)) continue; // set başlığı, navigasyon vb.
      const { hookText, boldTitle, firstTitle } = parseDykHookHtml(li[1]);
      const candidate = buildDykCandidate({
        date,
        hhmm,
        order,
        hookText,
        articleTitle: boldTitle || firstTitle,
        meta: { origin: 'enwiki:recent_additions', page, set: `${date} ${hh.padStart(2, '0')}:${mm} UTC`, bold_title: boldTitle },
      });
      order += 1;
      if (candidate) candidates.push(candidate);
      else skipped += 1;
    }
  });

  return { candidates, skipped, sets: headers.length };
}

/**
 * S2 toplayıcı. Her run bu ay + geçen ayı yeniden okur (tekrarlar `source_key` ile elenir),
 * bu yüzden `nextCursor` her zaman null.
 *
 * @param {object} options
 * @param {{ getJson: (url: string | URL) => Promise<any> }} options.http
 * @param {number} [options.limit]
 * @param {Date} [options.now]
 * @returns {Promise<import('./types.js').CollectResult>}
 */
export async function collectDykRecent({ http, limit = 200, now = new Date() }) {
  const pages = recentAdditionsPages(now);
  const seen = new Set();
  const all = [];
  const perPage = {};
  let skipped = 0;
  let sets = 0;

  for (const page of pages) {
    let parsed;
    try {
      const result = await parsePage(http, EN_WIKI_HOST, page, 'text');
      parsed = parseRecentAdditionsHtml(result.text, { page: result.title });
    } catch (error) {
      perPage[page] = { error: error.message };
      continue;
    }
    perPage[page] = { candidates: parsed.candidates.length, sets: parsed.sets };
    skipped += parsed.skipped;
    sets += parsed.sets;
    for (const candidate of parsed.candidates) {
      if (seen.has(candidate.source_key)) continue;
      seen.add(candidate.source_key);
      all.push(candidate);
    }
  }

  return {
    candidates: all.slice(0, limit),
    nextCursor: null,
    stats: { pages: perPage, sets, available: all.length, skipped },
  };
}
