// src/v2/publish/publish-repo.js
// Yayın adımının veritabanı erişimi. Supabase client dışarıdan verilir (testte sahte client).

export const FACTS_TABLE = 'facts';
const QUEUED = 'queued';
const PUBLISHED = 'published';

function toIso(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime()))
    throw new TypeError(`now geçerli bir tarih olmalı (şu an: ${JSON.stringify(now)})`);
  return date.toISOString();
}

function fail(op, error) {
  const err = new Error(`[publish-repo] ${op} başarısız: ${error?.message ?? String(error)}`);
  err.cause = error;
  return err;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export function createPublishRepo(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('createPublishRepo: from() metodu olan bir Supabase client gerekli');
  }

  return {
    /** Yayın sırasına en yakın 'queued' kartlar (wow azalan, eski önce). */
    async listQueued(limit) {
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new RangeError(
          `listQueued: limit pozitif tam sayı olmalı (şu an: ${JSON.stringify(limit)})`,
        );
      }
      const { data, error } = await client
        .from(FACTS_TABLE)
        .select('id, category, wow_score, created_at')
        .eq('status', QUEUED)
        .order('wow_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw fail('listQueued', error);
      return data ?? [];
    },

    /**
     * Tek update: status='published', published_at=now; sadece hâlâ 'queued' olan satırlar.
     * @returns {Promise<{ publishedIds: (string|number)[] }>}
     */
    async markPublished(ids, now) {
      if (!Array.isArray(ids)) throw new TypeError('markPublished: ids bir dizi olmalı');
      const publishedAt = toIso(now);
      if (ids.length === 0) return { publishedIds: [] };
      const { data, error } = await client
        .from(FACTS_TABLE)
        .update({ status: PUBLISHED, published_at: publishedAt })
        .in('id', ids)
        .eq('status', QUEUED)
        .select('id');
      if (error) throw fail('markPublished', error);
      return { publishedIds: (data ?? []).map((row) => row.id) };
    },

    /** Stoktaki ('queued') kart sayısı. */
    async countQueued() {
      const { count, error } = await client
        .from(FACTS_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', QUEUED);
      if (error) throw fail('countQueued', error);
      return count ?? 0;
    },
  };
}
