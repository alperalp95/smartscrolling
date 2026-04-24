import type { FactRow, FactType } from '../types';
import { supabase } from './supabase';

const SAVED_FACT_SELECT =
  'id,title,content,category,tags,read_time_sq,source_url,source_label,verified,media_url,published_at,created_at';

type BookmarkFactIdRow = {
  fact_id: string | null;
};

type FactsListResult = {
  data: FactRow[] | null;
  error: { message: string } | null;
};

async function withTimeout<T>(promise: PromiseLike<T>, fallback: T, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

function normalizeFact(record: Partial<FactRow>): FactType {
  return {
    id: record.id ?? '',
    title: record.title ?? 'Baslik eksik',
    content: record.content ?? '',
    category: record.category ?? 'Genel',
    tags: Array.isArray(record.tags) ? record.tags : [],
    read_time_sq: record.read_time_sq ?? 15,
    source_url: record.source_url ?? null,
    source_label: record.source_label ?? 'Kaynak belirtilmedi',
    verified: record.verified ?? false,
    media_url: record.media_url ?? null,
    published_at: record.published_at ?? null,
    created_at: record.created_at ?? undefined,
    likes: 0,
    gradientStart: '#000000',
    gradientEnd: '#111111',
  };
}

export async function fetchSavedFacts(userId?: string | null, limit = 10) {
  if (!userId) {
    return [];
  }

  const bookmarkResult = await withTimeout(
    supabase
      .from('bookmarks')
      .select('fact_id')
      .eq('user_id', userId)
      .not('fact_id', 'is', null)
      .limit(limit * 2) as PromiseLike<{
      data: BookmarkFactIdRow[] | null;
      error: { message: string } | null;
    }>,
    { data: null, error: { message: 'timeout' } },
  );

  if (bookmarkResult.error || !bookmarkResult.data) {
    if (bookmarkResult.error?.message !== 'timeout') {
      console.error('[Facts] fetchSavedFacts bookmarks failed:', bookmarkResult.error?.message);
    }
    return [];
  }

  const factIds = bookmarkResult.data
    .map((bookmark) => bookmark.fact_id)
    .filter((factId): factId is string => typeof factId === 'string')
    .slice(0, limit);

  if (factIds.length === 0) {
    return [];
  }

  const factsResult = await withTimeout(
    supabase
      .from('facts')
      .select(SAVED_FACT_SELECT)
      .in('id', factIds) as PromiseLike<FactsListResult>,
    { data: null, error: { message: 'timeout' } } as FactsListResult,
  );

  if (factsResult.error || !factsResult.data) {
    if (factsResult.error?.message !== 'timeout') {
      console.error('[Facts] fetchSavedFacts facts failed:', factsResult.error?.message);
    }
    return [];
  }

  const factsById = new Map(
    factsResult.data.map((record) => [record.id, normalizeFact(record as Partial<FactRow>)]),
  );

  return factIds
    .map((factId) => factsById.get(factId))
    .filter((fact): fact is FactType => Boolean(fact));
}

export async function fetchFactById(factId?: string | null) {
  if (!factId) {
    return null;
  }

  const result = await withTimeout(
    supabase.from('facts').select(SAVED_FACT_SELECT).eq('id', factId).maybeSingle() as PromiseLike<{
      data: FactRow | null;
      error: { message: string } | null;
    }>,
    { data: null, error: { message: 'timeout' } },
  );

  if (result.error || !result.data) {
    if (result.error?.message !== 'timeout') {
      console.error('[Facts] fetchFactById failed:', result.error?.message);
    }
    return null;
  }

  return normalizeFact(result.data as Partial<FactRow>);
}
