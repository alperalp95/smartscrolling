import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SeriesScreen from '../../app/(tabs)/series';
import { fetchSeriesList, getProgress } from '../lib/series';
import type { SeriesSummary } from '../types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
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
    getProgress: jest.fn(),
    groupForShelves: actual.groupForShelves,
  };
});

const mockFetch = fetchSeriesList as jest.Mock;
const mockProgress = getProgress as jest.Mock;

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
  mockFetch.mockReset();
  mockProgress.mockReset().mockResolvedValue(null);
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
    mockProgress.mockImplementation(async (id: string) =>
      id === 'l' ? { seriesId: 'l', lastPosition: 12, completedAt: null } : null,
    );
    const { findByTestId, getByText } = render(<SeriesScreen />);
    expect(await findByTestId('series-continue')).toBeTruthy();
    expect(getByText('12 / 31 kart')).toBeTruthy();
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
});
