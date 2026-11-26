#!/usr/bin/env node
// İçerik hattı v2 — mevcut v2 kartları (facts) için Vikipedi/Commons kapak görseli (facts.media_url).
// Eski kartlara (source_key boş) dokunulmaz.
//
// Kullanım:
//   node src/runners/v2-backfill-media.js                 # dry-run (varsayılan): DB'ye yazmaz
//   node src/runners/v2-backfill-media.js --limit 50      # en fazla 50 satır (varsayılan 100)
//   node src/runners/v2-backfill-media.js --apply         # GERÇEKTEN yaz
//
// Seçim: source_key dolu, media_url boş, status published/queued.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWikiImage } from '../v2/media/wiki-image.js';

export const DEFAULT_LIMIT = 100;
export const DELAY_MS = 300;

export class UsageError extends Error {}

export function parseArgs(argv) {
  const opts = { apply: false, dryRunFlag: false, limit: DEFAULT_LIMIT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--dry-run') opts.dryRunFlag = true;
    else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const value = arg === '--limit' ? argv[++i] : arg.slice('--limit='.length);
      const n = Number(value);
      if (value === undefined || value === '' || !Number.isInteger(n) || n <= 0) {
        throw new UsageError(`--limit pozitif tam sayı olmalı (şu an: ${JSON.stringify(value)})`);
      }
      opts.limit = n;
    } else {
      throw new UsageError(`bilinmeyen argüman: ${arg}`);
    }
  }
  if (opts.apply && opts.dryRunFlag) {
    throw new UsageError('--apply ve --dry-run birlikte verilemez');
  }
  return { apply: opts.apply, dryRun: !opts.apply, limit: opts.limit };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string[]} argv
 * @param {{ client: any, resolveImage?: (url: string) => Promise<string|null>, sleep?: (ms: number) => Promise<void>, log?: (line: string) => void }} deps
 */
export async function run(argv = [], deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const resolveImage = deps.resolveImage ?? ((url) => resolveWikiImage(url));
  const sleep = deps.sleep ?? defaultSleep;
  const result = { processed: 0, written: 0, not_found: 0, errors: 0 };
  try {
    const args = parseArgs(argv);
    const { client } = deps;

    const { data, error } = await client
      .from('facts')
      .select('id,title,source_url')
      .not('source_key', 'is', null)
      .is('media_url', null)
      .in('status', ['published', 'queued'])
      .order('id', { ascending: true })
      .limit(args.limit);
    if (error) throw new Error(`facts okunamadı: ${error.message ?? error}`);
    const rows = data ?? [];

    log(
      `[v2-backfill-media] mod: ${args.apply ? 'apply' : 'dry-run (yazma yok; yazmak için --apply)'}`,
    );
    log(`[v2-backfill-media] işlenecek satır: ${rows.length} (limit ${args.limit})`);

    for (const row of rows) {
      result.processed += 1;
      try {
        const url = await resolveImage(row.source_url);
        log(`[v2-backfill-media] ${row.title} → ${url ?? 'yok'}`);
        if (!url) {
          result.not_found += 1;
        } else if (args.apply) {
          const { error: upErr } = await client
            .from('facts')
            .update({ media_url: url })
            .eq('id', row.id)
            .is('media_url', null);
          if (upErr) throw new Error(upErr.message ?? String(upErr));
          result.written += 1;
        }
      } catch (err) {
        result.errors += 1;
        log(`[v2-backfill-media] hata ${row.id}: ${err?.message ?? err}`);
      }
      await sleep(DELAY_MS);
    }

    log(
      `işlenen=${result.processed}, yazılan=${result.written}, bulunamadı=${result.not_found}, hata=${result.errors}`,
    );
    return { exitCode: result.errors > 0 ? 1 : 0, result };
  } catch (err) {
    log(`[v2-backfill-media] HATA: ${err?.message ?? err}`);
    return { exitCode: 1, result };
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let deps;
  try {
    await import('dotenv/config');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
    const { createClient } = await import('@supabase/supabase-js');
    deps = { client: createClient(url, key, { auth: { persistSession: false } }) };
  } catch (err) {
    process.stderr.write(`[v2-backfill-media] HATA: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }
  const { exitCode } = await run(argv, deps);
  process.exitCode = exitCode;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
