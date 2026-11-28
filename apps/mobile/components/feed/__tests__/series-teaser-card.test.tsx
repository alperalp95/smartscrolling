import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SEEN_SERIES_TEASERS_KEY } from '../../../src/lib/seriesTeaser';
import type { SeriesSummary } from '../../../src/types';
import { SeriesTeaserCard, loadSeriesTeaserSlots, teaserSummary } from '../series-teaser-card';

const mockFetchSeriesList = jest.fn();
const mockGetAllProgress = jest.fn();
jest.mock('../../../src/lib/series', () => ({
  fetchSeriesList: (...args: unknown[]) => mockFetchSeriesList(...args),
  getAllProgress: (...args: unknown[]) => mockGetAllProgress(...args),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('@react-native-masked-view/masked-view', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: unknown }) => <View>{children as never}</View>,
  };
});

const free: SeriesSummary = {
  id: 's1',
  slug: 'galata-kulesi',
  title: 'Galata Kulesi',
  summary: 'Galata Kulesi, İstanbul’da bir kuledir.\n\nİkinci paragraf görünmez.',
  category: 'Tarih',
  coverUrl: null,
  cardCount: 84,
  sectionCount: 6,
  isFree: true,
  isFeatured: false,
  publishedAt: '2026-01-01',
};
const premium: SeriesSummary = {
  ...free,
  id: 's2',
  slug: 'ibn-haldun',
  title: 'İbn Haldun',
  isFree: false,
  cardCount: 144,
};

const base = { height: 700, topInset: 40, isActive: false, hasPremium: false, onOpen: jest.fn() };

beforeEach(async () => {
  base.onOpen.mockClear();
  mockFetchSeriesList.mockReset();
  mockGetAllProgress.mockReset().mockResolvedValue({});
  await AsyncStorage.clear();
});

describe('SeriesTeaserCard', () => {
  it('ücretsiz seri: çip, meta, özet, düğme ve alt yazı', () => {
    const { getByText, getByTestId, queryByText } = render(
      <SeriesTeaserCard {...base} series={free} mode="teaser" lastPosition={0} />,
    );
    expect(getByTestId('feed-series-teaser-galata-kulesi')).toBeTruthy();
    expect(getByText('SERİ · 84 kart')).toBeTruthy();
    expect(queryByText('PREMIUM')).toBeNull();
    expect(getByText('TARİH · SERİ')).toBeTruthy();
    expect(getByText('Galata Kulesi')).toBeTruthy();
    expect(getByText('Galata Kulesi, İstanbul’da bir kuledir.')).toBeTruthy();
    expect(queryByText(/İkinci paragraf/)).toBeNull();
    expect(getByText('Seriyi okumaya devam et →')).toBeTruthy();
    expect(getByText('84 kart · ~84 dk · ücretsiz')).toBeTruthy();
  });

  it('premium seri, premium olmayan kullanıcı: PREMIUM çipi ve ilk 3 kart', () => {
    const { getByText } = render(
      <SeriesTeaserCard {...base} series={premium} mode="teaser" lastPosition={0} />,
    );
    expect(getByText('PREMIUM')).toBeTruthy();
    expect(getByText('İlk 3 kartı ücretsiz oku →')).toBeTruthy();
    expect(getByText("144 kart · tamamı Premium'da")).toBeTruthy();
  });

  it('premium seri, premium kullanıcı: çip ve ilk 3 kart metni yok', () => {
    const { getByText, queryByText } = render(
      <SeriesTeaserCard {...base} hasPremium series={premium} mode="teaser" lastPosition={0} />,
    );
    expect(queryByText('PREMIUM')).toBeNull();
    expect(queryByText('İlk 3 kartı ücretsiz oku →')).toBeNull();
    expect(getByText('Seriyi okumaya devam et →')).toBeTruthy();
  });

  it('düğme tanıtımda from=2 ile açar', () => {
    const { getByTestId } = render(
      <SeriesTeaserCard {...base} series={free} mode="teaser" lastPosition={0} />,
    );
    fireEvent.press(getByTestId('feed-series-cta'));
    expect(base.onOpen).toHaveBeenCalledWith('galata-kulesi', 2);
  });

  it('kaldığın yerden: başlık n/N, düğme ve from=lastPosition', () => {
    const { getByText, getByTestId } = render(
      <SeriesTeaserCard {...base} series={free} mode="continue" lastPosition={17} />,
    );
    expect(getByText('Kaldığın yerden: Galata Kulesi · 17/84')).toBeTruthy();
    expect(getByText('Kaldığın yerden devam et →')).toBeTruthy();
    fireEvent.press(getByTestId('feed-series-cta'));
    expect(base.onOpen).toHaveBeenCalledWith('galata-kulesi', 17);
  });

  it('etkin olunca görüldü işaretlenir, etkin değilken işaretlenmez', async () => {
    const { rerender } = render(
      <SeriesTeaserCard {...base} series={free} mode="teaser" lastPosition={0} />,
    );
    expect(await AsyncStorage.getItem(SEEN_SERIES_TEASERS_KEY)).toBeNull();
    rerender(<SeriesTeaserCard {...base} isActive series={free} mode="teaser" lastPosition={0} />);
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(SEEN_SERIES_TEASERS_KEY)) ?? '[]')).toEqual([
        's1',
      ]),
    );
  });
});

describe('loadSeriesTeaserSlots', () => {
  const config = { firstAfter: 8, interval: 12, alternate: true };

  it('liste çekilemezse boş döner, akış tanıtımsız devam eder', async () => {
    mockFetchSeriesList.mockRejectedValueOnce(new Error('ağ yok'));
    await expect(loadSeriesTeaserSlots(null, config)).resolves.toEqual([]);
  });

  it('listeden tanıtım kuyruğu üretir ve ilerlemeyi kullanıcıya göre çeker', async () => {
    mockFetchSeriesList.mockResolvedValueOnce([free, premium]);
    mockGetAllProgress.mockResolvedValueOnce({
      s2: { seriesId: 's2', lastPosition: 5, completedAt: null },
    });
    const slots = await loadSeriesTeaserSlots('u1', config);
    expect(mockGetAllProgress).toHaveBeenCalledWith('u1');
    expect(slots.map((x) => [x.series.id, x.mode])).toEqual([
      ['s2', 'continue'],
      ['s1', 'teaser'],
    ]);
  });
});

describe('teaserSummary', () => {
  it('ilk paragrafı alır', () => {
    expect(teaserSummary('Bir.\n\nİki.')).toBe('Bir.');
  });
  it('240 karakteri aşanı üç noktayla keser', () => {
    const out = teaserSummary('a'.repeat(300));
    expect(out.length).toBe(240);
    expect(out.endsWith('…')).toBe(true);
  });
  it('boş özet boş döner', () => {
    expect(teaserSummary(null)).toBe('');
  });
});
