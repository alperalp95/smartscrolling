#!/usr/bin/env node
// İçerik hattı v2 — yayın adımı: stoktaki ('queued') kartlardan günlük N kartı 'published' yapar.
// Spec: docs/specs/content-pipeline-v2.md §5 adım 8–9, §8 alarm.
//
// Kullanım:
//   node src/runners/v2-publish.js                 # dry-run (varsayılan): hiçbir şey yazmaz
//   node src/runners/v2-publish.js --count 50      # günlük adedi config yerine 50 al
//   node src/runners/v2-publish.js --json          # sonucu stdout'a tek satır JSON bas (insan çıktısı stderr'e)
//   node src/runners/v2-publish.js --apply         # GERÇEKTEN yayınla
//
// Çıkış kodu: 0 = başarılı (stok alarmı olsa bile; alarm V2-08'de Issue'ya çevrilir), 1 = hata.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPublishRepo, selectForPublish, stockStatus } from '../v2/publish/index.js';

export const DEFAULT_CONFIG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config/pipeline.config.json',
);

/** Kategori kotasının doldurabilmesi için günlük adedin kaç katı aday çekilir. */
export const CANDIDATE_POOL_FACTOR = 5;

export class UsageError extends Error {}

/** pipeline.config.json → { dailyCount, minStockDays } */
export function loadPublishConfig(filePath = DEFAULT_CONFIG_PATH) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`config okunamadı/JSON geçersiz (${filePath}): ${err.message}`);
  }
  const publish = raw?.publish ?? {};
  const { dailyCount, minStockDays } = publish;
  if (!Number.isInteger(dailyCount) || dailyCount <= 0) {
    throw new Error(`config publish.dailyCount pozitif tam sayı olmalı (şu an: ${JSON.stringify(dailyCount)})`);
  }
  if (typeof minStockDays !== 'number' || !Number.isFinite(minStockDays) || minStockDays < 0) {
    throw new Error(`config publish.minStockDays 0 ya da pozitif sayı olmalı (şu an: ${JSON.stringify(minStockDays)})`);
  }
  return { dailyCount, minStockDays };
}

export function parseArgs(argv) {
  const opts = { count: null, apply: false, dryRunFlag: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--dry-run') opts.dryRunFlag = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--count' || arg.startsWith('--count=')) {
      const value = arg === '--count' ? argv[++i] : arg.slice('--count='.length);
      const n = Number(value);
      if (value === undefined || value === '' || !Number.isInteger(n) || n <= 0) {
        throw new UsageError(`--count pozitif tam sayı olmalı (şu an: ${JSON.stringify(value)})`);
      }
      opts.count = n;
    } else {
      throw new UsageError(`bilinmeyen argüman: ${arg}`);
    }
  }
  if (opts.apply && opts.dryRunFlag) {
    throw new UsageError('--apply ve --dry-run birlikte verilemez');
  }
  return { count: opts.count, apply: opts.apply, dryRun: !opts.apply, json: opts.json };
}

function formatCategories(byCategory) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return entries.length ? entries.map(([cat, n]) => `${cat}=${n}`).join(', ') : '(yok)';
}

/**
 * Test edilebilir çekirdek. Ağ/DB'ye sadece enjekte edilen `repo` üzerinden gider.
 *
 * @param {{
 *   argv?: string[],
 *   repo: { listQueued(limit: number): Promise<any[]>, markPublished(ids: any[], now: Date): Promise<{ publishedIds: any[] }>, countQueued(): Promise<number> },
 *   publishConfig?: { dailyCount: number, minStockDays: number },
 *   now?: Date,
 *   stdout?: (line: string) => void,
 *   stderr?: (line: string) => void,
 * }} deps
 * @returns {Promise<{ exitCode: 0|1, result: object }>}
 */
export async function runPublish({
  argv = [],
  repo,
  publishConfig,
  now = new Date(),
  stdout = (line) => process.stdout.write(`${line}\n`),
  stderr = (line) => process.stderr.write(`${line}\n`),
} = {}) {
  let json = argv.includes('--json');
  // --json: stdout'ta sadece JSON olsun (workflow okusun), insan çıktısı stderr'e.
  const log = (line) => (json ? stderr(line) : stdout(line));

  try {
    const args = parseArgs(argv);
    json = args.json;
    const config = publishConfig ?? loadPublishConfig();
    const dailyCount = args.count ?? config.dailyCount;

    const queuedBefore = await repo.countQueued();
    const candidates = await repo.listQueued(dailyCount * CANDIDATE_POOL_FACTOR);
    const selection = selectForPublish(candidates, { dailyCount });

    let publishedIds = [];
    if (args.apply) {
      ({ publishedIds } = await repo.markPublished(selection.selected, now));
    }

    // Stok, bugünkü yayından SONRA kalan kartla hesaplanır (dry-run'da tahmini).
    const outgoing = args.apply ? publishedIds.length : selection.selected.length;
    const queuedAfter = Math.max(0, queuedBefore - outgoing);
    const stock = stockStatus({ queuedCount: queuedAfter, dailyCount, minStockDays: config.minStockDays });

    const result = {
      ok: true,
      mode: args.apply ? 'apply' : 'dry-run',
      now: now.toISOString(),
      dailyCount,
      queuedBefore,
      candidates: candidates.length,
      selectedCount: selection.selected.length,
      publishedCount: publishedIds.length,
      selected: selection.selected,
      byCategory: selection.byCategory,
      filledBeyondQuota: selection.filledBeyondQuota,
      queuedAfter,
      minStockDays: config.minStockDays,
      stockDays: stock.stockDays,
      belowTarget: stock.belowTarget,
      alarm: stock.alarm,
    };

    log(`[v2-publish] mod: ${result.mode}${args.apply ? '' : ' (yazma yok; yayınlamak için --apply)'}`);
    log(`[v2-publish] seçilen: ${result.selectedCount}/${dailyCount} (aday ${result.candidates}, stok ${queuedBefore})`);
    if (args.apply) log(`[v2-publish] yayınlanan: ${result.publishedCount}`);
    log(`[v2-publish] kategori dağılımı: ${formatCategories(result.byCategory)}`);
    if (result.filledBeyondQuota > 0) log(`[v2-publish] kota aşılarak doldurulan: ${result.filledBeyondQuota}`);
    log(`[v2-publish] stok: ${result.stockDays} gün (${queuedAfter} kart; hedef ≥ ${config.minStockDays} gün)${stock.belowTarget ? ' — HEDEFİN ALTINDA' : ''}`);
    log(`[v2-publish] alarm: ${stock.alarm ? 'VAR (stok 3 günün altında)' : 'yok'}`);
    if (json) stdout(JSON.stringify(result));

    return { exitCode: 0, result };
  } catch (err) {
    const result = { ok: false, error: err?.message ?? String(err) };
    stderr(`[v2-publish] HATA: ${result.error}`);
    if (json) stdout(JSON.stringify(result));
    return { exitCode: 1, result };
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  let repo;
  try {
    await import('dotenv/config');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
    const { createClient } = await import('@supabase/supabase-js');
    repo = createPublishRepo(createClient(url, key, { auth: { persistSession: false } }));
  } catch (err) {
    process.stderr.write(`[v2-publish] HATA: ${err.message}\n`);
    if (wantsJson) process.stdout.write(`${JSON.stringify({ ok: false, error: err.message })}\n`);
    process.exitCode = 1;
    return;
  }
  const { exitCode } = await runPublish({ argv, repo });
  process.exitCode = exitCode;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
