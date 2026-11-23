// S3 — TR Vikipedi "Biliyor muydunuz?" (BM).
// Kaynak sayfalar (MediaWiki API ile bulundu, 2026-11-20):
//   - Günlük sayfalar: `Vikipedi:Biliyor muydunuz?/YYYY-MM-DD` (2021-02-01'den beri, günde 1 kanca).
//     Aylık özet sayfaları (`Vikipedi:Biliyor muydunuz/Ekim 2026`) bunları şablon olarak içerir.
//   - Eski arşiv: `Vikipedi:Biliyor muydunuz?/Arşiv/Ekim 2010 öncesi`, `.../Arşiv/2010-2019`
//     ({{*as}} "..." satırları).
//   - `.../Arşiv/2022+` günlük sayfalarla örtüştüğü için okunmaz (bkz. rapor).
// Günlük sayfalar `generator=allpages` + `prop=revisions` ile 50'şer okunur (wikitext).
import { mediawikiApi } from './http.js';
import { boldLinkFromWikitext, linksFromWikitext, slugify, stripFileLinks, wikiUrl, wikitextToText } from './markup.js';
import { cleanHookText, isUsableHook, makeCandidate } from './types.js';

export const TR_WIKI_HOST = 'tr.wikipedia.org';
export const BM_SOURCE = 'trwiki_bm';
export const BM_DAILY_PREFIX = 'Biliyor muydunuz?/2';
export const BM_ARCHIVE_PAGES = [
  'Vikipedi:Biliyor muydunuz?/Arşiv/Ekim 2010 öncesi',
  'Vikipedi:Biliyor muydunuz?/Arşiv/2010-2019',
];
const PROJECT_NS = 4;
const DAILY_BATCH = 50;

/** Satırı kanca metnine çevirir: {{*as}} öneki, saran tırnaklar, "...ki", wiki işaretlemesi. */
function lineToHook(line) {
  const body = line.replace(/^\s*\{\{\s*\*as\s*\}\}\s*/i, '').trim();
  let text = wikitextToText(body);
  const wrapped = text.match(/^["“](.*)["”]$/);
  if (wrapped) text = wrapped[1].trim();
  return cleanHookText(text, 'tr');
}

function buildBmCandidate({ key, line, meta }) {
  const hookText = lineToHook(line);
  if (!isUsableHook(hookText)) return null;
  const body = stripFileLinks(line);
  const article = boldLinkFromWikitext(body) ?? linksFromWikitext(body)[0] ?? null;
  return makeCandidate({
    source_key: key,
    source: BM_SOURCE,
    lang: 'tr',
    hook_text: hookText,
    source_url: wikiUrl('tr', article),
    source_meta: meta,
  });
}

function stripNoinclude(wikitext) {
  return String(wikitext ?? '')
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '')
    .replace(/<noinclude>[\s\S]*$/i, '');
}

/**
 * Günlük BM sayfasını adaylara çevirir (saf). Her dolu satır bir kancadır (genelde 1).
 *
 * @param {string} title  "Vikipedi:Biliyor muydunuz?/2026-10-05"
 * @param {string} wikitext
 * @returns {{ date: string | null, candidates: import('./types.js').Candidate[], skipped: number }}
 */
export function parseBmDailyPage(title, wikitext) {
  const date = String(title ?? '').match(/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? null;
  if (!date) return { date: null, candidates: [], skipped: 0 };
  const candidates = [];
  let skipped = 0;
  let index = 0;
  for (const line of stripNoinclude(wikitext).split(/\n+/)) {
    if (!line.trim() || /^\s*-{4,}\s*$/.test(line) || /^\s*\[\[\s*(?:kategori|category)\s*:/i.test(line)) continue;
    const candidate = buildBmCandidate({
      key: `trwiki-bm:${date}:${index}`,
      line,
      meta: { origin: 'trwiki:bm_daily', page: title, date },
    });
    if (candidate) {
      candidates.push(candidate);
      index += 1;
    } else if (wikitextToText(line).length > 0) {
      skipped += 1;
    }
  }
  return { date, candidates, skipped };
}

/**
 * Eski arşiv sayfasını ({{*as}} "..." satırları) adaylara çevirir (saf).
 *
 * @param {string} title
 * @param {string} wikitext
 */
export function parseBmArchivePage(title, wikitext) {
  const slug = slugify(String(title ?? '').split('/').pop());
  const candidates = [];
  let skipped = 0;
  let index = 0;
  for (const line of stripNoinclude(wikitext).split('\n')) {
    if (!/^\s*\{\{\s*\*as\s*\}\}/i.test(line)) continue;
    const candidate = buildBmCandidate({
      key: `trwiki-bm:arsiv-${slug}:${index}`,
      line,
      meta: { origin: 'trwiki:bm_archive', page: title },
    });
    index += 1;
    if (candidate) candidates.push(candidate);
    else skipped += 1;
  }
  return { candidates, skipped };
}

function todayIso(now) {
  return now.toISOString().slice(0, 10);
}

/**
 * S3 toplayıcı. Önce günlük sayfalar (kaldığı tarihten sonra), yer kalırsa eski arşiv.
 * `cursor = { dailyFrom: 'YYYY-MM-DD' | null, archiveOffset: number, archiveDone: boolean }`.
 * Bugünden ileri tarihli (zamanlanmış) günlük sayfalar okunmaz.
 *
 * @param {object} options
 * @param {{ getJson: (url: string | URL) => Promise<any> }} options.http
 * @param {number} [options.limit]
 * @param {{ dailyFrom?: string | null, archiveOffset?: number, archiveDone?: boolean } | null} [options.cursor]
 * @param {Date} [options.now]
 * @returns {Promise<import('./types.js').CollectResult>}
 */
export async function collectTrBm({ http, limit = 200, cursor = null, now = new Date() }) {
  const today = todayIso(now);
  let dailyFrom = cursor?.dailyFrom ?? null;
  let archiveOffset = Math.max(0, Number(cursor?.archiveOffset) || 0);
  let archiveDone = Boolean(cursor?.archiveDone);
  const candidates = [];
  let skipped = 0;
  let dailyPages = 0;
  let requests = 0;
  let archiveAvailable = null;

  // 1) Günlük sayfalar
  let cont = null;
  let reachedFuture = false;
  while (candidates.length < limit && !reachedFuture) {
    const params = {
      action: 'query',
      generator: 'allpages',
      gapnamespace: PROJECT_NS,
      gapprefix: BM_DAILY_PREFIX,
      gaplimit: DAILY_BATCH,
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      ...(cont ?? (dailyFrom ? { gapfrom: `Biliyor muydunuz?/${dailyFrom}` } : {})),
    };
    const json = await mediawikiApi(http, TR_WIKI_HOST, params);
    requests += 1;
    const pages = (json?.query?.pages ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
    for (const page of pages) {
      const date = page.title.match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
      if (!date || (dailyFrom && date <= dailyFrom)) continue;
      if (date > today) {
        reachedFuture = true;
        break;
      }
      if (candidates.length >= limit) break;
      const content = page.revisions?.[0]?.slots?.main?.content ?? page.revisions?.[0]?.content ?? '';
      const parsed = parseBmDailyPage(page.title, content);
      candidates.push(...parsed.candidates);
      skipped += parsed.skipped;
      dailyPages += 1;
      dailyFrom = date;
    }
    if (!json?.continue) break;
    cont = json.continue;
  }

  // 2) Eski arşiv (sabit sayfalar)
  if (candidates.length < limit && !archiveDone) {
    const json = await mediawikiApi(http, TR_WIKI_HOST, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: BM_ARCHIVE_PAGES.join('|'),
    });
    requests += 1;
    const byTitle = new Map((json?.query?.pages ?? []).map((p) => [p.title, p]));
    const archive = [];
    for (const title of BM_ARCHIVE_PAGES) {
      const page = byTitle.get(title);
      const content = page?.revisions?.[0]?.slots?.main?.content ?? '';
      const parsed = parseBmArchivePage(title, content);
      archive.push(...parsed.candidates);
      skipped += parsed.skipped;
    }
    archiveAvailable = archive.length;
    const slice = archive.slice(archiveOffset, archiveOffset + (limit - candidates.length));
    candidates.push(...slice);
    archiveOffset += slice.length;
    archiveDone = archiveOffset >= archive.length;
  }

  return {
    candidates,
    nextCursor: { dailyFrom, archiveOffset, archiveDone },
    stats: {
      daily_pages_read: dailyPages,
      daily_last_date: dailyFrom,
      archive_available: archiveAvailable,
      requests,
      skipped,
    },
  };
}
