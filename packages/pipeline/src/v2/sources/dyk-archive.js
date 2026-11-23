// S1 — EN DYK arşivi: Hugging Face veri seti `derenrich/enwiki-did-you-know` (97K kanca +
// görüntülenme sayıları). Dosya indirilmez; datasets-server JSON API ile sayfalı okunur.
import { buildDykCandidate, parseDykHookHtml } from './dyk.js';
import { htmlToText } from './markup.js';
import { cleanHookText } from './types.js';

export const HF_DATASET = 'derenrich/enwiki-did-you-know';
export const HF_API_BASE = 'https://datasets-server.huggingface.co';
/** datasets-server `/rows` için izin verilen en büyük sayfa. */
export const HF_PAGE_SIZE = 100;

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Tek bir HF satırını adaya çevirir (saf). Bozuk/boş satırda null.
 *
 * @param {{ row_idx?: number, row: Record<string, any> }} item
 * @returns {import('./types.js').Candidate | null}
 */
export function parseDykArchiveRow(item) {
  const row = item?.row;
  if (!row) return null;
  const ts = String(row.timestamp ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!ts) return null;
  const order = Number(row.order);

  let hookText = '';
  let boldTitle = null;
  let firstTitle = null;
  if (row.dyk_html) {
    ({ hookText, boldTitle, firstTitle } = parseDykHookHtml(row.dyk_html));
  }
  if (!hookText && row.dyk_text) hookText = cleanHookText(htmlToText(row.dyk_text), 'en');

  return buildDykCandidate({
    date: ts[1],
    hhmm: `${ts[2]}${ts[3]}`,
    order,
    hookText,
    articleTitle: row.subject_article || boldTitle || firstTitle,
    meta: {
      origin: 'hf:derenrich/enwiki-did-you-know',
      row_idx: item.row_idx ?? null,
      timestamp: row.timestamp,
      subject: row.subject ?? null,
      views: numberOrNull(row.day_of_views),
      views_day_before: numberOrNull(row.day_before_views),
      views_day_after: numberOrNull(row.day_after_views),
    },
  });
}

/**
 * `/rows` yanıtını adaylara çevirir (saf). `limit` dolunca durur; `consumed` okunan satır sayısıdır
 * (atlanan bozuk satırlar dahil) — offset ilerlemesi bununla yapılır.
 *
 * @param {{ rows: Array<{ row_idx: number, row: object }> }} page
 * @param {number} [limit]
 */
export function parseDykArchiveRows(page, limit = Number.POSITIVE_INFINITY) {
  const candidates = [];
  let consumed = 0;
  let skipped = 0;
  for (const item of page?.rows ?? []) {
    if (candidates.length >= limit) break;
    consumed += 1;
    const candidate = parseDykArchiveRow(item);
    if (candidate) candidates.push(candidate);
    else skipped += 1;
  }
  return { candidates, consumed, skipped };
}

/**
 * `/splits` yanıtından config/split seçer (tercihen default/train).
 * @param {{ splits?: Array<{ config: string, split: string }> }} json
 */
export function pickSplit(json) {
  const splits = json?.splits ?? [];
  if (splits.length === 0) throw new Error(`HF splits boş: ${HF_DATASET}`);
  return (
    splits.find((s) => s.config === 'default' && s.split === 'train') ??
    splits.find((s) => s.split === 'train') ??
    splits[0]
  );
}

/**
 * S1 toplayıcı. `cursor = { offset, total }` kaldığı yerden devam eder; `exhausted: true` olunca
 * (veri seti bitti) yeni istek atılmaz.
 *
 * @param {object} options
 * @param {{ getJson: (url: string | URL) => Promise<any> }} options.http
 * @param {number} [options.limit]
 * @param {{ offset?: number, total?: number | null, exhausted?: boolean } | null} [options.cursor]
 * @returns {Promise<import('./types.js').CollectResult>}
 */
export async function collectDykArchive({ http, limit = 200, cursor = null }) {
  const splitsUrl = new URL('/splits', HF_API_BASE);
  splitsUrl.searchParams.set('dataset', HF_DATASET);
  const { config, split } = pickSplit(await http.getJson(splitsUrl));

  const startOffset = Math.max(0, Number(cursor?.offset) || 0);
  let offset = startOffset;
  // Önceki run veri setinin sonuna geldiyse tekrar istek atma (veri seti sabit).
  let total = Number.isFinite(cursor?.total) ? cursor.total : null;
  let skipped = 0;
  let pages = 0;
  const candidates = [];

  while (candidates.length < limit && (total === null || offset < total)) {
    const url = new URL('/rows', HF_API_BASE);
    url.searchParams.set('dataset', HF_DATASET);
    url.searchParams.set('config', config);
    url.searchParams.set('split', split);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('length', String(HF_PAGE_SIZE));
    const page = await http.getJson(url);
    pages += 1;
    total = Number(page?.num_rows_total ?? 0);
    if (!page?.rows?.length) break;

    const parsed = parseDykArchiveRows(page, limit - candidates.length);
    candidates.push(...parsed.candidates);
    skipped += parsed.skipped;
    offset += parsed.consumed;
  }

  return {
    candidates,
    nextCursor: { offset, total, exhausted: total !== null && offset >= total },
    stats: {
      dataset: HF_DATASET,
      config,
      split,
      start_offset: startOffset,
      next_offset: offset,
      total_rows: total,
      pages,
      skipped,
    },
  };
}
