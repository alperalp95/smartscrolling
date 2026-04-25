#!/usr/bin/env node
import 'dotenv/config';
import { supabase } from '../lib/supabase.js';

const DEFAULT_LIMIT = 20;
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[MediaBackfill] baslatildi. mode=${APPLY ? 'apply' : 'dry-run'}`);
  validateEnv();

  const candidates = await fetchCandidates(DEFAULT_LIMIT);
  console.log(`[MediaBackfill] aday sayisi=${candidates.length}`);

  if (candidates.length === 0) {
    const breakdown = await fetchNullMediaBreakdown();
    console.log('[MediaBackfill] Wikipedia adayi bulunamadi. Null media dagilimi:');

    for (const row of breakdown) {
      console.log(`  - ${row.source_label ?? 'Bilinmeyen Kaynak'}: ${row.count}`);
    }

    return;
  }

  let foundImage = 0;
  let updated = 0;
  let skipped = 0;

  for (const fact of candidates) {
    const imageUrl = await resolveWikipediaImage(fact.source_url);

    if (!imageUrl) {
      skipped += 1;
      console.log(`[MediaBackfill] no-image id=${fact.id} title="${fact.title}"`);
      continue;
    }

    foundImage += 1;
    console.log(`[MediaBackfill] found-image id=${fact.id} title="${fact.title}" url=${imageUrl}`);

    if (!APPLY) {
      continue;
    }

    const { error } = await supabase
      .from('facts')
      .update({ media_url: imageUrl })
      .eq('id', fact.id);

    if (error) {
      console.error(`[MediaBackfill] update-error id=${fact.id}`, error.message);
      continue;
    }

    updated += 1;
  }

  console.log('--- Media backfill ozeti ---');
  console.log(`candidates: ${candidates.length}`);
  console.log(`found_image: ${foundImage}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped: ${skipped}`);
}

async function fetchCandidates(limit) {
  const { data, error } = await supabase
    .from('facts')
    .select('id,title,source_url,source_label')
    .is('media_url', null)
    .ilike('source_url', '%wikipedia.org/wiki/%')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[MediaBackfill] candidate query failed: ${error.message}`);
  }

  return data ?? [];
}

async function fetchNullMediaBreakdown() {
  const { data, error } = await supabase.from('facts').select('source_label').is('media_url', null);

  if (error) {
    throw new Error(`[MediaBackfill] null media breakdown failed: ${error.message}`);
  }

  const counts = new Map();

  for (const row of data ?? []) {
    const key = row.source_label ?? 'Bilinmeyen Kaynak';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([source_label, count]) => ({ source_label, count }))
    .sort((left, right) => right.count - left.count);
}

async function resolveWikipediaImage(sourceUrl) {
  const title = extractWikipediaTitle(sourceUrl);

  if (!title) {
    return null;
  }

  try {
    const lang = extractWikipediaLanguage(sourceUrl) ?? 'en';
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const thumbnail = data.thumbnail?.source ?? null;
    const original = data.originalimage?.source ?? null;

    if (thumbnail) {
      return thumbnail;
    }

    if (original && isSafeImageFormat(original)) {
      return original;
    }

    return null;
  } catch (error) {
    console.error('[MediaBackfill] wikipedia fetch error:', error.message);
    return null;
  }
}

function isSafeImageFormat(url) {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
}

function extractWikipediaTitle(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/wiki\/(.+)$/);

    if (!match) {
      return null;
    }

    return decodeURIComponent(match[1].replaceAll('_', ' '));
  } catch {
    return null;
  }
}

function extractWikipediaLanguage(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.split('.')[0] ?? null;
  } catch {
    return null;
  }
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
  console.error('[MediaBackfill] kritik hata:', error.message);
  process.exit(1);
});
