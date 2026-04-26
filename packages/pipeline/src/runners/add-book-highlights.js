#!/usr/bin/env node
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function parseArgs(argv) {
  const args = { bookId: null, file: null, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--apply') { args.apply = true; continue; }
    if (token === '--book-id' && next) { args.bookId = next; i += 1; continue; }
    if (token === '--file'    && next) { args.file   = next; i += 1; continue; }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.bookId) { console.error('--book-id gerekli'); process.exit(1); }
  if (!args.file)   { console.error('--file gerekli');    process.exit(1); }

  const filePath = path.resolve(process.cwd(), args.file);
  const highlights = JSON.parse(await readFile(filePath, 'utf8'));

  console.log(`${highlights.length} highlight bulundu.`);
  highlights.forEach((h) => console.log(`  [${h.type}] ${h.word}`));

  if (!args.apply) {
    console.log('\nDry-run. Kaydetmek icin --apply ekle.');
    return;
  }

  const rows = highlights.map((h) => ({
    book_id:       args.bookId,
    word:          h.word,
    type:          h.type,
    context:       h.context ?? null,
    ai_definition: h.definition,
  }));

  const { error } = await supabase.from('book_highlights').insert(rows);
  if (error) { console.error('HATA:', error.message); process.exit(1); }

  console.log(`\n[OK] ${rows.length} highlight eklendi.`);
}

main().catch((err) => {
  console.error('[AddHighlights] hata:', err.message);
  process.exit(1);
});
