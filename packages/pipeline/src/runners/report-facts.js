#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const HEALTHY_FLOOR = 150;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeSourceLabel(value) {
  const label = (value ?? '').trim();

  if (label.startsWith('NASA APOD')) {
    return 'NASA APOD';
  }

  return label || '(empty)';
}

function formatFloorStatus(count) {
  if (count >= HEALTHY_FLOOR) {
    return 'healthy_floor_ok';
  }

  return `needs_${HEALTHY_FLOOR - count}_more`;
}

async function main() {
  const { data, error } = await supabase.from('facts').select('category, source_label');

  if (error) {
    console.error('[Report] facts fetch failed:', error.message);
    process.exit(1);
  }

  const byCategory = new Map();
  const bySource = new Map();

  for (const row of data ?? []) {
    byCategory.set(row.category ?? '(empty)', (byCategory.get(row.category ?? '(empty)') ?? 0) + 1);

    const normalizedSource = normalizeSourceLabel(row.source_label);
    bySource.set(normalizedSource, (bySource.get(normalizedSource) ?? 0) + 1);
  }

  const orderedCategories = [...byCategory.entries()].sort((left, right) => right[1] - left[1]);
  const orderedSources = [...bySource.entries()].sort((left, right) => right[1] - left[1]);

  console.log('=== FACT REPORT ===');
  console.log(`total_facts: ${data?.length ?? 0}`);
  console.log(`healthy_floor_target_per_category: ${HEALTHY_FLOOR}`);
  console.log('\nBY_CATEGORY');

  for (const [label, count] of orderedCategories) {
    console.log(`${label}: ${count} (${formatFloorStatus(count)})`);
  }

  console.log('\nBY_SOURCE');

  for (const [label, count] of orderedSources) {
    console.log(`${label}: ${count}`);
  }
}

main().catch((error) => {
  console.error('[Report] critical failure:', error);
  process.exit(1);
});
