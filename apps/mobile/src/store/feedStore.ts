import { create } from 'zustand';
import { deriveFactVisualKey } from '../lib/factVisuals';
import { supabase } from '../lib/supabase';
import type { FactRow, FactType } from '../types';

interface FeedState {
  facts: FactType[];
  likedIds: string[];
  savedIds: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  feedRotationSeed: number;
  fetchFacts: (options?: { reset?: boolean }) => Promise<void>;
  loadMoreFacts: () => Promise<void>;
  refreshFacts: () => Promise<void>;
  bumpFeedRotation: () => void;
  syncSavedFacts: () => Promise<void>;
  clearSavedFacts: () => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
}

const INITIAL_PAGE_SIZE = 6;
const PAGE_SIZE = 12;
const FEED_FACT_SELECT =
  'id,title,content,category,tags,read_time_sq,source_url,source_label,verified,media_url,visual_key,published_at,created_at';
let feedRequestCounter = 0;

async function getCurrentUserId() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('[Dev] getSession failed:', error.message);
    return null;
  }

  return session?.user?.id ?? null;
}

function normalizeFact(record: Partial<FactRow>): FactType {
  const visualKey =
    typeof (record as { visual_key?: unknown }).visual_key === 'string'
      ? ((record as { visual_key?: string }).visual_key ?? null)
      : deriveVisualKey(record);

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
    visual_key: visualKey,
    likes: 0,
    gradientStart: '#000000',
    gradientEnd: '#111111',
  };
}

function deriveVisualKey(record: Partial<FactRow>): string {
  return deriveFactVisualKey({
    sourceLabel: record.source_label ?? null,
    category: record.category ?? null,
    title: record.title ?? null,
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    content: record.content ?? null,
  });
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  facts: [],
  likedIds: [],
  savedIds: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  feedRotationSeed: Math.floor(Math.random() * 1_000_000),

  fetchFacts: async (options) => {
    const reset = options?.reset ?? false;
    const currentFacts = get().facts;
    const offset = reset ? 0 : currentFacts.length;
    const pageSize = reset && offset === 0 ? INITIAL_PAGE_SIZE : PAGE_SIZE;
    const requestId = ++feedRequestCounter;
    const startedAt = Date.now();

    if (reset) {
      set({ isLoading: true, hasMore: true });
    } else if (offset === 0) {
      set({ isLoading: true });
    } else {
      set({ isLoadingMore: true });
    }

    try {
      const { data, error } = await supabase
        .from('facts')
        .select(FEED_FACT_SELECT)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const elapsedMs = Date.now() - startedAt;

      if (error) {
        console.error('[Dev] fetchFacts failed:', error.message);
        console.log(
          `[Perf][Feed] request=${requestId} reset=${reset} offset=${offset} failed_after_ms=${elapsedMs}`,
        );
        set({ isLoading: false, isLoadingMore: false });
        return;
      }

      const nextPage = (data ?? []).map((record) => normalizeFact(record as Partial<FactRow>));

      const facts = reset ? nextPage : [...currentFacts, ...nextPage];

      set({
        facts,
        hasMore: nextPage.length === pageSize,
        isLoading: false,
        isLoadingMore: false,
      });
      console.log(
        `[Perf][Feed] request=${requestId} reset=${reset} offset=${offset} rows=${nextPage.length} total=${facts.length} page_size=${pageSize} elapsed_ms=${elapsedMs}`,
      );

      if (reset && nextPage.length === INITIAL_PAGE_SIZE) {
        setTimeout(() => {
          void get().loadMoreFacts();
        }, 0);
      }
    } catch (e) {
      console.error('[Dev] fetchFacts exception:', e);
      console.log(
        `[Perf][Feed] request=${requestId} reset=${reset} offset=${offset} exception_after_ms=${Date.now() - startedAt}`,
      );
      set({ isLoading: false, isLoadingMore: false });
    }
  },

  loadMoreFacts: async () => {
    const { hasMore, isLoading, isLoadingMore } = get();

    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    await get().fetchFacts();
  },

  refreshFacts: async () => {
    await get().fetchFacts({ reset: true });
  },

  bumpFeedRotation: () => {
    set({ feedRotationSeed: Math.floor(Math.random() * 1_000_000) });
  },

  syncSavedFacts: async () => {
    const userId = await getCurrentUserId();

    if (!userId) {
      set({ savedIds: [] });
      return;
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .select('fact_id')
      .eq('user_id', userId)
      .not('fact_id', 'is', null);

    if (error) {
      console.error('[Dev] syncSavedFacts failed:', error.message);
      return;
    }

    const savedIds = (data ?? [])
      .map((bookmark) => bookmark.fact_id)
      .filter((factId): factId is string => typeof factId === 'string');

    set({ savedIds: [...new Set(savedIds)] });
  },

  clearSavedFacts: () => set({ savedIds: [] }),

  toggleLike: (id: string) => {
    const { likedIds } = get();
    set({ likedIds: likedIds.includes(id) ? likedIds.filter((x) => x !== id) : [...likedIds, id] });
  },

  toggleSave: async (id: string) => {
    const { savedIds } = get();
    const isSaved = savedIds.includes(id);
    const nextSavedIds = isSaved ? savedIds.filter((x) => x !== id) : [...savedIds, id];

    set({ savedIds: nextSavedIds });

    const userId = await getCurrentUserId();

    if (!userId) {
      console.log('[Dev] No authenticated user, keeping local bookmark state only.');
      return;
    }

    if (isSaved) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('fact_id', id);

      if (error) {
        console.error('[Dev] bookmark delete failed:', error.message);
        set({ savedIds });
        return;
      }
      return;
    }

    const { error } = await supabase.from('bookmarks').insert({
      user_id: userId,
      fact_id: id,
    });

    if (error) {
      console.error('[Dev] bookmark insert failed:', error.message);
      set({ savedIds });
      return;
    }
  },
}));
