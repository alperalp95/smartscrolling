#!/usr/bin/env node
// İçerik hattı v2 — mevcut kartlar (facts) için kaynak bağlamı (facts.context_text) doldurma.
// "Karta Sor" AI'ı bu metni kaynak olarak kullanır. LLM yok: sadece Wikipedia HTML.
//
// Kullanım:
//   node src/runners/v2-backfill-context.js                 # dry-run (varsayılan): DB'ye yazmaz
//   node src/runners/v2-backfill-context.js --limit 50      # en fazla 50 satır (varsayılan 200)
//   node src/runners/v2-backfill-context.js --apply         # GERÇEKTEN yaz
//
// Seçim: context_text IS NULL ve source_url Wikipedia /wiki/ olan satırlar, id sırasıyla.
// Wikipedia dışı kaynaklar atlanır (skipped_source).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTEXT_MAX_CHARS, contextText } from '../v2/steps/enqueue.js';
import { fetchArticleHtml } from '../v2/steps/support.js';
import {
  MIN_PARAGRAPH_CHARS,
  extractParagraphs,
  parseWikiUrl,
  selectSupport,
} from '../v2/steps/support-parse.js';

export const DEFAULT_LIMIT = 200;

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

/** Kart + makale paragraflarından bağlam metni (saf); bulunamazsa null. */
export function pickContext(row, paragraphs, lang) {
  const hook = `${row.title ?? ''} ${row.content ?? ''}`;
  const picked = selectSupport(paragraphs, hook, { lang, maxChars: CONTEXT_MAX_CHARS });
  let text = picked?.text;
  if (!text) text = paragraphs.find((p) => p.length >= MIN_PARAGRAPH_CHARS);
  return contextText({ support_paragraph: text });
}

/**
 * @param {string[]} argv
 * @param {{ client: any, http: { getJson: (url: string) => Promise<any> }, log?: (line: string) => void }} deps
 */
export async function run(argv = [], deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const result = { processed: 0, written: 0, not_found: 0, skipped_source: 0, errors: 0 };
  try {
    const args = parseArgs(argv);
    const { client, http } = deps;
    if (!http) throw new Error('http gerekli');

    const { data, error } = await client
      .from('facts')
      .select('id,title,content,source_url')
      .is('context_text', null)
      .ilike('source_url', '%wikipedia.org/wiki/%')
      .order('id', { ascending: true })
      .limit(args.limit);
    if (error) throw new Error(`facts okunamadı: ${error.message ?? error}`);
    const rows = data ?? [];

    log(
      `[v2-backfill-context] mod: ${args.apply ? 'apply' : 'dry-run (yazma yok; yazmak için --apply)'}`,
    );
    log(`[v2-backfill-context] işlenecek satır: ${rows.length} (limit ${args.limit})`);

    let shown = 0;
    for (const row of rows) {
      result.processed += 1;
      const ref = parseWikiUrl(row.source_url);
      if (!ref) {
        result.skipped_source += 1;
        continue;
      }
      try {
        const article = await fetchArticleHtml(http, ref);
        const text = article.ok
          ? pickContext(row, extractParagraphs(article.html), ref.lang)
          : null;
        if (!text) {
          result.not_found += 1;
          continue;
        }
        if (!args.apply) {
          if (shown < 3) {
            shown += 1;
            log(`[v2-backfill-context] örnek ${row.id}: ${JSON.stringify(text.slice(0, 120))}`);
          }
          continue;
        }
        const { error: upErr } = await client
          .from('facts')
          .update({ context_text: text })
          .eq('id', row.id)
          .is('context_text', null);
        if (upErr) throw new Error(upErr.message ?? String(upErr));
        result.written += 1;
      } catch (err) {
        result.errors += 1;
        log(`[v2-backfill-context] hata ${row.id}: ${err?.message ?? err}`);
      }
    }

    log(
      `işlenen=${result.processed}, yazılan=${result.written}, bulunamadı=${result.not_found}, skipped_source=${result.skipped_source}, hata=${result.errors}`,
    );
    return { exitCode: result.errors > 0 ? 1 : 0, result };
  } catch (err) {
    log(`[v2-backfill-context] HATA: ${err?.message ?? err}`);
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
    const { createHttpClient } = await import('../v2/sources/http.js');
    deps = { client, http: createHttpClient() };
  } catch (err) {
    process.stderr.write(`[v2-backfill-context] HATA: ${err.message}\n`);
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
