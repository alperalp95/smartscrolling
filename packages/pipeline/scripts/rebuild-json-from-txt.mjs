/**
 * Rebuilds part JSON files using clean text from the fixed TXT file.
 * Matches entries by title. Rebuilds parts 03-08.
 *
 * Usage: node scripts/rebuild-json-from-txt.mjs [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TXT_PATH = 'data/pdf-curated/luzumsuz-bilgiler-batch-02.txt';
const DATA_DIR = 'data/pdf-curated';
const PARTS_TO_REBUILD = ['03', '04', '05', '06', '07', '08'];
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// 1. Parse TXT into entries
// ---------------------------------------------------------------------------
function parseTxt(content) {
  const lines = content.split('\n');
  const entries = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Entry header: "1.01 Title", "2.03 Title", etc.
    const headerMatch = line.match(/^(\d+\.\d+)\s+(.+)$/);
    if (headerMatch) {
      if (current) entries.push(current);
      current = {
        txtId: headerMatch[1],
        title: headerMatch[2].trim(),
        lines: [],
      };
      continue;
    }

    if (!current) continue;

    // Skip standalone page numbers
    if (/^\s*\d{1,3}\s*$/.test(line)) continue;

    current.lines.push(line);
  }

  if (current) entries.push(current);

  // Build clean extract from lines
  return entries.map((e) => ({
    ...e,
    extract: e.lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  }));
}

// ---------------------------------------------------------------------------
// 2. Build title → extract lookup (normalize whitespace for matching)
// ---------------------------------------------------------------------------
function normalizeTitle(t) {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------
const txtRaw = await readFile(TXT_PATH, 'utf8');
const txtEntries = parseTxt(txtRaw);
const txtMap = new Map(txtEntries.map((e) => [normalizeTitle(e.title), e]));

console.log(`TXT parsed: ${txtEntries.length} entries found.\n`);

let totalMatched = 0;
let totalMissed = 0;

for (const part of PARTS_TO_REBUILD) {
  const jsonPath = path.join(DATA_DIR, `luzumsuz-bilgiler-batch-02-part-${part}.json`);
  const raw = await readFile(jsonPath, 'utf8');
  const items = JSON.parse(raw);

  const updated = items.map((item) => {
    const key = normalizeTitle(item.title);
    const txtEntry = txtMap.get(key);

    if (!txtEntry) {
      console.warn(`  [MISS] part-${part}: "${item.title}"`);
      totalMissed += 1;
      return item; // keep original
    }

    totalMatched += 1;
    return { ...item, extract: txtEntry.extract };
  });

  const matched = updated.filter((u, i) => u.extract !== items[i].extract).length;
  console.log(`part-${part}: ${items.length} items → ${matched} extracts updated`);

  if (!DRY_RUN) {
    await writeFile(jsonPath, JSON.stringify(updated, null, 2), 'utf8');
    console.log(`  → Written: ${jsonPath}`);
  }
}

console.log(`\nDone. Matched: ${totalMatched}  Missed: ${totalMissed}`);
if (DRY_RUN) console.log('(DRY RUN — no files written)');
