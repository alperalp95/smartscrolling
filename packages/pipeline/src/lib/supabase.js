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

export async function fetchBooksForSectionIngest({ bookId } = {}) {
  let query = supabase
    .from('books')
    .select(
      'id,title,author,epub_url,source_format,source_storage_bucket,source_storage_path,total_sections,access_tier',
    );

  if (bookId) {
    query = query.eq('id', bookId);
  } else {
    query = query
      .not('source_storage_bucket', 'is', null)
      .not('source_storage_path', 'is', null)
      .order('created_at', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[Supabase] fetchBooksForSectionIngest failed: ${error.message}`);
  }

  return data ?? [];
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

export async function downloadBookSourceText(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new Error(`[Supabase] storage download failed (${bucket}/${path}): ${error.message}`);
  }

  if (!data) {
    throw new Error(`[Supabase] storage download returned empty payload (${bucket}/${path})`);
  }

  return await data.text();
}

export async function uploadBookSourceText(bucket, path, text) {
  const payload = new Blob([text], { type: 'text/plain; charset=utf-8' });
  const { error } = await supabase.storage.from(bucket).upload(path, payload, {
    upsert: true,
    contentType: 'text/plain; charset=utf-8',
  });

  if (error) {
    throw new Error(`[Supabase] storage upload failed (${bucket}/${path}): ${error.message}`);
  }

  return { ok: true };
}

export async function updateBookSourceMetadata(bookId, metadata) {
  const { error } = await supabase.from('books').update(metadata).eq('id', bookId);

  if (error) {
    throw new Error(`[Supabase] update book source metadata failed: ${error.message}`);
  }

  return { ok: true };
}

export async function deleteBookSourceObject(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`[Supabase] storage delete failed (${bucket}/${path}): ${error.message}`);
  }

  return { ok: true };
}

export async function clearBookSections(bookId) {
  const { error: deleteError } = await supabase
    .from('book_sections')
    .delete()
    .eq('book_id', bookId);

  if (deleteError) {
    throw new Error(`[Supabase] clear book_sections failed: ${deleteError.message}`);
  }

  const { error: updateError } = await supabase
    .from('books')
    .update({
      total_sections: 0,
      source_format: null,
      source_storage_bucket: null,
      source_storage_path: null,
    })
    .eq('id', bookId);

  if (updateError) {
    throw new Error(`[Supabase] reset book metadata failed: ${updateError.message}`);
  }

  return { ok: true };
}

export async function replaceBookSections(bookId, sections) {
  const { error: deleteError } = await supabase
    .from('book_sections')
    .delete()
    .eq('book_id', bookId);

  if (deleteError) {
    throw new Error(`[Supabase] delete book_sections failed: ${deleteError.message}`);
  }

  if (sections.length > 0) {
    const { error: insertError } = await supabase.from('book_sections').insert(
      sections.map((section) => ({
        book_id: bookId,
        section_order: section.sectionOrder,
        title: section.title,
        summary: section.summary,
        plain_text: section.plainText,
        word_count: section.wordCount,
        estimated_pages: section.estimatedPages,
      })),
    );

    if (insertError) {
      throw new Error(`[Supabase] insert book_sections failed: ${insertError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from('books')
    .update({ total_sections: sections.length })
    .eq('id', bookId);

  if (updateError) {
    throw new Error(`[Supabase] update books.total_sections failed: ${updateError.message}`);
  }

  return {
    ok: true,
    totalSections: sections.length,
  };
}
