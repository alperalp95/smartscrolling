#!/usr/bin/env node
import 'dotenv/config';
import { supabase } from '../lib/supabase.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[FactsCleanup] baslatildi. mode=${APPLY ? 'apply' : 'dry-run'}`);
  validateEnv();

  const summary = await fetchSummary();
  console.log(`[FactsCleanup] total_facts=${summary.totalFacts}`);
  console.log(`[FactsCleanup] total_bookmarks=${summary.totalBookmarks}`);

  if (summary.bySource.length > 0) {
    console.log('[FactsCleanup] source dagilimi:');
    for (const row of summary.bySource) {
      console.log(`  - ${row.label}: ${row.count}`);
    }
  }

  if (!APPLY) {
    console.log('[FactsCleanup] dry-run tamamlandi. Silmek icin --apply kullan.');
    return;
  }

  const { error } = await supabase.from('facts').delete().not('id', 'is', null);

  if (error) {
    throw new Error(`[FactsCleanup] delete failed: ${error.message}`);
  }

  console.log('[FactsCleanup] tum facts kayitlari silindi.');
}

async function fetchSummary() {
  const { data: facts, error: factsError } = await supabase.from('facts').select('id,source_label');

  if (factsError) {
    throw new Error(`[FactsCleanup] facts query failed: ${factsError.message}`);
  }

  const { count: bookmarkCount, error: bookmarksError } = await supabase
    .from('bookmarks')
    .select('*', { count: 'exact', head: true });

  if (bookmarksError) {
    throw new Error(`[FactsCleanup] bookmarks count failed: ${bookmarksError.message}`);
  }

  const counts = new Map();

  for (const row of facts ?? []) {
    const key = normalizeSourceLabel(row.source_label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    totalFacts: facts?.length ?? 0,
    totalBookmarks: bookmarkCount ?? 0,
    bySource: [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count),
  };
}

function normalizeSourceLabel(value) {
  const label = (value ?? '').trim();

  if (label.startsWith('NASA APOD')) {
    return 'NASA APOD';
  }

  return label || '(empty)';
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
  console.error('[FactsCleanup] kritik hata:', error.message);
  process.exit(1);
});
