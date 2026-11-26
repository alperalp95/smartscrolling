import { create } from 'zustand';
import { deriveFactVisualKey } from '../lib/factVisuals';
import { type FeedIndexItem, buildFeedOrder } from '../lib/feedOrder';
import { loadSeenFactIds, resetSeenFactIds } from '../lib/seenFacts';
import { supabase } from '../lib/supabase';
import type { FactRow, FactType } from '../types';

interface FeedState {
  facts: FactType[];
  likedIds: string[];
  savedIds: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Ekranda kart varken yapılan yenileme; kartlar yerinde kalır. */
  isRefreshing: boolean;
  /** Her başarılı reset bitişinde artar; liste buna bakıp başa döner. */
  feedVersion: number;
  hasMore: boolean;
  feedRotationSeed: number;
  orderIds: string[];
  orderCursor: number;
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
const FEED_INDEX_SELECT = 'id,category,published_at,created_at';
const FEED_INDEX_LIMIT = 5000;
const FEED_FACT_SELECT =
  'id,title,content,category,tags,read_time_sq,source_url,source_label,verified,media_url,visual_key,published_at,created_at';
let feedRequestCounter = 0;
let feedResetEpoch = 0;
let feedIndex: FeedIndexItem[] = [];

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

/** Görülenleri okuyup sırayı kurar; görülmemiş kart kalmadıysa görülenleri sıfırlar. */
async function computeFeedOrder(
  index: FeedIndexItem[],
  seed: number,
  excludeIds: ReadonlySet<string>,
): Promise<string[]> {
  let seenIds = new Set(await loadSeenFactIds());
  if (index.length > 0 && !index.some((item) => !seenIds.has(item.id))) {
    await resetSeenFactIds();
    seenIds = new Set();
  }

  const order = buildFeedOrder(index, { seenIds, seed, now: new Date() });
  if (excludeIds.size === 0) {
    return order;
  }

  // Ekrandaki kartlar yeni sıranın başında tekrar etmesin; hepsi ekrandaysa tam sıra kullanılır.
  const filtered = order.filter((id) => !excludeIds.has(id));
  return filtered.length > 0 ? filtered : order;
}

async function fetchFactsByIds(ids: string[]): Promise<FactType[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('facts')
    .select(FEED_FACT_SELECT)
    .eq('status', 'published')
    .in('id', ids);

  if (error) {
    throw new Error(error.message);
  }

  const byId = new Map(
    (data ?? []).map((record) => [(record as { id: string }).id, record as Partial<FactRow>]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((record): record is Partial<FactRow> => Boolean(record))
    .map((record) => normalizeFact(record));
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  facts: [],
  likedIds: [],
  savedIds: [],
  isLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  feedVersion: 0,
  hasMore: true,
  feedRotationSeed: Math.floor(Math.random() * 1_000_000),
  orderIds: [],
  orderCursor: 0,

  fetchFacts: async (options) => {
    const reset = options?.reset ?? false;
    const requestId = ++feedRequestCounter;
    const startedAt = Date.now();

    if (!reset && get().orderIds.length === 0) {
      await get().fetchFacts({ reset: true });
      return;
    }

    const epoch = reset ? ++feedResetEpoch : feedResetEpoch;
    const offset = reset ? 0 : get().facts.length;
    const pageSize = reset ? INITIAL_PAGE_SIZE : PAGE_SIZE;

    if (reset) {
      // Kart varsa eski kartlar ekranda kalsın: boş ekran yerine sadece isRefreshing açılır.
      if (get().facts.length > 0) {
        set({ isRefreshing: true, hasMore: true });
      } else {
        set({ isLoading: true, hasMore: true });
      }
    } else {
      set({ isLoadingMore: true });
    }

    try {
      let orderIds = get().orderIds;
      let cursor = get().orderCursor;

      if (reset) {
        const { data: indexRows, error: indexError } = await supabase
          .from('facts')
          .select(FEED_INDEX_SELECT)
          .eq('status', 'published')
          .limit(FEED_INDEX_LIMIT);

        if (indexError) {
          console.error('[Dev] fetchFacts failed:', indexError.message);
          console.log(
            `[Perf][Feed] request=${requestId} reset=${reset} offset=${offset} failed_after_ms=${Date.now() - startedAt}`,
          );
          set({ isLoading: false, isRefreshing: false, isLoadingMore: false });
          return;
        }

        feedIndex = (indexRows ?? []) as FeedIndexItem[];
        orderIds = await computeFeedOrder(feedIndex, get().feedRotationSeed, new Set());
        cursor = 0;
      } else if (cursor >= orderIds.length) {
        const onScreen = new Set(get().facts.map((fact) => fact.id));
        orderIds = await computeFeedOrder(
          feedIndex,
          Math.floor(Math.random() * 1_000_000),
          onScreen,
        );
        cursor = 0;
      }

      const pageIds = orderIds.slice(cursor, cursor + pageSize);
      const nextPage = await fetchFactsByIds(pageIds);
      const elapsedMs = Date.now() - startedAt;

      if (epoch !== feedResetEpoch) {
        // Bu arada yeni bir yenileme başladı; eski sonucu at.
        set({ isLoadingMore: false });
        return;
      }

      const facts = reset ? nextPage : [...get().facts, ...nextPage];

      set({
        facts,
        orderIds,
        orderCursor: cursor + pageIds.length,
        hasMore: orderIds.length > 0,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        ...(reset ? { feedVersion: get().feedVersion + 1 } : {}),
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
      set({ isLoading: false, isRefreshing: false, isLoadingMore: false });
    }
  },

  loadMoreFacts: async () => {
    const { hasMore, isLoading, isLoadingMore, isRefreshing } = get();

    if (!hasMore || isLoading || isLoadingMore || isRefreshing) {
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
