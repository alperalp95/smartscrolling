#!/usr/bin/env node
import 'dotenv/config';
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import { deriveFactVisualKey } from '../lib/fact-visual-key.js';
import { supabase } from '../lib/supabase.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[MediaCleanup] baslatildi. mode=${APPLY ? 'apply' : 'dry-run'}`);
  validateEnv();

  const rows = await fetchFactsWithMedia();
  const candidates = rows
    .map((row) => {
      const mediaResult = evaluateFactMedia({
        sourceLabel: row.source_label,
        mediaUrl: row.media_url,
      });

      if (mediaResult.ok) {
        return null;
      }

      return {
        ...row,
        reason: mediaResult.reason,
        nextVisualKey: deriveFactVisualKey({
          sourceLabel: row.source_label,
          category: row.category,
          title: row.title,
          tags: row.tags,
          content: row.content,
        }),
      };
    })
    .filter(Boolean);

  console.log(`[MediaCleanup] candidate sayisi=${candidates.length}`);

  if (candidates.length === 0) {
    console.log('[MediaCleanup] Uygun temizlenecek kayit bulunamadi.');
    return;
  }

  const reasonCounts = new Map();
  const visualKeyCounts = new Map();

  for (const candidate of candidates) {
    reasonCounts.set(candidate.reason, (reasonCounts.get(candidate.reason) ?? 0) + 1);
    visualKeyCounts.set(
      candidate.nextVisualKey,
      (visualKeyCounts.get(candidate.nextVisualKey) ?? 0) + 1,
    );
  }

  console.log('[MediaCleanup] neden dagilimi:');
  for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${reason}: ${count}`);
  }

  console.log('[MediaCleanup] visual_key dagilimi:');
  for (const [visualKey, count] of [...visualKeyCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${visualKey}: ${count}`);
  }

  if (!APPLY) {
    for (const candidate of candidates.slice(0, 12)) {
      console.log(
        `[MediaCleanup] sample id=${candidate.id} reason=${candidate.reason} visual_key=${candidate.nextVisualKey} title="${candidate.title}"`,
      );
    }
    return;
  }

  let updated = 0;

  for (const candidate of candidates) {
    const { error } = await supabase
      .from('facts')
      .update({
        media_url: null,
        visual_key: candidate.nextVisualKey,
      })
      .eq('id', candidate.id);

    if (error) {
      console.error(`[MediaCleanup] update-error id=${candidate.id}`, error.message);
      continue;
    }

    updated += 1;
  }

  console.log('--- Media cleanup ozeti ---');
  console.log(`candidates: ${candidates.length}`);
  console.log(`updated: ${updated}`);
}

async function fetchFactsWithMedia() {
  const { data, error } = await supabase
    .from('facts')
    .select('id,title,content,category,tags,source_label,media_url,visual_key')
    .not('media_url', 'is', null);

  if (error) {
    throw new Error(`[MediaCleanup] fact query failed: ${error.message}`);
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
  console.error('[MediaCleanup] kritik hata:', error.message);
  process.exit(1);
});
