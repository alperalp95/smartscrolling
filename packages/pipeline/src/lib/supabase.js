// src/lib/supabase.js
// Supabase service role baglantisi - sadece pipeline scriptinde kullanilir.
// UYARI: service_role key'ini asla frontend'e koyma.
import { createClient } from '@supabase/supabase-js';
import { evaluateFactConsistency } from './consistency-policy.js';
import { findRecentTopicDuplicate, findTitleDuplicate } from './duplicate-policy.js';
import { evaluateFactQuality } from './quality-policy.js';
import { applySourcePolicy } from './source-policy.js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

/**
 * Verilen source URL listesinden veritabaninda zaten bulunanlari dondurur.
 * @param {string[]} sourceUrls
 * @returns {Promise<Set<string>>}
 */
export async function getExistingSourceUrls(sourceUrls) {
  const uniqueUrls = [...new Set((sourceUrls ?? []).filter(Boolean))];

  if (uniqueUrls.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('facts')
    .select('source_url')
    .in('source_url', uniqueUrls);

  if (error) {
    console.error('[Supabase] source_url preflight error:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.source_url).filter(Boolean));
}

function wikipediaTitleFromSourceUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const marker = '/wiki/';
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
      .replaceAll('_', ' ')
      .trim();
  } catch {
    return null;
  }
}

/**
 * Wikipedia seed fetch'lerinde DB'de zaten bulunan basliklari bastan elemek icin kullanilir.
 * @returns {Promise<Set<string>>}
 */
export async function getExistingWikipediaSourceTitles() {
  const { data, error } = await supabase
    .from('facts')
    .select('source_url')
    .eq('source_label', 'Wikipedia')
    .limit(1000);

  if (error) {
    console.error('[Supabase] Wikipedia source title preflight error:', error.message);
    return new Set();
  }

  return new Set(
    (data ?? []).map((row) => wikipediaTitleFromSourceUrl(row.source_url)).filter(Boolean),
  );
}

export async function findRecentTopicPreflight({ title, category, freshnessDays = 60 } = {}) {
  return findRecentTopicDuplicate(supabase, { title, category, freshnessDays });
}

/**
 * Bir fact nesnesini Supabase'e ekler.
 * Duplicate onlemek icin insert oncesi source_url ve title guard'lari calisir.
 * @param {object} fact - convertToFact() ciktisi
 * @returns {Promise<{ ok: boolean, status: string, verified: boolean, title: string }>}
 */
export async function insertFact(fact) {
  const factWithPolicy = applySourcePolicy(fact);
  const qualityResult = evaluateFactQuality(factWithPolicy);

  if (!qualityResult.ok) {
    console.log(
      `[Supabase] rejected by quality gate: "${factWithPolicy.title}" reason=${qualityResult.reason}`,
    );
    return {
      ok: false,
      status: `quality_rejected:${qualityResult.reason}`,
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  const consistencyResult = evaluateFactConsistency(factWithPolicy);

  if (!consistencyResult.ok) {
    console.log(
      `[Supabase] rejected by consistency gate: "${factWithPolicy.title}" reason=${consistencyResult.reason}`,
    );
    return {
      ok: false,
      status: `consistency_rejected:${consistencyResult.reason}`,
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  const { data: existing } = await supabase
    .from('facts')
    .select('id')
    .eq('source_url', factWithPolicy.source_url)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[Supabase] skipped source_url duplicate: "${factWithPolicy.title}"`);
    return {
      ok: false,
      status: 'duplicate_source_url',
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  const titleDuplicate = await findTitleDuplicate(supabase, factWithPolicy);

  if (titleDuplicate) {
    console.log(
      `[Supabase] skipped title duplicate: "${factWithPolicy.title}" -> existing="${titleDuplicate.title}"`,
    );
    return {
      ok: false,
      status: 'duplicate_title',
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  const recentTopicDuplicate = await findRecentTopicDuplicate(supabase, {
    title: factWithPolicy.title || factWithPolicy._source_title,
    category: factWithPolicy.category,
  });

  if (recentTopicDuplicate) {
    console.log(
      `[Supabase] skipped recent topic duplicate: "${factWithPolicy.title}" -> recent="${recentTopicDuplicate.title}"`,
    );
    return {
      ok: false,
      status: 'duplicate_recent_topic',
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  const {
    _category_hint,
    _source_title,
    _source_kind,
    _source_excerpt,
    _media_policy_reason,
    ...insertPayload
  } = factWithPolicy;
  const { error } = await supabase.from('facts').insert(insertPayload);

  if (error) {
    console.error(`[Supabase] insert error: "${factWithPolicy.title}"`, error.message);
    return {
      ok: false,
      status: 'insert_error',
      verified: factWithPolicy.verified,
      title: factWithPolicy.title,
    };
  }

  console.log(
    `[Supabase] saved: "${factWithPolicy.title}" [${factWithPolicy.category}] verified=${factWithPolicy.verified} media_policy=${factWithPolicy._media_policy_reason ?? 'unknown'} media_saved=${factWithPolicy.media_url ? 'yes' : 'no'}`,
  );
  return {
    ok: true,
    status: 'saved',
    verified: factWithPolicy.verified,
    title: factWithPolicy.title,
  };
}

export async function ensureStorageBucket(bucketName) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`[Supabase] listBuckets failed: ${listError.message}`);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName);

  if (exists) {
    return { ok: true, created: false };
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: '50MB',
  });

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw new Error(`[Supabase] createBucket failed (${bucketName}): ${createError.message}`);
  }

  return { ok: true, created: true };
}
