import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SeriesCard,
  SeriesDetail,
  SeriesProgress,
  SeriesSection,
  SeriesSummary,
} from '../types';
import { supabase } from './supabase';

export const GUEST_PROGRESS_KEY = 'series.progress.v1';
const UNCATEGORIZED = 'Diğer';

const SUMMARY_COLUMNS =
  'id,slug,title,summary,category,cover_url,card_count,section_count,is_free,is_featured,published_at';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},sections,source_title,source_url,license`;

type SeriesRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  cover_url: string | null;
  card_count: number | null;
  section_count: number | null;
  is_free: boolean | null;
  is_featured: boolean | null;
  published_at: string | null;
  sections?: unknown;
  source_title?: string | null;
  source_url?: string | null;
  license?: string | null;
};

type ProgressRow = {
  series_id: string;
  last_position: number | null;
  completed_at: string | null;
};

type GuestEntry = { lastPosition: number; completedAt: string | null };
type GuestMap = Record<string, GuestEntry>;

function toSummary(row: SeriesRow): SeriesSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    category: row.category ?? null,
    coverUrl: row.cover_url ?? null,
    cardCount: row.card_count ?? 0,
    sectionCount: row.section_count ?? 0,
    isFree: row.is_free ?? false,
    isFeatured: row.is_featured ?? false,
    publishedAt: row.published_at ?? null,
  };
}

function parseSections(raw: unknown): SeriesSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is SeriesSection =>
        !!s &&
        typeof s.title === 'string' &&
        typeof s.firstPosition === 'number' &&
        typeof s.cardCount === 'number',
    )
    .map((s) => ({ title: s.title, firstPosition: s.firstPosition, cardCount: s.cardCount }));
}

export async function fetchSeriesList(): Promise<SeriesSummary[]> {
  const { data, error } = (await supabase
    .from('series')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })) as {
    data: SeriesRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesDetail | null> {
  const { data, error } = (await supabase
    .from('series')
    .select(DETAIL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()) as { data: SeriesRow | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...toSummary(data),
    sections: parseSections(data.sections),
    sourceTitle: data.source_title ?? data.title,
    sourceUrl: data.source_url ?? '',
    license: data.license ?? 'CC BY-SA 4.0',
  };
}

/** RLS neyi veriyorsa onu döner; premium olmayana 4+. kartlar boş gelir. */
export async function fetchSeriesCards(
  seriesId: string,
  from = 1,
  to?: number,
): Promise<SeriesCard[]> {
  let query = supabase
    .from('series_cards')
    .select('position,section_title,body')
    .eq('series_id', seriesId)
    .gte('position', from);
  if (to !== undefined) query = query.lte('position', to);
  const { data, error } = (await query.order('position', { ascending: true })) as {
    data: { position: number; section_title: string | null; body: string }[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    position: r.position,
    sectionTitle: r.section_title ?? '',
    body: r.body,
  }));
}

// --- Misafir ilerleme (AsyncStorage) ---

async function readGuest(): Promise<GuestMap> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: GuestMap = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const e = v as Partial<GuestEntry> | null;
      if (e && typeof e.lastPosition === 'number') {
        out[id] = {
          lastPosition: e.lastPosition,
          completedAt: typeof e.completedAt === 'string' ? e.completedAt : null,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function writeGuest(map: GuestMap): Promise<void> {
  try {
    if (Object.keys(map).length === 0) {
      await AsyncStorage.removeItem(GUEST_PROGRESS_KEY);
    } else {
      await AsyncStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(map));
    }
  } catch {
    // depolama yoksa ilerleme kaydedilemez; okuma devam eder
  }
}

export async function getProgress(
  seriesId: string,
  userId: string | null,
): Promise<SeriesProgress | null> {
  if (!userId) {
    const entry = (await readGuest())[seriesId];
    return entry
      ? { seriesId, lastPosition: entry.lastPosition, completedAt: entry.completedAt }
      : null;
  }
  const { data, error } = (await supabase
    .from('series_progress')
    .select('series_id,last_position,completed_at')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .maybeSingle()) as { data: ProgressRow | null; error: { message: string } | null };
  if (error || !data) return null;
  return {
    seriesId: data.series_id,
    lastPosition: data.last_position ?? 0,
    completedAt: data.completed_at ?? null,
  };
}

export async function saveProgress(
  seriesId: string,
  position: number,
  cardCount: number,
  userId: string | null,
): Promise<void> {
  const requested = Math.max(0, Math.min(Math.floor(position), cardCount));
  const now = new Date().toISOString();

  // İlerleme asla geriye gitmez: eski ve yeni pozisyonun büyüğü saklanır.
  if (!userId) {
    const map = await readGuest();
    const prev = map[seriesId];
    const lastPosition = Math.max(prev?.lastPosition ?? 0, requested);
    const finished = cardCount > 0 && lastPosition >= cardCount;
    map[seriesId] = {
      lastPosition,
      completedAt: prev?.completedAt ?? (finished ? now : null),
    };
    await writeGuest(map);
    return;
  }

  const prev = await getProgress(seriesId, userId);
  const lastPosition = Math.max(prev?.lastPosition ?? 0, requested);
  const finished = cardCount > 0 && lastPosition >= cardCount;
  const payload: Record<string, unknown> = {
    user_id: userId,
    series_id: seriesId,
    last_position: lastPosition,
    updated_at: now,
  };
  if (finished && !prev?.completedAt) payload.completed_at = now;
  const { error } = await supabase
    .from('series_progress')
    .upsert(payload, { onConflict: 'user_id,series_id' });
  if (error) console.error('[Series] saveProgress failed:', error.message);
}

/** Cihazdaki misafir ilerlemesini sunucuya taşır; çakışmada büyük pozisyon kazanır. */
export async function mergeGuestProgress(userId: string): Promise<void> {
  const guest = await readGuest();
  const ids = Object.keys(guest);
  if (ids.length === 0) return;

  const { data, error } = (await supabase
    .from('series_progress')
    .select('series_id,last_position,completed_at')
    .eq('user_id', userId)) as { data: ProgressRow[] | null; error: { message: string } | null };
  if (error || !data) return; // cihaz kaydı korunur, sonraki açılışta tekrar denenir

  const server = new Map(data.map((r) => [r.series_id, r]));
  const now = new Date().toISOString();
  for (const id of ids) {
    const g = guest[id];
    const s = server.get(id);
    const serverPos = s?.last_position ?? 0;
    const needsPosition = !s || serverPos < g.lastPosition;
    const needsCompleted = !!g.completedAt && !s?.completed_at;
    if (!needsPosition && !needsCompleted) continue;
    const payload: Record<string, unknown> = {
      user_id: userId,
      series_id: id,
      last_position: Math.max(serverPos, g.lastPosition),
      updated_at: now,
    };
    if (needsCompleted) payload.completed_at = g.completedAt;
    const res = await supabase
      .from('series_progress')
      .upsert(payload, { onConflict: 'user_id,series_id' });
    if (res.error) return; // kısmi hata: cihaz kaydı korunur
  }
  await writeGuest({});
}

export function groupForShelves(list: SeriesSummary[]): {
  featured: SeriesSummary | null;
  byCategory: { category: string; items: SeriesSummary[] }[];
} {
  if (list.length === 0) return { featured: null, byCategory: [] };
  const newest = list.reduce((a, b) => ((b.publishedAt ?? '') > (a.publishedAt ?? '') ? b : a));
  const featured = list.find((s) => s.isFeatured) ?? newest;

  const groups = new Map<string, SeriesSummary[]>();
  for (const item of list) {
    const key = item.category ?? UNCATEGORIZED;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return {
    featured,
    byCategory: [...groups.entries()].map(([category, items]) => ({ category, items })),
  };
}
