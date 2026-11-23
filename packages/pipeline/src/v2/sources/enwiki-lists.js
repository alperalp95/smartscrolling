// S4 — EN Wikipedia listeleri:
//   - "List of common misconceptions" → bugün `Lists of common misconceptions` dizin sayfası;
//     alt listeler ("List of common misconceptions about ...") `action=parse` HTML ile okunur.
//     Her madde bir düzeltme cümlesidir; hook_text = maddenin ilk 1–2 cümlesi.
//   - `Wikipedia:Unusual articles` → alt sayfalar (`Wikipedia:Unusual articles/Food` ...) wikitext
//     tablolarından okunur; hook_text = makale adı + listedeki kısa açıklama.
import { mediawikiApi, parsePage } from './http.js';
import {
  articleLinksFromHtml,
  boldLinkFromWikitext,
  firstSentences,
  htmlToText,
  linksFromWikitext,
  replaceBalanced,
  slugify,
  wikiUrl,
  wikitextToText,
} from './markup.js';
import { isUsableHook, makeCandidate } from './types.js';

export const EN_WIKI_HOST = 'en.wikipedia.org';
export const MISCONCEPTIONS_INDEX = 'List of common misconceptions';
export const MISCONCEPTIONS_FALLBACK_PAGES = [
  'List of common misconceptions about arts and culture',
  'List of common misconceptions about history',
  'List of common misconceptions about science, technology, and mathematics',
];
const MISCONCEPTIONS_PREFIX = 'List of common misconceptions about ';
export const UNUSUAL_PAGE = 'Wikipedia:Unusual articles';
/** Makale listelemeyen alt sayfalar. */
const UNUSUAL_SKIP_SUBPAGES = new Set(['Categories', 'Other pages']);
const MAX_HOOK_CHARS = 600;

const END_SECTIONS =
  /<h2\b[^>]*\bid="(?:See_also|References|Notes|Citations|Sources|Further_reading|External_links|Bibliography)(?:_\d+)?"/i;

/* ----------------------------- misconceptions ----------------------------- */

/**
 * Dizin sayfasının linklerinden alt liste sayfalarını seçer (saf).
 * @param {Array<{ ns: number, title: string, exists?: boolean }>} links
 * @returns {string[]}
 */
export function pickMisconceptionSubpages(links) {
  const pages = (links ?? [])
    .filter((l) => l.ns === 0 && l.exists !== false && l.title.startsWith(MISCONCEPTIONS_PREFIX))
    .map((l) => l.title);
  return pages.length > 0 ? [...new Set(pages)].sort() : MISCONCEPTIONS_FALLBACK_PAGES;
}

function hookFromItemText(text) {
  let hook = firstSentences(text, 2);
  if (hook.length > MAX_HOOK_CHARS) hook = firstSentences(text, 1);
  if (hook.length > MAX_HOOK_CHARS)
    hook = `${hook.slice(0, MAX_HOOK_CHARS - 1).replace(/\s+\S*$/, '')}…`;
  return hook;
}

/**
 * Misconceptions alt liste sayfasının HTML'ini adaylara çevirir (saf).
 * Üst düzey <ul><li> maddeleri alınır; iç içe alt maddeler, görseller, tablolar, içindekiler
 * ve "See also/References" sonrası atlanır.
 *
 * @param {string} html
 * @param {string} pageTitle
 * @returns {{ candidates: import('./types.js').Candidate[], skipped: number }}
 */
export function parseMisconceptionsHtml(html, pageTitle) {
  let body = String(html ?? '');
  const end = body.search(END_SECTIONS);
  if (end !== -1) body = body.slice(0, end);
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<figure\b[\s\S]*?<\/figure>/gi, '');
  body = replaceBalanced(body, '<table', '</table>');

  const pageSlug = slugify(
    pageTitle.startsWith(MISCONCEPTIONS_PREFIX)
      ? pageTitle.slice(MISCONCEPTIONS_PREFIX.length)
      : pageTitle,
  );
  const candidates = [];
  const seenKeys = new Set();
  let skipped = 0;
  let section = 'intro';
  const counters = new Map();

  const tagRe = /<(\/?)(ul|ol|li|h[2-4])\b([^>]*)>/gi;
  const stack = []; // 'ul' | 'ol'
  let itemStart = -1;
  let itemDepth = -1;
  let itemSkip = false;
  let m;
  while ((m = tagRe.exec(body))) {
    const [full, closing, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if (tag.startsWith('h') && !closing) {
      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      if (id && id !== 'mw-toc-heading') section = slugify(id.replace(/_/g, ' ')) || section;
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (closing) stack.pop();
      else stack.push(tag);
      continue;
    }
    if (tag !== 'li') continue;
    if (!closing) {
      if (itemStart === -1 && stack.length === 1 && stack[0] === 'ul') {
        itemStart = m.index + full.length;
        itemDepth = stack.length;
        itemSkip = /\bclass="[^"]*(?:toclevel|gallerybox|mw-empty-elt)/.test(attrs);
      }
      continue;
    }
    if (itemStart !== -1 && stack.length === itemDepth) {
      const inner = body.slice(itemStart, m.index);
      itemStart = -1;
      if (itemSkip) continue;
      const count = counters.get(section) ?? 0;
      counters.set(section, count + 1);
      const own = replaceBalanced(replaceBalanced(inner, '<ul', '</ul>'), '<ol', '</ol>');
      const hook = hookFromItemText(htmlToText(own));
      const key = `enwiki-misconceptions:${pageSlug}:${section}:${count}`;
      if (!isUsableHook(hook) || seenKeys.has(key)) {
        skipped += 1;
        continue;
      }
      seenKeys.add(key);
      const [article = null] = articleLinksFromHtml(own);
      candidates.push(
        makeCandidate({
          source_key: key,
          source: 'enwiki_misconceptions',
          lang: 'en',
          hook_text: hook,
          source_url: wikiUrl('en', article) ?? wikiUrl('en', pageTitle),
          source_meta: {
            origin: 'enwiki:misconceptions',
            page: pageTitle,
            section,
            list_url: wikiUrl('en', pageTitle),
          },
        }),
      );
    }
  }
  return { candidates, skipped };
}

/* -------------------------------- unusual -------------------------------- */

/**
 * Ana "Unusual articles" sayfasının wikitext'inden alt sayfa adlarını çıkarır ({{/Food}} ...) (saf).
 * @param {string} wikitext
 * @returns {string[]} tam sayfa adları
 */
export function pickUnusualSubpages(wikitext) {
  const names = [...String(wikitext ?? '').matchAll(/\{\{\s*\/([^{}|]+?)\s*\}\}/g)].map((x) =>
    x[1].trim(),
  );
  return [...new Set(names)]
    .filter((n) => !UNUSUAL_SKIP_SUBPAGES.has(n))
    .map((n) => `${UNUSUAL_PAGE}/${n}`);
}

/** Tablo hücresinin başındaki `width="30%" |` gibi öznitelik kısmını atar. */
function stripCellAttributes(cell) {
  let depth = 0;
  for (let i = 0; i < cell.length; i += 1) {
    const two = cell.slice(i, i + 2);
    if (two === '[[' || two === '{{') {
      depth += 1;
      i += 1;
    } else if (two === ']]' || two === '}}') {
      depth -= 1;
      i += 1;
    } else if (cell[i] === '|' && depth === 0) {
      const prefix = cell.slice(0, i);
      return /^\s*[\w-]+\s*=/.test(prefix) ? cell.slice(i + 1) : cell;
    }
  }
  return cell;
}

/** Satırı `||` ile hücrelere böler (link/şablon içindeki | hariç). */
function splitInlineCells(line) {
  const cells = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < line.length; i += 1) {
    const two = line.slice(i, i + 2);
    if (two === '[[' || two === '{{') depth += 1;
    if (two === ']]' || two === '}}') depth -= 1;
    if (two === '||' && depth === 0) {
      cells.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += line[i];
  }
  cells.push(current);
  return cells;
}

/**
 * Unusual articles alt sayfasının wikitext tablolarını adaylara çevirir (saf).
 *
 * @param {string} wikitext
 * @param {string} pageTitle
 * @returns {{ candidates: import('./types.js').Candidate[], skipped: number }}
 */
export function parseUnusualWikitext(wikitext, pageTitle) {
  const candidates = [];
  const seen = new Set();
  let skipped = 0;
  let section = '';
  let inTable = false;
  let row = null;

  const flush = () => {
    if (!row || row.header || row.cells.length < 2) {
      row = null;
      return;
    }
    const [articleCell, ...rest] = row.cells.map(stripCellAttributes);
    row = null;
    const title = boldLinkFromWikitext(articleCell) ?? linksFromWikitext(articleCell)[0] ?? null;
    const label = wikitextToText(articleCell);
    const description = wikitextToText(rest.join(' '));
    const url = wikiUrl('en', title);
    if (!title || !url || !label || !description) {
      skipped += 1;
      return;
    }
    const key = `enwiki-unusual:${decodeURIComponent(url.split('/wiki/')[1])}`;
    const hook = `${label} — ${description}`;
    if (seen.has(key) || !isUsableHook(hook)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    candidates.push(
      makeCandidate({
        source_key: key,
        source: 'enwiki_unusual',
        lang: 'en',
        hook_text: hook,
        source_url: url,
        source_meta: {
          origin: 'enwiki:unusual_articles',
          page: pageTitle,
          section,
          title: title.replace(/_/g, ' '),
        },
      }),
    );
  };

  for (const rawLine of String(wikitext ?? '').split('\n')) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(={2,4})\s*(.+?)\s*\1\s*$/);
    if (heading && !inTable) {
      section = wikitextToText(heading[2]);
      continue;
    }
    if (/^\s*\{\|/.test(line)) {
      inTable = true;
      row = null;
      continue;
    }
    if (!inTable) continue;
    if (/^\s*\|\}/.test(line)) {
      flush();
      inTable = false;
      continue;
    }
    if (/^\s*\|-/.test(line)) {
      flush();
      row = { cells: [], header: false };
      continue;
    }
    if (/^\s*\|\+/.test(line)) continue; // tablo başlığı
    if (/^\s*!/.test(line)) {
      row = row ?? { cells: [], header: true };
      row.header = true;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      row = row ?? { cells: [], header: false };
      row.cells.push(...splitInlineCells(line.replace(/^\s*\|/, '')));
      continue;
    }
    if (row && row.cells.length > 0) row.cells[row.cells.length - 1] += ` ${line}`;
  }
  flush();
  return { candidates, skipped };
}

/* ------------------------------- collector ------------------------------- */

async function fetchWikitexts(http, titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await mediawikiApi(http, EN_WIKI_HOST, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: titles.slice(i, i + 50).join('|'),
    });
    for (const page of json?.query?.pages ?? []) {
      out.set(page.title, page.revisions?.[0]?.slots?.main?.content ?? '');
    }
  }
  return out;
}

/**
 * S4 toplayıcı. Listeler sabit olduğu için her run sayfaları baştan okur, ofsetle ilerler.
 * Limit iki liste arasında yarı yarıya bölünür (biri biterse kalan diğerine geçer).
 * `cursor = { misconceptionsOffset, unusualOffset }`.
 *
 * @param {object} options
 * @param {{ getJson: (url: string | URL) => Promise<any> }} options.http
 * @param {number} [options.limit]
 * @param {{ misconceptionsOffset?: number, unusualOffset?: number } | null} [options.cursor]
 * @returns {Promise<import('./types.js').CollectResult>}
 */
export async function collectEnwikiLists({ http, limit = 200, cursor = null }) {
  const errors = [];

  // Misconceptions
  const misconceptions = [];
  let misSkipped = 0;
  let subpages = MISCONCEPTIONS_FALLBACK_PAGES;
  try {
    const index = await parsePage(http, EN_WIKI_HOST, MISCONCEPTIONS_INDEX, 'links');
    subpages = pickMisconceptionSubpages(index.links);
  } catch (error) {
    errors.push(`${MISCONCEPTIONS_INDEX}: ${error.message}`);
  }
  for (const page of subpages) {
    try {
      const parsed = await parsePage(http, EN_WIKI_HOST, page, 'text');
      const result = parseMisconceptionsHtml(parsed.text, parsed.title);
      misconceptions.push(...result.candidates);
      misSkipped += result.skipped;
    } catch (error) {
      errors.push(`${page}: ${error.message}`);
    }
  }

  // Unusual articles
  const unusual = [];
  let unusualSkipped = 0;
  let unusualSubpages = [];
  try {
    const main = await fetchWikitexts(http, [UNUSUAL_PAGE]);
    unusualSubpages = pickUnusualSubpages(main.get(UNUSUAL_PAGE));
    const texts = await fetchWikitexts(http, unusualSubpages);
    const seen = new Set();
    for (const title of unusualSubpages) {
      const result = parseUnusualWikitext(texts.get(title) ?? '', title);
      unusualSkipped += result.skipped;
      for (const c of result.candidates) {
        if (seen.has(c.source_key)) continue;
        seen.add(c.source_key);
        unusual.push(c);
      }
    }
  } catch (error) {
    errors.push(`${UNUSUAL_PAGE}: ${error.message}`);
  }

  // Limit paylaşımı
  const misOffset = Math.max(0, Number(cursor?.misconceptionsOffset) || 0);
  const unuOffset = Math.max(0, Number(cursor?.unusualOffset) || 0);
  const misLeft = Math.max(0, misconceptions.length - misOffset);
  const unuLeft = Math.max(0, unusual.length - unuOffset);
  let misTake = Math.min(misLeft, Math.ceil(limit / 2));
  const unuTake = Math.min(unuLeft, limit - misTake);
  misTake = Math.min(misLeft, limit - unuTake);

  const candidates = [
    ...misconceptions.slice(misOffset, misOffset + misTake),
    ...unusual.slice(unuOffset, unuOffset + unuTake),
  ];

  return {
    candidates,
    nextCursor: { misconceptionsOffset: misOffset + misTake, unusualOffset: unuOffset + unuTake },
    stats: {
      misconceptions_pages: subpages,
      misconceptions_available: misconceptions.length,
      unusual_subpages: unusualSubpages.length,
      unusual_available: unusual.length,
      skipped: misSkipped + unusualSkipped,
      errors,
    },
  };
}
