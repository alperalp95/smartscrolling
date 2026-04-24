#!/usr/bin/env node
import 'dotenv/config';
import { deriveFactVisualKey } from '../lib/fact-visual-key.js';
import { supabase } from '../lib/supabase.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[VisualKeyBackfill] baslatildi. mode=${APPLY ? 'apply' : 'dry-run'}`);
  validateEnv();

  const rows = await fetchFacts();
  console.log(`[VisualKeyBackfill] incelenen kayit=${rows.length}`);

  const candidates = rows
    .map((row) => {
      const nextVisualKey = deriveFactVisualKey({
        sourceLabel: row.source_label,
        category: row.category,
        title: row.title,
        tags: row.tags,
        content: row.content,
      });

      if (nextVisualKey === row.visual_key) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        prevVisualKey: row.visual_key ?? 'null',
        nextVisualKey,
      };
    })
    .filter(Boolean);

  console.log(`[VisualKeyBackfill] degisecek kayit=${candidates.length}`);

  const counts = new Map();
  for (const candidate of candidates) {
    counts.set(candidate.nextVisualKey, (counts.get(candidate.nextVisualKey) ?? 0) + 1);
  }

  console.log('[VisualKeyBackfill] yeni visual_key dagilimi:');
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${key}: ${count}`);
  }

  for (const candidate of candidates.slice(0, 12)) {
    console.log(
      `[VisualKeyBackfill] sample id=${candidate.id} from=${candidate.prevVisualKey} to=${candidate.nextVisualKey} title="${candidate.title}"`,
    );
  }

  if (!APPLY) {
    return;
  }

  let updated = 0;
  for (const candidate of candidates) {
    const { error } = await supabase
      .from('facts')
      .update({ visual_key: candidate.nextVisualKey })
      .eq('id', candidate.id);

    if (error) {
      console.error(`[VisualKeyBackfill] update-error id=${candidate.id}`, error.message);
      continue;
    }

    updated += 1;
  }

  console.log('--- Visual key backfill ozeti ---');
  console.log(`candidates: ${candidates.length}`);
  console.log(`updated: ${updated}`);
}

async function fetchFacts() {
  const { data, error } = await supabase
    .from('facts')
    .select('id,title,content,category,tags,source_label,visual_key');

  if (error) {
    throw new Error(`[VisualKeyBackfill] fact query failed: ${error.message}`);
  }

  return data ?? [];
}

function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].startsWith('your_'),
  );

  if (missing.length > 0) {
    console.error('Eksik ortam degiskenleri:', missing.join(', '));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[VisualKeyBackfill] kritik hata:', error.message);
  process.exit(1);
});
