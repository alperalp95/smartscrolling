import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import SeriesScreen from '../../app/(tabs)/series';
import { fetchSeriesList, getAllProgress } from '../lib/series';
import type { SeriesSummary } from '../types';

const mockPush = jest.fn();
// Sekme odaklanma geri çağrısı: her render'da (odak simülasyonu) sahte bir tetikleyiciyle yeniden çalışır.
let mockFocusTick = 0;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => undefined | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb, mockFocusTick]);
  },
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
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
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('../lib/series', () => {
  const actual = jest.requireActual('../lib/series');
  return {
    fetchSeriesList: jest.fn(),
    getAllProgress: jest.fn(),
    groupForShelves: actual.groupForShelves,
  };
});

const mockFetch = fetchSeriesList as jest.Mock;
const mockProgress = getAllProgress as jest.Mock;

const make = (over: Partial<SeriesSummary>): SeriesSummary => ({
  id: 'id',
  slug: 's',
  title: 'T',
  summary: null,
  category: '📜 TARİH',
  coverUrl: null,
  cardCount: 10,
  sectionCount: 2,
  isFree: true,
  isFeatured: false,
  publishedAt: null,
  ...over,
});

const list = [
  make({
    id: 'g',
    slug: 'galata-kulesi',
    title: 'Galata Kulesi',
    cardCount: 68,
    isFree: false,
    isFeatured: true,
  }),
  make({ id: 'l', slug: 'lale-devri', title: 'Lale Devri', cardCount: 31 }),
];

beforeEach(() => {
  mockPush.mockClear();
  mockFocusTick = 0;
  mockFetch.mockReset();
  mockProgress.mockReset().mockResolvedValue({});
});

describe('Seriler sekmesi', () => {
  it('draws hero and shelves from the list and navigates on press', async () => {
    mockFetch.mockResolvedValue(list);
    const { findByTestId, getByTestId, getByText, queryByTestId } = render(<SeriesScreen />);
    expect(await findByTestId('series-hero')).toBeTruthy();
    expect(getByTestId('series-tab')).toBeTruthy();
    expect(getByText('Seriler')).toBeTruthy();
    expect(getByTestId('series-shelf-📜 TARİH')).toBeTruthy();
    expect(getByTestId('series-item-lale-devri')).toBeTruthy();
    expect(queryByTestId('series-continue')).toBeNull();
    fireEvent.press(getByTestId('series-item-lale-devri'));
    expect(mockPush).toHaveBeenCalledWith('/series/lale-devri');
    fireEvent.press(getByTestId('series-hero'));
    expect(mockPush).toHaveBeenCalledWith('/series/galata-kulesi');
  });

  it('shows Devam et with progress only when a series is in progress', async () => {
    mockFetch.mockResolvedValue(list);
    mockProgress.mockResolvedValue({
      l: { seriesId: 'l', lastPosition: 12, completedAt: null },
    });
    const { findByTestId, getAllByText } = render(<SeriesScreen />);
    expect(await findByTestId('series-continue')).toBeTruthy();
    // Devam et satırı ve raf kapağı aynı metni yazar.
    expect(getAllByText('12 / 31 kart').length).toBeGreaterThanOrEqual(1);
  });

  it('marks a completed series on shelf and hero and keeps it out of Devam et', async () => {
    mockFetch.mockResolvedValue(list);
    mockProgress.mockResolvedValue({
      l: { seriesId: 'l', lastPosition: 31, completedAt: '2026-11-01' },
      g: { seriesId: 'g', lastPosition: 68, completedAt: '2026-11-02' },
    });
    const { findByTestId, queryByTestId } = render(<SeriesScreen />);
    expect(await findByTestId('series-done-lale-devri')).toBeTruthy();
    expect(await findByTestId('series-hero-done')).toBeTruthy();
    expect(queryByTestId('series-continue')).toBeNull();
    expect(queryByTestId('series-progress-lale-devri')).toBeNull();
  });

  it('draws a progress line on the shelf cover of a started series', async () => {
    mockFetch.mockResolvedValue(list);
    mockProgress.mockResolvedValue({
      l: { seriesId: 'l', lastPosition: 12, completedAt: null },
    });
    const { findByTestId, queryByTestId } = render(<SeriesScreen />);
    expect(await findByTestId('series-progress-lale-devri')).toBeTruthy();
    expect(queryByTestId('series-done-lale-devri')).toBeNull();
  });

  it('shows Yakında when the list is empty', async () => {
    mockFetch.mockResolvedValue([]);
    const { findByTestId, getByText } = render(<SeriesScreen />);
    expect(await findByTestId('series-empty')).toBeTruthy();
    expect(getByText('Yakında')).toBeTruthy();
  });

  it('shows error with retry that refetches', async () => {
    mockFetch.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(list);
    const { findByTestId, getByText } = render(<SeriesScreen />);
    expect(await findByTestId('series-error')).toBeTruthy();
    fireEvent.press(getByText('Yeniden dene'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(await findByTestId('series-hero')).toBeTruthy();
  });

  it('refetches silently when the tab is focused again (no loading screen)', async () => {
    mockFetch.mockResolvedValue(list);
    const view = render(<SeriesScreen />);
    expect(await view.findByTestId('series-hero')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    let resolveSecond: (v: SeriesSummary[]) => void = () => {};
    mockFetch.mockReturnValueOnce(
      new Promise((r) => {
        resolveSecond = r;
      }),
    );
    mockFocusTick += 1;
    view.rerender(<SeriesScreen />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(view.getByTestId('series-hero')).toBeTruthy();
    expect(view.UNSAFE_queryByType(require('react-native').ActivityIndicator)).toBeNull();
    await act(async () => {
      resolveSecond([...list, make({ id: 'n', slug: 'yeni', title: 'Yeni Seri', cardCount: 5 })]);
    });
    expect(await view.findByTestId('series-item-yeni')).toBeTruthy();
  });

  it('pull to refresh refetches the list and Devam et', async () => {
    mockFetch.mockResolvedValue(list);
    const view = render(<SeriesScreen />);
    expect(await view.findByTestId('series-hero')).toBeTruthy();
    mockProgress.mockResolvedValue({
      l: { seriesId: 'l', lastPosition: 5, completedAt: null },
    });
    await act(async () => {
      view.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(await view.findByTestId('series-continue')).toBeTruthy();
  });
});
