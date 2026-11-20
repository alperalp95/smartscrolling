#!/usr/bin/env node
// Content pipeline v2 — adım 1 "Topla": kaynaklardan kancaları toplar.
//
//   node src/runners/v2-collect.js --source s1|s2|s3|s4|all [--limit 200] [--dry-run | --apply]
//
// Varsayılan dry-run: DB'ye yazmaz, sadece `.cache/v2-collect-<source>-<YYYY-MM-DD>.json` yazar ve
// konsola kaynak başına sayı + 5 örnek kanca basar. `--apply` verilirse adaylar `fact_candidates`
// tablosuna yazılır ve kaynak imleçleri (`.cache/v2-collect-state.json`) ilerletilir.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertCandidates } from '../v2/db/candidates-repo.js';
import { COLLECTORS, SOURCE_IDS, createHttpClient } from '../v2/sources/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_DIR = path.resolve(__dirname, '..', '..', '.cache');
export const DEFAULT_LIMIT = 200;
const SAMPLE_COUNT = 5;

/**
 * @param {string[]} args  process.argv.slice(2)
 * @returns {{ source: string, sources: string[], limit: number, apply: boolean }}
 */
export function parseArgs(args) {
  let source = 'all';
  let limit = DEFAULT_LIMIT;
  let apply = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const [flag, inline] = arg.split('=');
    const value = () => inline ?? args[++i];
    if (flag === '--source') source = String(value() ?? '').toLowerCase();
    else if (flag === '--limit') {
      const n = Number.parseInt(value(), 10);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`--limit pozitif tam sayı olmalı: ${arg}`);
      limit = n;
    } else if (flag === '--apply') apply = true;
    else if (flag === '--dry-run') apply = false;
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  if (source !== 'all' && !SOURCE_IDS.includes(source)) {
    throw new Error(`--source şunlardan biri olmalı: ${[...SOURCE_IDS, 'all'].join('|')}`);
  }
  return { source, sources: source === 'all' ? SOURCE_IDS : [source], limit, apply };
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
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {Record<string, { name: string, collect: Function }>} [options.collectors]
 * @param {{ getJson: Function }} [options.http]
 * @param {() => Promise<any>} [options.getClient]  sadece --apply'da çağrılır
 * @param {(client: any, candidates: any[]) => Promise<{ inserted: number, skipped: number }>} [options.insert]
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
  cacheDir = DEFAULT_CACHE_DIR,
  now = new Date(),
  log = console.log,
} = {}) {
  const config = parseArgs(args);
  const stateFile = path.join(cacheDir, 'v2-collect-state.json');
  const state = await readJson(stateFile, {});
  const date = now.toISOString().slice(0, 10);

  log(`[v2-collect] mode=${config.apply ? 'APPLY' : 'dry-run'} source=${config.source} limit=${config.limit} (kaynak başına)`);

  const client = config.apply ? await getClient() : null;
  const summary = {};
  const allCandidates = [];
  let failed = 0;

  for (const id of config.sources) {
    const collector = collectors[id];
    const started = Date.now();
    try {
      const result = await collector.collect({ http, limit: config.limit, cursor: state[id] ?? null, now });
      const entry = {
        name: collector.name,
        count: result.candidates.length,
        nextCursor: result.nextCursor ?? null,
        stats: result.stats ?? {},
        ms: Date.now() - started,
      };
      if (config.apply) {
        entry.db = await insert(client, result.candidates);
        state[id] = result.nextCursor ?? null;
      }
      summary[id] = entry;
      allCandidates.push(...result.candidates);

      log(`\n[${id}] ${collector.name}: ${entry.count} aday${entry.db ? ` → inserted=${entry.db.inserted} skipped=${entry.db.skipped}` : ''}`);
      for (const c of result.candidates.slice(0, SAMPLE_COUNT)) {
        log(`  - ${c.hook_text.length > 180 ? `${c.hook_text.slice(0, 177)}...` : c.hook_text}`);
        log(`    ${c.source_key}  ${c.source_url ?? '-'}`);
      }
    } catch (error) {
      failed += 1;
      summary[id] = { name: collector.name, error: error.message, ms: Date.now() - started };
      log(`\n[${id}] ${collector.name}: HATA ${error.message}`);
    }
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const outFile = path.join(cacheDir, `v2-collect-${config.source}-${date}.json`);
  await fs.writeFile(
    outFile,
    `${JSON.stringify(
      { generated_at: now.toISOString(), dry_run: !config.apply, source: config.source, limit: config.limit, summary, candidates: allCandidates },
      null,
      2,
    )}\n`,
  );
  if (config.apply) await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);

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
