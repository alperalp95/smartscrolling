#!/usr/bin/env node
// Seriler — config/series.json'daki maddeleri Vikipedi'den çeker, kartlara böler, `series` tablosuna yazar.
// Metin kaynaktan aynen alınır (LLM yok).
//
// Kullanım (packages/pipeline içinde):
//   node src/runners/series-import.js                          # deneme: sadece .cache/series-<slug>.json yazar
//   node src/runners/series-import.js --apply                  # DB'ye taslak (draft) olarak yazar
//   node src/runners/series-import.js --apply --publish <slug> # yalnız o seriyi içe aktarır ve yayınlar
//   node src/runners/series-import.js --apply --publish-all    # hepsini içe aktarır ve yayınlar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_MAX_CHARS, splitIntoCards, summarizeSections } from '../series/split.js';
import { filterSections, parseWikiExtract } from '../series/wiki-sections.js';
import { pickCommonsImage } from '../v2/media/wiki-image.js';

export const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';
export const WIKI_API = 'https://tr.wikipedia.org/w/api.php';
export const DELAY_MS = 300;
const FETCH_TIMEOUT_MS = 30000;
const SUMMARY_MAX = 240;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = path.resolve(HERE, '../../config/series.json');
export const DEFAULT_CACHE_DIR = path.resolve(HERE, '../../.cache');

// `facts` ile aynı kategori metinleri.
export const CATEGORIES = [
  '🔬 BİLİM',
  '📜 TARİH',
  '🧠 FELSEFE',
  '💻 TEKNOLOJİ',
  '🌱 SAĞLIK',
  '🌍 ÇEVRE',
  '🎨 SANAT & KÜLTÜR',
  '🏆 SPOR',
  '👤 BİYOGRAFİ',
];

const ALLOWED_FIELDS = new Set(['title', 'free', 'category', 'sections']);
const TR_ASCII = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

export class UsageError extends Error {}

/** Başlıktan Türkçe-uyumlu kısa ad: `İbn Haldun` → `ibn-haldun`. */
export function slugify(title) {
  return String(title)
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (ch) => TR_ASCII[ch])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * series.json doğrulaması. `_` ile başlayan alanlar (açıklamalar) yok sayılır.
 * @returns {{ errors: string[], items: Array<{ title: string, slug: string, free: boolean, category: string, sections: string[]|null }> }}
 */
export function validateSeriesConfig(raw) {
  const errors = [];
  const items = [];
  const list = raw?.series;
  if (!Array.isArray(list) || list.length === 0) {
    return { errors: ['"series" boş olmayan bir liste olmalı'], items };
  }
  const seen = new Map();
  list.forEach((entry, index) => {
    const label = `#${index + 1}${entry?.title ? ` (${entry.title})` : ''}`;
    const before = errors.length;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${label}: madde bir nesne olmalı`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!key.startsWith('_') && !ALLOWED_FIELDS.has(key)) {
        errors.push(`${label}: bilinmeyen alan: ${key}`);
      }
    }
    if (typeof entry.title !== 'string' || !entry.title.trim()) {
      errors.push(`${label}: başlık (title) eksik`);
    }
    if (!CATEGORIES.includes(entry.category)) {
      errors.push(`${label}: kategori listede yok: ${JSON.stringify(entry.category)}`);
    }
    if (entry.free !== undefined && typeof entry.free !== 'boolean') {
      errors.push(`${label}: free true ya da false olmalı`);
    }
    const sec = entry.sections;
    const secOk =
      sec === null ||
      sec === undefined ||
      (Array.isArray(sec) && sec.every((s) => typeof s === 'string' && s.trim()));
    if (!secOk) errors.push(`${label}: sections null ya da başlık listesi olmalı`);
    if (errors.length > before) return;

    const slug = slugify(entry.title);
    if (!slug) {
      errors.push(`${label}: slug üretilemedi`);
      return;
    }
    if (seen.has(slug)) {
      errors.push(`${label}: slug tekrarı "${slug}" (${seen.get(slug)} ile aynı)`);
      return;
    }
    seen.set(slug, label);
    items.push({
      title: entry.title.trim(),
      slug,
      free: entry.free === true,
      category: entry.category,
      sections: sec ?? null,
    });
  });
  return { errors, items };
}

export function parseArgs(argv) {
  const opts = { apply: false, publish: [], publishAll: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--publish-all') opts.publishAll = true;
    else if (arg === '--publish' || arg.startsWith('--publish=')) {
      const value = arg === '--publish' ? argv[++i] : arg.slice('--publish='.length);
      if (!value || value.startsWith('--')) throw new UsageError('--publish bir slug ister');
      opts.publish.push(value);
    } else throw new UsageError(`bilinmeyen argüman: ${arg}`);
  }
  if ((opts.publish.length > 0 || opts.publishAll) && !opts.apply) {
    throw new UsageError('--publish / --publish-all için --apply gerekli');
  }
  return opts;
}

/** Kısa özet: ilk karttan, cümle sonunda (ya da kelime sınırında) kesilir. */
function makeSummary(body) {
  if (!body || body.length <= SUMMARY_MAX) return body ?? null;
  const cut = body.slice(0, SUMMARY_MAX);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > 40) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/**
 * Tek maddenin düz metni, sürüm numarası ve (yalnız Commons) kapak görseli.
 * @returns {Promise<{ title: string, text: string, revid: number|null, cover: string|null }>}
 */
export async function fetchWikiPage(title, { fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'extracts|revisions|pageimages',
    explaintext: '1',
    exsectionformat: 'wiki',
    rvprop: 'ids',
    piprop: 'thumbnail|original',
    pithumbsize: '960',
    pilicense: 'free',
    titles: title,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${WIKI_API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res?.ok) throw new Error(`HTTP ${res?.status ?? '?'} (${title})`);
    const page = (await res.json())?.query?.pages?.[0];
    if (!page || page.missing || typeof page.extract !== 'string') {
      throw new Error(`madde bulunamadı: ${title}`);
    }
    return {
      title: page.title ?? title,
      text: page.extract,
      revid: page.revisions?.[0]?.revid ?? null,
      cover: pickCommonsImage({ thumbnail: page.thumbnail, originalimage: page.original }),
    };
  } finally {
    clearTimeout(timer);
  }
}

const wikiUrl = (title) =>
  `https://tr.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

function buildSeries(item, page) {
  const sections = filterSections(parseWikiExtract(page.text, page.title), item.sections);
  const cards = splitIntoCards(sections, { maxChars: DEFAULT_MAX_CHARS });
  if (cards.length === 0) throw new Error(`kart üretilemedi: ${item.title}`);
  const sectionSummary = summarizeSections(cards);
  return {
    slug: item.slug,
    row: {
      slug: item.slug,
      title: item.title,
      summary: makeSummary(cards[0].body),
      category: item.category,
      cover_url: page.cover,
      source_title: page.title,
      source_url: wikiUrl(page.title),
      source_revid: page.revid,
      section_count: sectionSummary.length,
      sections: sectionSummary,
      is_free: item.free,
    },
    cards: cards.map((c) => ({
      position: c.position,
      section_title: c.sectionTitle,
      body: c.body,
    })),
  };
}

async function writeSeries(client, built, publish) {
  const { data: existing, error: readErr } = await client
    .from('series')
    .select('id,status')
    .eq('slug', built.slug)
    .maybeSingle();
  if (readErr) throw new Error(`series okunamadı: ${readErr.message ?? readErr}`);

  let id = existing?.id;
  if (id) {
    // Var olan serinin durumu (yayında/taslak) korunur.
    const { error } = await client.from('series').update(built.row).eq('id', id);
    if (error) throw new Error(`series güncellenemedi: ${error.message ?? error}`);
  } else {
    const { data, error } = await client
      .from('series')
      .insert({ ...built.row, status: 'draft' })
      .select('id')
      .single();
    if (error) throw new Error(`series eklenemedi: ${error.message ?? error}`);
    id = data.id;
  }

  const { error: rpcErr } = await client.rpc('replace_series_cards', {
    p_series_id: id,
    p_cards: built.cards,
  });
  if (rpcErr) throw new Error(`replace_series_cards hatası: ${rpcErr.message ?? rpcErr}`);

  if (publish && existing?.status !== 'published') {
    const { error } = await client
      .from('series')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`yayınlanamadı: ${error.message ?? error}`);
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string[]} argv
 * @param {{ client?: any, fetchImpl?: Function, config?: object, configPath?: string, cacheDir?: string, sleep?: Function, log?: Function }} deps
 */
export async function run(argv = [], deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const sleep = deps.sleep ?? defaultSleep;
  const cacheDir = deps.cacheDir ?? DEFAULT_CACHE_DIR;
  const result = { processed: 0, written: 0, published: 0, errors: 0 };
  try {
    const args = parseArgs(argv);
    const raw =
      deps.config ?? JSON.parse(fs.readFileSync(deps.configPath ?? DEFAULT_CONFIG_PATH, 'utf8'));
    const { errors, items } = validateSeriesConfig(raw);
    if (errors.length > 0) {
      for (const e of errors) log(`[series-import] config hatası: ${e}`);
      throw new Error(`series.json geçersiz (${errors.length} hata)`);
    }

    let selected = items;
    if (!args.publishAll && args.publish.length > 0) {
      const known = new Set(items.map((i) => i.slug));
      const unknown = args.publish.filter((s) => !known.has(s));
      if (unknown.length > 0)
        throw new UsageError(`series.json'da olmayan slug: ${unknown.join(', ')}`);
      selected = items.filter((i) => args.publish.includes(i.slug));
    }
    const publish = args.publishAll || args.publish.length > 0;
    if (args.apply && !deps.client) throw new Error('--apply için Supabase istemcisi gerekli');

    log(
      `[series-import] mod: ${args.apply ? 'apply' : 'dry-run (DB yazma yok; yazmak için --apply)'}`,
    );
    fs.mkdirSync(cacheDir, { recursive: true });

    for (const item of selected) {
      result.processed += 1;
      try {
        const page = await fetchWikiPage(item.title, { fetchImpl: deps.fetchImpl });
        const built = buildSeries(item, page);
        fs.writeFileSync(
          path.join(cacheDir, `series-${item.slug}.json`),
          `${JSON.stringify({ ...built.row, cards: built.cards }, null, 2)}\n`,
        );
        log(
          `[series-import] ${item.slug}: ${built.cards.length} kart, ${built.row.section_count} bölüm, kapak ${built.row.cover_url ? 'var' : 'yok'}`,
        );
        if (args.apply) {
          await writeSeries(deps.client, built, publish);
          result.written += 1;
          if (publish) result.published += 1;
        }
      } catch (err) {
        result.errors += 1;
        log(`[series-import] hata ${item.slug}: ${err?.message ?? err}`);
      }
      await sleep(DELAY_MS);
    }
    log(
      `işlenen=${result.processed}, yazılan=${result.written}, yayınlanan=${result.published}, hata=${result.errors}`,
    );
    return { exitCode: result.errors > 0 ? 1 : 0, result };
  } catch (err) {
    log(`[series-import] HATA: ${err?.message ?? err}`);
    return { exitCode: 1, result };
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const deps = {};
  if (argv.includes('--apply')) {
    try {
      await import('dotenv/config');
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
      const { createClient } = await import('@supabase/supabase-js');
      deps.client = createClient(url, key, { auth: { persistSession: false } });
    } catch (err) {
      process.stderr.write(`[series-import] HATA: ${err.message}\n`);
      process.exitCode = 1;
      return;
    }
  }
  const { exitCode } = await run(argv, deps);
  process.exitCode = exitCode;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
