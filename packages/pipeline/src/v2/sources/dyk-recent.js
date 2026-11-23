// S2 — EN DYK yeni kancalar: `Wikipedia:Recent_additions` (bu ay; `Wikipedia:Did you know archive`
// sayfasına yönlenir) + geçen ayın arşivi `Wikipedia:Did_you_know_archive/YYYY/Month`.
// MediaWiki API `action=parse` ile HTML okunur; her setin başlığı "12:00, 2 February 2024 (UTC)".
//
// İmleç (`cursor:s2`): `{ after: "<YYYY-MM-DD>T<HHMM>:<sıra>" }` — en son alınan kanca. Sonraki run
// sadece ondan yeni kancaları döndürür (eskiden-yeniye sıralı), böylece aynı iki ay her gün
// yeniden okunsa da limit tekrarlara harcanmaz.
//
// Backfill (`cursor:s2-backfill`, `--backfill-from YYYY-MM`): HF veri setinin bittiği Şubat 2024
// ile S2'nin normal penceresi (bu ay + geçen ay) arasındaki boşluk. Pencerenin bir önceki ayından
// başlayıp ay ay GERİYE, `from` ayına kadar okunur. İmleç `{ next, offset, from, done }`.
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

const SET_HEADER =
  /<b>\s*(\d{1,2}):(\d{2}),\s*(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})\s*\(UTC\)\s*<\/b>/g;
const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MISSING_PAGE_CODES = new Set(['missingtitle', 'invalidtitle']);

/** @param {Date} date @returns {string} "YYYY-MM" (UTC) */
export function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** @param {string} ym  "YYYY-MM" */
export function isMonthKey(ym) {
  return YM.test(String(ym ?? ''));
}

/**
 * "YYYY-MM" ayını `delta` ay kaydırır: shiftMonth('2024-01', -1) === '2023-12'.
 * @param {string} ym
 * @param {number} delta
 */
export function shiftMonth(ym, delta) {
  const match = YM.exec(String(ym));
  if (!match) throw new Error(`Geçersiz ay (YYYY-MM bekleniyor): ${ym}`);
  return monthKey(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1)));
}

/**
 * Bir ayın DYK arşiv sayfası adayları (sırayla denenir; ilk var olan okunur).
 * @param {string} ym
 * @returns {string[]}
 */
export function monthArchivePages(ym) {
  const match = YM.exec(String(ym));
  if (!match) throw new Error(`Geçersiz ay (YYYY-MM bekleniyor): ${ym}`);
  const [, year, month] = match;
  const name = MONTHS[Number(month) - 1];
  return [
    `Wikipedia:Recent_additions/${year}/${name}`,
    `Wikipedia:Did_you_know_archive/${year}/${name}`,
  ];
}

/**
 * Okunacak sayfalar: bu ay (Recent additions) + geçen ayın arşivi.
 * @param {Date} [now]
 * @returns {string[]}
 */
export function recentAdditionsPages(now = new Date()) {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return [
    RECENT_ADDITIONS_PAGE,
    `Wikipedia:Did_you_know_archive/${prev.getUTCFullYear()}/${MONTHS[prev.getUTCMonth()]}`,
  ];
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
        meta: {
          origin: 'enwiki:recent_additions',
          page,
          set: `${date} ${hh.padStart(2, '0')}:${mm} UTC`,
          bold_title: boldTitle,
        },
      });
      order += 1;
      if (candidate) candidates.push(candidate);
      else skipped += 1;
    }
  });

  return { candidates, skipped, sets: headers.length };
}

/**
 * `enwiki-dyk:2024-02-02T1200:3` → `2024-02-02T1200:3` (imleç konumu).
 * @param {string} sourceKey
 */
export function dykPosition(sourceKey) {
  return String(sourceKey ?? '').replace(/^enwiki-dyk:/, '');
}

/**
 * İki DYK konumunu kronolojik karşılaştırır (set zamanı, sonra set içi sıra).
 * @param {string} a  "YYYY-MM-DDTHHMM:order"
 * @param {string} b
 */
export function compareDykPosition(a, b) {
  const [stampA, orderA = '0'] = String(a).split(':');
  const [stampB, orderB = '0'] = String(b).split(':');
  if (stampA !== stampB) return stampA < stampB ? -1 : 1;
  return Number(orderA) - Number(orderB);
}

function sortChronological(candidates) {
  return [...candidates].sort((x, y) =>
    compareDykPosition(dykPosition(x.source_key), dykPosition(y.source_key)),
  );
}

/**
 * Backfill imlecini normalize eder. İmleç yoksa S2 penceresinin bir önceki ayından başlar.
 * @param {any} cursor
 * @param {{ from: string, now: Date }} options
 */
export function normalizeBackfillCursor(cursor, { from, now }) {
  const next = isMonthKey(cursor?.next) ? cursor.next : shiftMonth(monthKey(now), -2);
  const offset = Number.isInteger(cursor?.offset) && cursor.offset > 0 ? cursor.offset : 0;
  return { next, offset, from, done: next < from };
}

/**
 * Bir ayın arşiv sayfasını okur. Hiçbir sayfa adı yoksa `{ missing: true }`.
 * Sayfa var ama hiç set çözülemezse hata fırlatır (biçim değişmiş olabilir; ay sessizce atlanmasın).
 */
async function readMonth(http, ym) {
  for (const page of monthArchivePages(ym)) {
    let result;
    try {
      result = await parsePage(http, EN_WIKI_HOST, page, 'text');
    } catch (error) {
      if (MISSING_PAGE_CODES.has(error?.code)) continue;
      throw error;
    }
    const parsed = parseRecentAdditionsHtml(result.text, { page: result.title });
    if (parsed.sets === 0) throw new Error(`${result.title}: DYK seti bulunamadı`);
    return { page: result.title, ...parsed, candidates: sortChronological(parsed.candidates) };
  }
  return { page: null, missing: true, candidates: [], skipped: 0, sets: 0 };
}

/**
 * Backfill aylarını okur (en fazla `months` ay ya da havuz `limit`'e ulaşana kadar).
 * @returns {Promise<{ entries: Array<{ month: string, startOffset: number, candidates: any[] }>, pool: any[], months: object[] }>}
 */
async function readBackfill({ http, cursor, months, limit }) {
  const entries = [];
  const monthStats = [];
  const pool = [];
  let ym = cursor.next;
  let startOffset = cursor.offset;
  for (let i = 0; i < months && ym >= cursor.from && pool.length < limit; i += 1) {
    let month;
    try {
      month = await readMonth(http, ym);
    } catch (error) {
      monthStats.push({ month: ym, error: error.message });
      break; // imleç bu ayın ötesine geçmez; sonraki run yeniden dener
    }
    const available = month.candidates.slice(startOffset);
    entries.push({ month: ym, startOffset, candidates: month.candidates });
    monthStats.push(
      month.missing
        ? { month: ym, missing: true }
        : {
            month: ym,
            page: month.page,
            sets: month.sets,
            candidates: month.candidates.length,
            skipped: month.skipped,
            offset: startOffset,
          },
    );
    pool.push(...available);
    ym = shiftMonth(ym, -1);
    startOffset = 0;
  }
  return { entries, pool, months: monthStats };
}

/**
 * `taken` adet backfill adayı alındıktan sonraki imleç. Tamamen tüketilen (ya da sayfası olmayan)
 * aylar geçilir; yarım kalan ayda `offset` ilerler.
 */
export function advanceBackfillCursor(cursor, entries, taken) {
  let next = cursor.next;
  let offset = cursor.offset;
  let remaining = taken;
  for (const entry of entries) {
    const available = entry.candidates.length - entry.startOffset;
    if (remaining >= available) {
      remaining -= available;
      next = shiftMonth(entry.month, -1);
      offset = 0;
      continue;
    }
    next = entry.month;
    offset = entry.startOffset + remaining;
    break;
  }
  return { next, offset, from: cursor.from, done: next < cursor.from };
}

/**
 * S2 toplayıcı.
 *
 * @param {object} options
 * @param {{ getJson: (url: string | URL) => Promise<any> }} options.http
 * @param {number} [options.limit]
 * @param {{ after?: string } | null} [options.cursor]
 * @param {Date} [options.now]
 * @param {{ from: string, months?: number, cursor?: any } | null} [options.backfill]
 * @returns {Promise<import('./types.js').CollectResult & { backfill?: { nextCursor: any, stats: object } }>}
 */
export async function collectDykRecent({
  http,
  limit = 200,
  cursor = null,
  now = new Date(),
  backfill = null,
}) {
  const pages = recentAdditionsPages(now);
  const after = typeof cursor?.after === 'string' ? cursor.after : null;
  const seen = new Set();
  const all = [];
  const perPage = {};
  let skipped = 0;
  let sets = 0;
  let pageErrors = 0;

  for (const page of pages) {
    let parsed;
    try {
      const result = await parsePage(http, EN_WIKI_HOST, page, 'text');
      parsed = parseRecentAdditionsHtml(result.text, { page: result.title });
    } catch (error) {
      perPage[page] = { error: error.message };
      pageErrors += 1;
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

  const fresh = sortChronological(
    all.filter((c) => !after || compareDykPosition(dykPosition(c.source_key), after) > 0),
  );

  let backfillRead = null;
  let backfillCursor = null;
  if (backfill?.from) {
    backfillCursor = normalizeBackfillCursor(backfill.cursor, { from: backfill.from, now });
    backfillRead = backfillCursor.done
      ? { entries: [], pool: [], months: [] }
      : await readBackfill({
          http,
          cursor: backfillCursor,
          months: Math.max(1, backfill.months ?? 1),
          limit,
        });
  }

  // Limit paylaşımı: backfill açıksa yeni kancalara en az yarısı ayrılır, kullanılmayan pay diğerine geçer.
  const pool = backfillRead?.pool ?? [];
  const recentTake = backfillRead
    ? Math.min(fresh.length, Math.max(Math.ceil(limit / 2), limit - pool.length))
    : Math.min(fresh.length, limit);
  const recentCandidates = fresh.slice(0, recentTake);
  const backfillTake = backfillRead ? Math.min(pool.length, limit - recentTake) : 0;
  const backfillCandidates = pool.slice(0, backfillTake);

  // Bir sayfa okunamadıysa imleç ilerlemez (okunamayan aydaki kancalar atlanmasın); tekrarlar DB'de elenir.
  const last = recentCandidates.at(-1);
  const nextCursor =
    last && pageErrors === 0 ? { after: dykPosition(last.source_key) } : (cursor ?? null);

  const result = {
    candidates: [...recentCandidates, ...backfillCandidates],
    nextCursor,
    stats: {
      pages: perPage,
      sets,
      available: fresh.length,
      skipped,
      after,
      recent_taken: recentCandidates.length,
    },
  };
  if (backfillRead) {
    const next = backfillCursor.done
      ? backfillCursor
      : advanceBackfillCursor(backfillCursor, backfillRead.entries, backfillTake);
    result.backfill = {
      nextCursor: next,
      stats: {
        from: backfill.from,
        start: { next: backfillCursor.next, offset: backfillCursor.offset },
        months: backfillRead.months,
        available: pool.length,
        taken: backfillTake,
        done: next.done,
      },
    };
    result.stats.backfill_taken = backfillTake;
  }
  return result;
}
