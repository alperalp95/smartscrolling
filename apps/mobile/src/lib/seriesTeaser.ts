import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SeriesTeaserConfig } from '../config/seriesTeaser';
import type { SeriesProgress, SeriesSummary } from '../types';

export const SEEN_SERIES_TEASERS_KEY = 'feed.seenSeriesTeasers.v1';

export type FeedSeriesSlot = {
  id: string;
  slotType: 'series';
  series: SeriesSummary;
  mode: 'teaser' | 'continue';
  lastPosition: number;
};

/**
 * Tanıtım kuyruğu: önce kaldığın yerden (tamamlanmamış, ilerleme > 0), sonra görülmemiş ve
 * tamamlanmamış seriler. "En son güncellenen", `progress` anahtar sırasının sonudur
 * (getAllProgress satırları updated_at artan sırada okur).
 */
export function planSeriesTeasers(
  list: SeriesSummary[],
  progress: Record<string, SeriesProgress>,
  seenIds: string[],
  config: SeriesTeaserConfig,
): FeedSeriesSlot[] {
  const byId = new Map(list.map((s) => [s.id, s]));
  const seen = new Set(seenIds);
  const isOpen = (id: string) => !progress[id]?.completedAt;

  const continues: FeedSeriesSlot[] = [];
  for (const id of Object.keys(progress).reverse()) {
    const s = byId.get(id);
    const last = progress[id].lastPosition;
    if (!s || !isOpen(id) || last <= 0) continue;
    continues.push({
      id: `feed-series-${id}`,
      slotType: 'series',
      series: s,
      mode: 'continue',
      lastPosition: last,
    });
  }
  const continuing = new Set(continues.map((c) => c.series.id));

  const candidates = list.filter((s) => isOpen(s.id) && !seen.has(s.id) && !continuing.has(s.id));
  let ordered = candidates;
  if (config.alternate) {
    const free = candidates.filter((s) => s.isFree);
    const premium = candidates.filter((s) => !s.isFree);
    ordered = [];
    for (let i = 0; i < Math.max(free.length, premium.length); i++) {
      if (i < free.length) ordered.push(free[i]);
      if (i < premium.length) ordered.push(premium[i]);
    }
  }

  const teasers: FeedSeriesSlot[] = ordered.map((s) => ({
    id: `feed-series-${s.id}`,
    slotType: 'series',
    series: s,
    mode: 'teaser',
    lastPosition: 0,
  }));
  return [...continues, ...teasers];
}

const isContent = (item: unknown): boolean =>
  !(item && typeof item === 'object' && 'slotType' in item);

/**
 * İçerik kartı sayısına göre (reklam yuvaları sayılmaz) `firstAfter` sonra her `interval`'de bir
 * tanıtım ekler. Reklam yuvasının hemen önüne denk gelirse bir sonraki içerik kartından sonraya
 * kayar. Kuyruk bitince durur.
 */
export function insertSeriesSlots<T extends { id: string }>(
  items: Array<T | { slotType: string }>,
  slots: FeedSeriesSlot[],
  config: SeriesTeaserConfig,
): Array<T | { slotType: string } | FeedSeriesSlot> {
  if (slots.length === 0) return items;

  const result: Array<T | { slotType: string } | FeedSeriesSlot> = [];
  let contentCount = 0;
  let next = 0;
  let pending = false;

  items.forEach((item, index) => {
    result.push(item);
    if (!isContent(item)) return;
    contentCount += 1;
    if (next >= slots.length) return;

    const due =
      contentCount >= config.firstAfter &&
      (contentCount - config.firstAfter) % config.interval === 0;
    if (!due && !pending) return;

    const following = items[index + 1];
    if (following !== undefined && !isContent(following)) {
      pending = true;
      return;
    }
    pending = false;
    result.push(slots[next]);
    next += 1;
  });

  return result;
}

export async function loadSeenSeriesTeasers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_SERIES_TEASERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed as string[];
    }
  } catch {
    // bozuk veri ya da depolama yok: boş liste
  }
  return [];
}

export async function markSeriesTeaserSeen(seriesId: string): Promise<void> {
  const ids = await loadSeenSeriesTeasers();
  if (ids.includes(seriesId)) return;
  try {
    await AsyncStorage.setItem(SEEN_SERIES_TEASERS_KEY, JSON.stringify([...ids, seriesId]));
  } catch {
    // depolama yoksa tanıtım bir sonraki açılışta tekrar görünebilir
  }
}
