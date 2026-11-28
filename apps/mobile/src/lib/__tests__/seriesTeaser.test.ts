import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SeriesProgress, SeriesSummary } from '../../types';
import {
  type FeedSeriesSlot,
  SEEN_SERIES_TEASERS_KEY,
  insertSeriesSlots,
  loadSeenSeriesTeasers,
  markSeriesTeaserSeen,
  planSeriesTeasers,
} from '../seriesTeaser';

const CONFIG = { firstAfter: 8, interval: 12, alternate: true };

type Mixed = { id: string } | { slotType: string };

const series = (id: string, over: Partial<SeriesSummary> = {}): SeriesSummary => ({
  id,
  slug: id,
  title: id,
  summary: null,
  category: null,
  coverUrl: null,
  cardCount: 20,
  sectionCount: 2,
  isFree: true,
  isFeatured: false,
  publishedAt: null,
  ...over,
});

const prog = (id: string, lastPosition: number, completedAt: string | null = null) => ({
  [id]: { seriesId: id, lastPosition, completedAt } as SeriesProgress,
});

const slot = (id: string): FeedSeriesSlot => ({
  id: `feed-series-${id}`,
  slotType: 'series',
  series: series(id),
  mode: 'teaser',
  lastPosition: 0,
});

const content = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` }));
const isSeries = (x: unknown) => (x as { slotType?: string }).slotType === 'series';
const seriesIndexes = (out: unknown[]) =>
  out.map((x, i) => (isSeries(x) ? i : -1)).filter((i) => i >= 0);

describe('planSeriesTeasers', () => {
  it('ücretsiz ve premium dönüşümlü sıralanır', () => {
    const list = [
      series('f1'),
      series('f2'),
      series('p1', { isFree: false }),
      series('p2', { isFree: false }),
    ];
    const plan = planSeriesTeasers(list, {}, [], CONFIG);
    expect(plan.map((s) => s.series.id)).toEqual(['f1', 'p1', 'f2', 'p2']);
    expect(plan.every((s) => s.mode === 'teaser' && s.slotType === 'series')).toBe(true);
  });

  it('alternate kapalıysa liste sırası korunur', () => {
    const list = [series('f1'), series('f2'), series('p1', { isFree: false })];
    const plan = planSeriesTeasers(list, {}, [], { ...CONFIG, alternate: false });
    expect(plan.map((s) => s.series.id)).toEqual(['f1', 'f2', 'p1']);
  });

  it('tamamlanan seriler hariç', () => {
    const list = [series('a'), series('b')];
    const plan = planSeriesTeasers(list, prog('a', 20, '2026-11-01T00:00:00Z'), [], CONFIG);
    expect(plan.map((s) => s.series.id)).toEqual(['b']);
  });

  it('görülmüş tanıtımlar hariç', () => {
    const plan = planSeriesTeasers([series('a'), series('b')], {}, ['a'], CONFIG);
    expect(plan.map((s) => s.series.id)).toEqual(['b']);
  });

  it('kaldığın yerden kartları önce gelir, en son güncellenen başta; her seri en çok bir kez', () => {
    const list = [series('a'), series('b'), series('c')];
    const progress = { ...prog('b', 3), ...prog('c', 7) }; // c en son eklendi/güncellendi
    const plan = planSeriesTeasers(list, progress, [], CONFIG);
    expect(plan.map((s) => [s.series.id, s.mode, s.lastPosition])).toEqual([
      ['c', 'continue', 7],
      ['b', 'continue', 3],
      ['a', 'teaser', 0],
    ]);
  });

  it('kaldığın yerden kartı görülmüş olsa da gösterilir', () => {
    const plan = planSeriesTeasers([series('a')], prog('a', 4), ['a'], CONFIG);
    expect(plan.map((s) => s.mode)).toEqual(['continue']);
  });

  it('gösterilecek seri yoksa boş kuyruk', () => {
    expect(planSeriesTeasers([], {}, [], CONFIG)).toEqual([]);
    expect(planSeriesTeasers([series('a')], {}, ['a'], CONFIG)).toEqual([]);
  });
});

describe('insertSeriesSlots', () => {
  it('ilk tanıtım firstAfter karttan sonra, sonra her interval içerikte bir', () => {
    const out = insertSeriesSlots(content(40), [slot('a'), slot('b'), slot('c')], CONFIG);
    // içerik 8, 20, 32 sonrası; önceki tanıtımlar dizini 1 kaydırır
    expect(seriesIndexes(out)).toEqual([8, 21, 34]);
  });

  it('kuyruk bitince durur', () => {
    const out = insertSeriesSlots(content(60), [slot('a')], CONFIG);
    expect(seriesIndexes(out)).toHaveLength(1);
  });

  it('kuyruk boşsa liste aynen döner', () => {
    const items = content(20);
    expect(insertSeriesSlots(items, [], CONFIG)).toEqual(items);
  });

  it('içerik kartı sayısı firstAfter altındaysa eklenmez', () => {
    expect(insertSeriesSlots(content(7), [slot('a')], CONFIG)).toHaveLength(7);
  });

  it('reklam yuvaları içerik sayılmaz', () => {
    const items: Mixed[] = [];
    for (let i = 1; i <= 8; i++) {
      items.push({ id: `c${i}` });
      if (i === 4) items.push({ slotType: 'ad' });
    }
    const out = insertSeriesSlots(items, [slot('a')], CONFIG);
    expect(out).toHaveLength(10);
    expect(isSeries(out[9])).toBe(true);
  });

  it('reklam yuvasıyla çakışırsa bir sonraki içerik kartından sonraya kayar, ikisi de görünür', () => {
    const items: Mixed[] = [];
    for (let i = 1; i <= 10; i++) {
      items.push({ id: `c${i}` });
      if (i === 8) items.push({ slotType: 'ad' });
    }
    const out = insertSeriesSlots(items, [slot('a')], CONFIG);
    const tags = out.map((x) => (x as { slotType?: string }).slotType ?? (x as { id: string }).id);
    expect(tags).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'c8',
      'ad',
      'c9',
      'series',
      'c10',
    ]);
  });

  it('kayma sonrası kuyruk sıra bozulmadan devam eder', () => {
    const items: Mixed[] = [];
    for (let i = 1; i <= 40; i++) {
      items.push({ id: `c${i}` });
      if (i === 8) items.push({ slotType: 'ad' });
    }
    const out = insertSeriesSlots(items, [slot('a'), slot('b')], CONFIG);
    const order = out.filter(isSeries).map((x) => (x as FeedSeriesSlot).series.id);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('seen teasers storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('boşken boş liste; işaretlenenler kalıcı ve tekrarsız', async () => {
    expect(await loadSeenSeriesTeasers()).toEqual([]);
    await markSeriesTeaserSeen('a');
    await markSeriesTeaserSeen('b');
    await markSeriesTeaserSeen('a');
    expect(await loadSeenSeriesTeasers()).toEqual(['a', 'b']);
    expect(SEEN_SERIES_TEASERS_KEY).toBe('feed.seenSeriesTeasers.v1');
    expect(JSON.parse((await AsyncStorage.getItem(SEEN_SERIES_TEASERS_KEY)) as string)).toEqual([
      'a',
      'b',
    ]);
  });

  it('bozuk veri boş liste sayılır', async () => {
    await AsyncStorage.setItem(SEEN_SERIES_TEASERS_KEY, '{bozuk');
    expect(await loadSeenSeriesTeasers()).toEqual([]);
  });
});
