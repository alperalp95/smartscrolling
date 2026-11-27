#!/usr/bin/env node
// Seriler — Türkçe Vikipedi "Seçkin" ve "Kaliteli" maddelerini aday olarak listeler.
// Her madde için karakter sayısı, tahmini kart sayısı ve Commons kapak bilgisi çıkarılır.
// Yalnızca okuma yapar; veritabanına dokunmaz. Çıktı: .cache/series-candidates.json
//
// Kullanım (packages/pipeline içinde):
//   node src/runners/series-candidates.js
//   node src/runners/series-candidates.js --limit 20   # her kategoriden ilk 20 madde (deneme)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_MAX_CHARS, splitIntoCards } from '../series/split.js';
import { filterSections, parseWikiExtract } from '../series/wiki-sections.js';
import {
  DEFAULT_CACHE_DIR,
  DELAY_MS,
  USER_AGENT,
  UsageError,
  WIKI_API,
  fetchWikiPage,
} from './series-import.js';

export const CANDIDATE_CATEGORIES = ['Kategori:Seçkin maddeler', 'Kategori:Kaliteli maddeler'];

export function parseArgs(argv) {
  const opts = { limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit' || arg.startsWith('--limit=')) {
      const value = arg === '--limit' ? argv[++i] : arg.slice('--limit='.length);
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) throw new UsageError('--limit pozitif tam sayı olmalı');
      opts.limit = n;
    } else throw new UsageError(`bilinmeyen argüman: ${arg}`);
  }
  return opts;
}

async function listCategoryMembers(category, fetchImpl) {
  const titles = [];
  let cont = null;
  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'page',
      cmnamespace: '0',
      cmlimit: '500',
    });
    if (cont) for (const [k, v] of Object.entries(cont)) params.set(k, v);
    const res = await fetchImpl(`${WIKI_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res?.ok) throw new Error(`kategori okunamadı: ${category} (HTTP ${res?.status ?? '?'})`);
    const json = await res.json();
    for (const m of json?.query?.categorymembers ?? []) titles.push(m.title);
    cont = json?.continue ?? null;
  } while (cont);
  return titles;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string[]} argv
 * @param {{ fetchImpl?: Function, cacheDir?: string, sleep?: Function, log?: Function }} deps
 */
export async function run(argv = [], deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const sleep = deps.sleep ?? defaultSleep;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cacheDir = deps.cacheDir ?? DEFAULT_CACHE_DIR;
  const items = [];
  let errors = 0;
  try {
    const args = parseArgs(argv);
    const seen = new Set();
    const titles = [];
    for (const category of CANDIDATE_CATEGORIES) {
      const members = await listCategoryMembers(category, fetchImpl);
      const part = args.limit ? members.slice(0, args.limit) : members;
      log(`[series-candidates] ${category}: ${members.length} madde (işlenecek ${part.length})`);
      for (const t of part) {
        if (!seen.has(t)) {
          seen.add(t);
          titles.push({ title: t, list: category.replace('Kategori:', '') });
        }
      }
    }

    for (const { title, list } of titles) {
      try {
        const page = await fetchWikiPage(title, { fetchImpl });
        const sections = filterSections(parseWikiExtract(page.text, page.title), null);
        const cards = splitIntoCards(sections, { maxChars: DEFAULT_MAX_CHARS });
        items.push({
          title,
          list,
          chars: sections.reduce((n, s) => n + s.text.length, 0),
          estimatedCards: cards.length,
          hasCommonsCover: page.cover !== null,
          revid: page.revid,
        });
      } catch (err) {
        errors += 1;
        log(`[series-candidates] hata ${title}: ${err?.message ?? err}`);
      }
      await sleep(DELAY_MS);
    }

    items.sort((a, b) => b.chars - a.chars);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'series-candidates.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }, null, 2)}\n`,
    );
    const withCover = items.filter((i) => i.hasCommonsCover).length;
    log(
      `[series-candidates] toplam=${items.length}, Commons kapaklı=${withCover}, hata=${errors}. Dosya: .cache/series-candidates.json`,
    );
    for (const i of items.slice(0, 10)) {
      log(
        `  ${i.title}: ${i.chars} karakter, ~${i.estimatedCards} kart, kapak ${i.hasCommonsCover ? 'var' : 'yok'}`,
      );
    }
    return { exitCode: errors > 0 ? 1 : 0, items };
  } catch (err) {
    log(`[series-candidates] HATA: ${err?.message ?? err}`);
    return { exitCode: 1, items };
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const { exitCode } = await run(process.argv.slice(2));
  process.exitCode = exitCode;
}
