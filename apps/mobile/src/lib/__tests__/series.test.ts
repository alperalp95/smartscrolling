import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SeriesSummary } from '../../types';
import {
  GUEST_PROGRESS_KEY,
  fetchSeriesBySlug,
  fetchSeriesCards,
  fetchSeriesList,
  getAllProgress,
  getProgress,
  groupForShelves,
  mergeGuestProgress,
  pickNextSeries,
  saveProgress,
} from '../series';

type Result = { data: unknown; error: { message: string } | null };
type Call = { table: string; op: string; args: unknown[] };

let mockResults: Record<string, Result> = {};
let mockCalls: Call[] = [];

function mockMakeChain(table: string) {
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'eq', 'gte', 'lte', 'order', 'maybeSingle', 'upsert', 'in']) {
    chain[op] = jest.fn((...args: unknown[]) => {
      mockCalls.push({ table, op, args });
      return chain;
    });
  }
  // biome-ignore lint/suspicious/noThenProperty: supabase sorgu zinciri await edilebilir olmalı
  chain.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(mockResults[table] ?? { data: null, error: null }).then(resolve, reject);
  return chain;
}

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => mockMakeChain(table)),
  },
}));

function callsOf(table: string, op: string) {
  return mockCalls.filter((c) => c.table === table && c.op === op);
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 'galata-kulesi',
  title: 'Galata Kulesi',
  summary: 'Özet',
  category: '📜 TARİH',
  cover_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/x.jpg',
  card_count: 31,
  section_count: 3,
  is_free: true,
  is_featured: false,
  published_at: '2026-11-20T10:00:00Z',
  source_title: 'Galata Kulesi',
  source_url: 'https://tr.wikipedia.org/wiki/Galata_Kulesi',
  license: 'CC BY-SA 4.0',
  sections: [{ title: 'Giriş', firstPosition: 1, cardCount: 10 }],
  ...over,
});

const summary = (over: Partial<SeriesSummary> = {}): SeriesSummary => ({
  id: 'x',
  slug: 'x',
  title: 'X',
  summary: null,
  category: '📜 TARİH',
  coverUrl: null,
  cardCount: 10,
  sectionCount: 1,
  isFree: false,
  isFeatured: false,
  publishedAt: '2026-11-01T00:00:00Z',
  ...over,
});

beforeEach(async () => {
  mockResults = {};
  mockCalls = [];
  await AsyncStorage.clear();
});

describe('fetchSeries*', () => {
  it('liste satırlarını camelCase tipe eşler', async () => {
    mockResults.series = { data: [row()], error: null };
    const list = await fetchSeriesList();
    expect(list).toEqual([
      {
        id: 's1',
        slug: 'galata-kulesi',
        title: 'Galata Kulesi',
        summary: 'Özet',
        category: '📜 TARİH',
        coverUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/x.jpg',
        cardCount: 31,
        sectionCount: 3,
        isFree: true,
        isFeatured: false,
        publishedAt: '2026-11-20T10:00:00Z',
      },
    ]);
  });

  it('liste hatasında fırlatır (sekme hata durumu gösterir)', async () => {
    mockResults.series = { data: null, error: { message: 'ağ' } };
    await expect(fetchSeriesList()).rejects.toThrow('ağ');
  });

  it('slug ile detay: sections ve kaynak alanları eşlenir', async () => {
    mockResults.series = { data: row(), error: null };
    const detail = await fetchSeriesBySlug('galata-kulesi');
    expect(detail?.sourceTitle).toBe('Galata Kulesi');
    expect(detail?.sourceUrl).toBe('https://tr.wikipedia.org/wiki/Galata_Kulesi');
    expect(detail?.license).toBe('CC BY-SA 4.0');
    expect(detail?.sections).toEqual([{ title: 'Giriş', firstPosition: 1, cardCount: 10 }]);
    expect(callsOf('series', 'eq').some((c) => c.args[0] === 'slug')).toBe(true);
  });

  it('slug bulunamazsa null; bozuk sections boş dizi', async () => {
    mockResults.series = { data: null, error: null };
    expect(await fetchSeriesBySlug('yok')).toBeNull();
    mockResults.series = { data: row({ sections: 'bozuk' }), error: null };
    expect((await fetchSeriesBySlug('galata-kulesi'))?.sections).toEqual([]);
  });

  it('kartlar section_title -> sectionTitle eşlenir, aralık sorgusu uygulanır', async () => {
    mockResults.series_cards = {
      data: [{ position: 4, section_title: 'Tarih', body: 'Metin.' }],
      error: null,
    };
    const cards = await fetchSeriesCards('s1', 4, 6);
    expect(cards).toEqual([{ position: 4, sectionTitle: 'Tarih', body: 'Metin.' }]);
    expect(callsOf('series_cards', 'gte')[0].args).toEqual(['position', 4]);
    expect(callsOf('series_cards', 'lte')[0].args).toEqual(['position', 6]);
  });

  it('RLS kart vermezse (4. kart) boş dizi döner', async () => {
    mockResults.series_cards = { data: [], error: null };
    expect(await fetchSeriesCards('s1', 4)).toEqual([]);
    expect(callsOf('series_cards', 'lte')).toHaveLength(0);
  });
});

describe('misafir ilerleme', () => {
  it('kaydet-oku', async () => {
    await saveProgress('s1', 5, 31, null);
    expect(await getProgress('s1', null)).toEqual({
      seriesId: 's1',
      lastPosition: 5,
      completedAt: null,
    });
    expect(await getProgress('baska', null)).toBeNull();
  });

  it('son kartta completedAt dolar ve sonra korunur', async () => {
    await saveProgress('s1', 31, 31, null);
    const done = await getProgress('s1', null);
    expect(done?.completedAt).not.toBeNull();
    await saveProgress('s1', 30, 31, null);
    expect((await getProgress('s1', null))?.completedAt).toBe(done?.completedAt);
  });

  it('pozisyon 0..cardCount aralığına kırpılır', async () => {
    await saveProgress('s1', 99, 31, null);
    expect((await getProgress('s1', null))?.lastPosition).toBe(31);
    await saveProgress('s2', -3, 31, null);
    expect((await getProgress('s2', null))?.lastPosition).toBe(0);
  });

  it('eski 20, yeni 1 -> 20 kalır; eski 5, yeni 12 -> 12', async () => {
    await saveProgress('s1', 20, 31, null);
    await saveProgress('s1', 1, 31, null);
    expect((await getProgress('s1', null))?.lastPosition).toBe(20);
    await saveProgress('s2', 5, 31, null);
    await saveProgress('s2', 12, 31, null);
    expect((await getProgress('s2', null))?.lastPosition).toBe(12);
  });

  it('tamamlanmış seri yeniden açılınca completed korunur, pozisyon geri gitmez', async () => {
    await saveProgress('s1', 31, 31, null);
    const done = await getProgress('s1', null);
    await saveProgress('s1', 1, 31, null);
    expect(await getProgress('s1', null)).toEqual(done);
  });

  it('bozuk depolama verisi → null', async () => {
    await AsyncStorage.setItem(GUEST_PROGRESS_KEY, '{bozuk');
    expect(await getProgress('s1', null)).toBeNull();
  });
});

describe('girişli ilerleme', () => {
  it('saveProgress series_progress upsert eder; son kartta completed_at gönderir', async () => {
    await saveProgress('s1', 5, 31, 'u1');
    const first = callsOf('series_progress', 'upsert')[0];
    expect(first.args[0]).toMatchObject({ user_id: 'u1', series_id: 's1', last_position: 5 });
    expect((first.args[0] as Record<string, unknown>).completed_at).toBeUndefined();
    expect(first.args[1]).toEqual({ onConflict: 'user_id,series_id' });

    await saveProgress('s1', 31, 31, 'u1');
    const second = callsOf('series_progress', 'upsert')[1];
    expect((second.args[0] as Record<string, unknown>).completed_at).toEqual(expect.any(String));
  });

  it('sunucuda eski 20, yeni 1 -> 20 kalır; eski 5, yeni 12 -> 12', async () => {
    mockResults.series_progress = {
      data: { series_id: 's1', last_position: 20, completed_at: null },
      error: null,
    };
    await saveProgress('s1', 1, 31, 'u1');
    expect(callsOf('series_progress', 'upsert')[0].args[0]).toMatchObject({ last_position: 20 });

    mockResults.series_progress = {
      data: { series_id: 's1', last_position: 5, completed_at: null },
      error: null,
    };
    await saveProgress('s1', 12, 31, 'u1');
    expect(callsOf('series_progress', 'upsert')[1].args[0]).toMatchObject({ last_position: 12 });
  });

  it('sunucuda tamamlanmış seri yeniden açılınca completed_at ezilmez', async () => {
    mockResults.series_progress = {
      data: { series_id: 's1', last_position: 31, completed_at: '2026-11-01T00:00:00Z' },
      error: null,
    };
    await saveProgress('s1', 1, 31, 'u1');
    const payload = callsOf('series_progress', 'upsert')[0].args[0] as Record<string, unknown>;
    expect(payload.last_position).toBe(31);
    expect(payload.completed_at).toBeUndefined();
  });

  it('getProgress sunucu satırını eşler', async () => {
    mockResults.series_progress = {
      data: { series_id: 's1', last_position: 12, completed_at: null },
      error: null,
    };
    expect(await getProgress('s1', 'u1')).toEqual({
      seriesId: 's1',
      lastPosition: 12,
      completedAt: null,
    });
  });
});

describe('mergeGuestProgress (odak 4)', () => {
  async function guest(position: number) {
    await saveProgress('s1', position, 40, null);
  }

  it('sunucuda 5, cihazda 12 -> 12 yazılır, cihaz kaydı silinir', async () => {
    await guest(12);
    mockResults.series_progress = {
      data: [{ series_id: 's1', last_position: 5, completed_at: null }],
      error: null,
    };
    await mergeGuestProgress('u1');
    const ups = callsOf('series_progress', 'upsert');
    expect(ups).toHaveLength(1);
    expect(ups[0].args[0]).toMatchObject({ user_id: 'u1', series_id: 's1', last_position: 12 });
    expect(await AsyncStorage.getItem(GUEST_PROGRESS_KEY)).toBeNull();
  });

  it('sunucuda 20, cihazda 12 -> 20 kalır (yazma yok), cihaz kaydı silinir', async () => {
    await guest(12);
    mockResults.series_progress = {
      data: [{ series_id: 's1', last_position: 20, completed_at: null }],
      error: null,
    };
    await mergeGuestProgress('u1');
    expect(callsOf('series_progress', 'upsert')).toHaveLength(0);
    expect(await AsyncStorage.getItem(GUEST_PROGRESS_KEY)).toBeNull();
  });

  it('sunucuda pozisyon büyük ama completed_at yok -> misafirin completedAt aktarılır', async () => {
    await saveProgress('s1', 40, 40, null);
    mockResults.series_progress = {
      data: [{ series_id: 's1', last_position: 40, completed_at: null }],
      error: null,
    };
    await mergeGuestProgress('u1');
    const ups = callsOf('series_progress', 'upsert');
    expect(ups).toHaveLength(1);
    expect(ups[0].args[0]).toMatchObject({ last_position: 40, completed_at: expect.any(String) });
  });

  it('sunucuda satır yoksa cihazdaki yazılır', async () => {
    await guest(7);
    mockResults.series_progress = { data: [], error: null };
    await mergeGuestProgress('u1');
    expect(callsOf('series_progress', 'upsert')[0].args[0]).toMatchObject({ last_position: 7 });
  });

  it('sunucu hatasında cihaz kaydı korunur', async () => {
    await guest(12);
    mockResults.series_progress = { data: null, error: { message: 'ağ' } };
    await mergeGuestProgress('u1');
    expect(await AsyncStorage.getItem(GUEST_PROGRESS_KEY)).not.toBeNull();
  });

  it('cihazda kayıt yoksa sunucuya hiç gitmez', async () => {
    await mergeGuestProgress('u1');
    expect(mockCalls).toHaveLength(0);
  });
});

describe('groupForShelves', () => {
  it('boş liste', () => {
    expect(groupForShelves([])).toEqual({ featured: null, byCategory: [] });
  });

  it('featured = isFeatured ilk; yoksa en yeni', () => {
    const a = summary({ id: 'a', publishedAt: '2026-11-01T00:00:00Z' });
    const b = summary({ id: 'b', publishedAt: '2026-11-10T00:00:00Z' });
    const c = summary({ id: 'c', isFeatured: true, publishedAt: '2026-10-01T00:00:00Z' });
    expect(groupForShelves([a, b]).featured?.id).toBe('b');
    expect(groupForShelves([a, b, c]).featured?.id).toBe('c');
  });

  it('kategoriye göre gruplar, sıra korunur; kategorisiz "Diğer" altında', () => {
    const list = [
      summary({ id: 'a', category: '📜 TARİH' }),
      summary({ id: 'b', category: '🔬 BİLİM' }),
      summary({ id: 'c', category: null }),
      summary({ id: 'd', category: '📜 TARİH' }),
    ];
    const { byCategory } = groupForShelves(list);
    expect(byCategory.map((g) => g.category)).toEqual(['📜 TARİH', '🔬 BİLİM', 'Diğer']);
    expect(byCategory[0].items.map((i) => i.id)).toEqual(['a', 'd']);
    expect(byCategory[2].items.map((i) => i.id)).toEqual(['c']);
  });
});

describe('getAllProgress', () => {
  it('misafir: AsyncStorage haritasını döner, ağa gitmez', async () => {
    await AsyncStorage.setItem(
      GUEST_PROGRESS_KEY,
      JSON.stringify({
        a: { lastPosition: 5, completedAt: null },
        b: { lastPosition: 12, completedAt: '2026-11-02T00:00:00Z' },
      }),
    );
    const map = await getAllProgress(null);
    expect(map).toEqual({
      a: { seriesId: 'a', lastPosition: 5, completedAt: null },
      b: { seriesId: 'b', lastPosition: 12, completedAt: '2026-11-02T00:00:00Z' },
    });
    expect(mockCalls).toHaveLength(0);
  });

  it('misafir: kayıt yoksa boş harita', async () => {
    expect(await getAllProgress(null)).toEqual({});
  });

  it('girişli: tek sorguda tüm satırlar haritaya eşlenir', async () => {
    mockResults.series_progress = {
      data: [
        { series_id: 'a', last_position: 3, completed_at: null },
        { series_id: 'b', last_position: null, completed_at: '2026-11-03T00:00:00Z' },
      ],
      error: null,
    };
    const map = await getAllProgress('u1');
    expect(map).toEqual({
      a: { seriesId: 'a', lastPosition: 3, completedAt: null },
      b: { seriesId: 'b', lastPosition: 0, completedAt: '2026-11-03T00:00:00Z' },
    });
    expect(callsOf('series_progress', 'select')).toHaveLength(1);
    expect(callsOf('series_progress', 'eq')[0].args).toEqual(['user_id', 'u1']);
  });

  it('girişli: sunucu hatasında hata fırlatır (boş harita dönmez)', async () => {
    mockResults.series_progress = { data: null, error: { message: 'ağ' } };
    await expect(getAllProgress('u1')).rejects.toThrow('ağ');
  });
});

describe('pickNextSeries', () => {
  const cur = summary({ id: 'cur', category: '📜 TARİH', publishedAt: '2026-11-01T00:00:00Z' });
  const sameOld = summary({
    id: 'same-old',
    category: '📜 TARİH',
    publishedAt: '2026-11-02T00:00:00Z',
  });
  const sameNew = summary({
    id: 'same-new',
    category: '📜 TARİH',
    publishedAt: '2026-11-09T00:00:00Z',
  });
  const other = summary({ id: 'other', category: '🔬 BİLİM', publishedAt: '2026-11-20T00:00:00Z' });
  const done = (id: string) => ({
    [id]: { seriesId: id, lastPosition: 10, completedAt: '2026-11-10T00:00:00Z' },
  });

  it('aynı kategoriden tamamlanmamış en yeniyi seçer', () => {
    expect(pickNextSeries([cur, sameOld, sameNew, other], cur, {})?.id).toBe('same-new');
  });

  it('tamamlananı ve kendisini atlar', () => {
    expect(pickNextSeries([cur, sameOld, sameNew, other], cur, done('same-new'))?.id).toBe(
      'same-old',
    );
  });

  it('aynı kategoride kalmadıysa herhangi bir tamamlanmamışın en yenisi', () => {
    const progress = { ...done('same-old'), ...done('same-new') };
    expect(pickNextSeries([cur, sameOld, sameNew, other], cur, progress)?.id).toBe('other');
  });

  it('hepsi tamamlandıysa ya da tek seri varsa null', () => {
    expect(pickNextSeries([cur], cur, {})).toBeNull();
    expect(pickNextSeries([cur, other], cur, done('other'))).toBeNull();
  });
});
