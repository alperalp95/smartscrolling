#!/usr/bin/env node
// İçerik hattı v2 — mevcut kartlar (facts) için embedding + content_hash doldurma.
// Tekrar önleme (dedup-card) yeni kartları eski kartlarla karşılaştırabilsin diye.
//
// Kullanım:
//   node src/runners/v2-backfill-embeddings.js                 # dry-run (varsayılan): DB'ye yazmaz, LLM çağırmaz
//   node src/runners/v2-backfill-embeddings.js --limit 200     # en fazla 200 satır (varsayılan 1000)
//   node src/runners/v2-backfill-embeddings.js --apply         # GERÇEKTEN yaz
//
// Seçim: embedding IS NULL olan satırlar (tüm statüler), id sırasıyla. 50'lik gruplar halinde
// embed edilir, her grup sonrası yazılır; yarıda kesilirse kalan sonraki çalıştırmada devam eder.
// Metin biçimi dedup-card ile aynı: title.trim() + '\n' + content.trim().
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from '../dedup/index.js';

export const BATCH_SIZE = 50;
export const DEFAULT_LIMIT = 1000;
const PG_UNIQUE_VIOLATION = '23505';

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

/** dedup-card.cardText ile aynı biçim: title\ncontent */
export function factText(row) {
  return `${String(row?.title ?? '').trim()}\n${String(row?.content ?? '').trim()}`;
}

/**
 * @param {string[]} argv
 * @param {{ client: any, llm?: any, log?: (line: string) => void }} deps
 * @returns {Promise<{ exitCode: 0|1, result: { processed: number, written: number, duplicate_hash: number, errors: number } }>}
 */
export async function run(argv = [], deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const result = { processed: 0, written: 0, duplicate_hash: 0, errors: 0 };
  try {
    const args = parseArgs(argv);
    const { client, llm } = deps;

    const { data, error } = await client
      .from('facts')
      .select('id,title,content,content_hash')
      .is('embedding', null)
      .order('id', { ascending: true })
      .limit(args.limit);
    if (error) throw new Error(`facts okunamadı: ${error.message ?? error}`);
    const rows = data ?? [];

    log(
      `[v2-backfill] mod: ${args.apply ? 'apply' : 'dry-run (yazma/LLM yok; yazmak için --apply)'}`,
    );
    log(`[v2-backfill] işlenecek satır: ${rows.length} (limit ${args.limit})`);

    if (!args.apply) {
      for (const row of rows.slice(0, 2)) {
        log(`[v2-backfill] örnek ${row.id}: ${JSON.stringify(factText(row))}`);
      }
      result.processed = rows.length;
      log(`işlenen=${result.processed}, yazılan=0, duplicate_hash=0, hata=0`);
      return { exitCode: 0, result };
    }
    if (!llm) throw new Error('llm gerekli');

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const group = rows.slice(i, i + BATCH_SIZE);
      result.processed += group.length;
      const texts = group.map(factText);
      let vectors;
      try {
        ({ vectors } = await llm.embed(texts));
        if (!Array.isArray(vectors) || vectors.length !== group.length) {
          throw new Error('embedding sayısı satır sayısıyla uyuşmuyor');
        }
      } catch (err) {
        result.errors += group.length;
        log(`[v2-backfill] grup ${i / BATCH_SIZE + 1} atlandı (embedding hatası): ${err.message}`);
        continue;
      }

      for (let j = 0; j < group.length; j += 1) {
        const row = group[j];
        const patch = { embedding: vectors[j] };
        const wantHash = !row.content_hash;
        if (wantHash) patch.content_hash = contentHash(texts[j]);

        let { error: upErr } = await client.from('facts').update(patch).eq('id', row.id);
        if (upErr && wantHash && upErr.code === PG_UNIQUE_VIOLATION) {
          result.duplicate_hash += 1;
          log(`[v2-backfill] duplicate_hash: ${row.id} (hash boş bırakıldı)`);
          ({ error: upErr } = await client
            .from('facts')
            .update({ embedding: vectors[j] })
            .eq('id', row.id));
        }
        if (upErr) {
          result.errors += 1;
          log(`[v2-backfill] yazma hatası ${row.id}: ${upErr.message ?? upErr}`);
        } else {
          result.written += 1;
        }
      }
    }

    log(
      `işlenen=${result.processed}, yazılan=${result.written}, duplicate_hash=${result.duplicate_hash}, hata=${result.errors}`,
    );
    return { exitCode: result.errors > 0 ? 1 : 0, result };
  } catch (err) {
    log(`[v2-backfill] HATA: ${err?.message ?? err}`);
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
    const client = createClient(url, key, { auth: { persistSession: false } });
    // LLM sadece --apply'da gerekir (dry-run LLM çağırmaz, anahtar da istemez).
    let llm;
    if (argv.includes('--apply')) {
      const { createLlm, loadConfig } = await import('../llm/index.js');
      llm = createLlm(loadConfig(), { env: process.env });
    }
    deps = { client, llm };
  } catch (err) {
    process.stderr.write(`[v2-backfill] HATA: ${err.message}\n`);
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
