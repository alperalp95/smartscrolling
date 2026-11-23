#!/usr/bin/env node
// Content pipeline v2 — adım 1 "Topla": kaynaklardan kancaları toplar.
//
//   node src/runners/v2-collect.js [--source s1|s2|s3|s4|all] [--limit 200] [--mix s3:all,s4:10,s2:15,s1:rest]
//                                  [--backfill-from YYYY-MM] [--backfill-months 1] [--dry-run | --apply]
//
// `--limit` TOPLAM aday sayısını sınırlar; `--mix` kaynak sırasını ve paylarını belirler (`all`/`rest`:
// kalan payın tamamı, sayı: en fazla o kadar). Varsayılan: önce TR (S3) kancalar, sonra S4'ten 10,
// yeni DYK (S2) en fazla 15 (niş/ABD-İngiltere ağırlıklı), kalan S1 arşivine.
//
// `--backfill-from YYYY-MM`: S2, normal penceresinin (bu ay + geçen ay) öncesindeki DYK aylarını geriye
// doğru bu aya kadar okur; her run en fazla `--backfill-months` ay ilerler (imleç `cursor:s2-backfill`).
//
// Varsayılan dry-run: DB'ye yazmaz, imleçleri yerel `.cache/v2-collect-state.json`'dan okur (ilerletmez),
// `.cache/v2-collect-<source>-<YYYY-MM-DD>.json` yazar ve konsola kaynak başına sayı + 5 örnek basar.
// `--apply`: adaylar `fact_candidates`'e yazılır; imleçler `pipeline_state` tablosundan okunur ve
// başarılı yazımdan sonra ilerletilir (anahtarlar `cursor:s1` … `cursor:s4`, `cursor:s2-backfill`).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertCandidates } from '../v2/db/candidates-repo.js';
import { getState, setState } from '../v2/db/state-repo.js';
import { COLLECTORS, SOURCE_IDS, createHttpClient } from '../v2/sources/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_DIR = path.resolve(__dirname, '..', '..', '.cache');
export const DEFAULT_LIMIT = 200;
export const DEFAULT_MIX = 's3:all,s4:10,s2:15,s1:rest';
export const DEFAULT_BACKFILL_MONTHS = 1;
export const BACKFILL_CURSOR_KEY = 'cursor:s2-backfill';
const SAMPLE_COUNT = 5;

/** @param {string} id */
export const cursorKey = (id) => `cursor:${id}`;

function positiveInt(raw, label) {
  const text = String(raw ?? '').trim();
  const n = Number.parseInt(text, 10);
  if (!/^\d+$/.test(text) || !Number.isInteger(n) || n <= 0) throw new Error(`${label} pozitif tam sayı olmalı: ${raw}`);
  return n;
}

/**
 * `s3:all,s4:10,s2:15,s1:rest` → `[{ id: 's2', quota: 'all' }, …, { id: 's4', quota: 30 }, …]`.
 * @param {string} spec
 * @returns {Array<{ id: string, quota: 'all' | 'rest' | number }>}
 */
export function parseMix(spec) {
  const entries = [];
  const seen = new Set();
  let rest = 0;
  for (const part of String(spec ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const [rawId, rawQuota = 'all', extra] = part.split(':').map((p) => p.trim().toLowerCase());
    if (extra !== undefined || !SOURCE_IDS.includes(rawId)) throw new Error(`--mix geçersiz giriş: ${part}`);
    if (seen.has(rawId)) throw new Error(`--mix kaynak iki kez geçiyor: ${rawId}`);
    seen.add(rawId);
    let quota;
    if (rawQuota === 'all' || rawQuota === 'rest') quota = rawQuota;
    else if (/^\d+$/.test(rawQuota)) quota = Number(rawQuota);
    else throw new Error(`--mix payı all|rest|sayı olmalı: ${part}`);
    if (quota === 'rest') rest += 1;
    entries.push({ id: rawId, quota });
  }
  if (entries.length === 0) throw new Error('--mix boş olamaz');
  if (rest > 1) throw new Error('--mix içinde en fazla bir "rest" olabilir');
  return entries;
}

/**
 * Sıralı pay dağıtımı: kaynak, kalan toplam limitten payını alır (`all`/`rest` → kalanın tamamı).
 * @param {{ quota: 'all' | 'rest' | number }} entry
 * @param {number} remaining
 */
export function shareFor(entry, remaining) {
  if (remaining <= 0) return 0;
  return entry.quota === 'all' || entry.quota === 'rest' ? remaining : Math.min(entry.quota, remaining);
}

/**
 * @param {string[]} args  process.argv.slice(2)
 */
export function parseArgs(args) {
  let source = 'all';
  let limit = DEFAULT_LIMIT;
  let apply = false;
  let mixSpec = DEFAULT_MIX;
  let backfillFrom = null;
  let backfillMonths = DEFAULT_BACKFILL_MONTHS;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const value = () => inline ?? args[++i];
    if (flag === '--source') source = String(value() ?? '').toLowerCase();
    else if (flag === '--limit') limit = positiveInt(value(), '--limit');
    else if (flag === '--mix') mixSpec = String(value() ?? '');
    else if (flag === '--backfill-from') {
      backfillFrom = String(value() ?? '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(backfillFrom)) throw new Error(`--backfill-from YYYY-MM olmalı: ${backfillFrom}`);
    } else if (flag === '--backfill-months') backfillMonths = positiveInt(value(), '--backfill-months');
    else if (flag === '--apply') apply = true;
    else if (flag === '--dry-run') apply = false;
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  if (source !== 'all' && !SOURCE_IDS.includes(source)) {
    throw new Error(`--source şunlardan biri olmalı: ${[...SOURCE_IDS, 'all'].join('|')}`);
  }
  let mix = parseMix(mixSpec);
  if (source !== 'all') {
    mix = mix.filter((entry) => entry.id === source);
    if (mix.length === 0) mix = [{ id: source, quota: 'rest' }];
  }
  return { source, sources: mix.map((entry) => entry.id), limit, apply, mix, backfillFrom, backfillMonths };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function defaultGetClient() {
  await import('dotenv/config');
  const { supabase } = await import('../lib/supabase.js');
  return supabase;
}

/**
 * İmleç deposu. `--apply`: `pipeline_state` (okur + yazar). Dry-run: yerel `.cache` dosyası, sadece okunur.
 */
async function createCursorStore({ apply, client, stateFile, getStateFn, setStateFn }) {
  if (apply) {
    return {
      kind: 'db',
      get: (key) => getStateFn(client, key),
      set: (key, value) => setStateFn(client, key, value),
    };
  }
  const state = await readJson(stateFile, {});
  return {
    kind: 'file',
    // eski dosya biçimi `{ s1: … }` da okunur
    get: async (key) => state[key] ?? state[key.replace(/^cursor:/, '')] ?? null,
    set: async () => {},
  };
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {Record<string, { name: string, collect: Function }>} [options.collectors]
 * @param {{ getJson: Function }} [options.http]
 * @param {() => Promise<any>} [options.getClient]  sadece --apply'da çağrılır
 * @param {(client: any, candidates: any[]) => Promise<{ inserted: number, skipped: number }>} [options.insert]
 * @param {(client: any, key: string) => Promise<any>} [options.getState]  sadece --apply'da
 * @param {(client: any, key: string, value: any) => Promise<void>} [options.setState]  sadece --apply'da
 * @param {string} [options.cacheDir]
 * @param {Date} [options.now]
 * @param {(line: string) => void} [options.log]
 */
export async function runCollect({
  args = process.argv.slice(2),
  collectors = COLLECTORS,
  http = createHttpClient(),
  getClient = defaultGetClient,
  insert = insertCandidates,
  getState: getStateFn = getState,
  setState: setStateFn = setState,
  cacheDir = DEFAULT_CACHE_DIR,
  now = new Date(),
  log = console.log,
} = {}) {
  const config = parseArgs(args);
  const stateFile = path.join(cacheDir, 'v2-collect-state.json');
  const date = now.toISOString().slice(0, 10);
  const mixLabel = config.mix.map((e) => `${e.id}:${e.quota}`).join(',');

  log(
    `[v2-collect] mode=${config.apply ? 'APPLY' : 'dry-run'} source=${config.source} limit=${config.limit} (toplam) mix=${mixLabel}` +
      (config.backfillFrom ? ` backfill-from=${config.backfillFrom} backfill-months=${config.backfillMonths}` : ''),
  );

  const client = config.apply ? await getClient() : null;
  const cursors = await createCursorStore({ apply: config.apply, client, stateFile, getStateFn, setStateFn });
  const summary = {};
  const allCandidates = [];
  let failed = 0;
  let remaining = config.limit;

  for (const entry of config.mix) {
    const { id } = entry;
    const collector = collectors[id];
    const share = shareFor(entry, remaining);
    if (share <= 0) {
      summary[id] = { name: collector.name, share: 0, count: 0, skipped: 'limit' };
      log(`\n[${id}] ${collector.name}: atlandı (toplam limit doldu)`);
      continue;
    }
    const started = Date.now();
    try {
      const cursor = await cursors.get(cursorKey(id));
      const backfill =
        id === 's2' && config.backfillFrom
          ? { from: config.backfillFrom, months: config.backfillMonths, cursor: await cursors.get(BACKFILL_CURSOR_KEY) }
          : null;
      const result = await collector.collect({ http, limit: share, cursor, now, ...(backfill ? { backfill } : {}) });
      const candidates = result.candidates.slice(0, share);
      const record = {
        name: collector.name,
        share,
        count: candidates.length,
        cursor: cursor ?? null,
        nextCursor: result.nextCursor ?? null,
        stats: result.stats ?? {},
        ms: Date.now() - started,
      };
      if (result.backfill) record.backfill = result.backfill;
      if (config.apply) {
        record.db = await insert(client, candidates);
        // Başarısız yazımda (insert fırlatırsa) imleç ilerlemez; null imleç yazılmaz.
        if (result.nextCursor != null) await cursors.set(cursorKey(id), result.nextCursor);
        if (result.backfill?.nextCursor != null) await cursors.set(BACKFILL_CURSOR_KEY, result.backfill.nextCursor);
      }
      summary[id] = record;
      allCandidates.push(...candidates);
      remaining -= candidates.length;

      log(
        `\n[${id}] ${collector.name}: ${record.count} aday (pay ${share})` +
          (record.db ? ` → inserted=${record.db.inserted} skipped=${record.db.skipped}` : ''),
      );
      if (result.backfill) {
        const bf = result.backfill;
        const months = (bf.stats?.months ?? [])
          .map((m) => `${m.month}${m.missing ? ' (sayfa yok)' : m.error ? ` (HATA ${m.error})` : ` (${m.candidates} kanca)`}`)
          .join(', ');
        log(`  backfill: ${bf.stats?.taken ?? 0} aday · okunan aylar: ${months || '-'} · sonraki imleç ${JSON.stringify(bf.nextCursor)}`);
      }
      for (const c of candidates.slice(0, SAMPLE_COUNT)) {
        log(`  - ${c.hook_text.length > 180 ? `${c.hook_text.slice(0, 177)}...` : c.hook_text}`);
        log(`    ${c.source_key}  ${c.source_url ?? '-'}`);
      }
    } catch (error) {
      failed += 1;
      summary[id] = { name: collector.name, share, error: error.message, ms: Date.now() - started };
      log(`\n[${id}] ${collector.name}: HATA ${error.message}`);
    }
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const outFile = path.join(cacheDir, `v2-collect-${config.source}-${date}.json`);
  await fs.writeFile(
    outFile,
    `${JSON.stringify(
      {
        generated_at: now.toISOString(),
        dry_run: !config.apply,
        source: config.source,
        limit: config.limit,
        mix: mixLabel,
        backfill_from: config.backfillFrom,
        backfill_months: config.backfillMonths,
        cursor_store: cursors.kind,
        summary,
        candidates: allCandidates,
      },
      null,
      2,
    )}\n`,
  );

  log(`\n[v2-collect] toplam ${allCandidates.length} aday · çıktı: ${outFile}${config.apply ? '' : ' · DB yazılmadı (dry-run)'}`);
  return { config, summary, candidates: allCandidates, outFile, failed };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCollect()
    .then(({ failed }) => {
      if (failed > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[v2-collect] ${error.message}`);
      process.exitCode = 1;
    });
}
