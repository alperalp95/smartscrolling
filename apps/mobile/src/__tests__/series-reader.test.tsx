import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import SeriesReaderScreen from '../../app/series/[slug]/read';
import { fetchSeriesBySlug, fetchSeriesCards, saveProgress } from '../lib/series';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SeriesCard, SeriesDetail } from '../types';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { slug: string; from?: string } = { slug: 'galata-kulesi' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
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
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// FlashList sanal liste çizer; testte tüm öğeleri çizen ve görünürlük olayını dışarı veren sahtesi.
type MockListProps = {
  testID?: string;
  data: { position: number }[];
  initialScrollIndex?: number;
  keyExtractor: (item: unknown, index: number) => string;
  renderItem: (arg: { item: unknown; index: number }) => ReactNode;
  onViewableItemsChanged: (arg: { viewableItems: { item: unknown; index: number }[] }) => void;
};
let mockListProps = {} as MockListProps;
jest.mock('@shopify/flash-list', () => {
  const { View } = require('react-native');
  return {
    FlashList: (props: MockListProps) => {
      mockListProps = props;
      return (
        <View testID={props.testID}>
          {props.data.map((item: unknown, index: number) => (
            <View key={props.keyExtractor(item, index)}>{props.renderItem({ item, index })}</View>
          ))}
        </View>
      );
    },
  };
});
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { refreshSession: jest.fn(() => Promise.resolve({})) } },
}));
jest.mock('../lib/series', () => ({
  fetchSeriesBySlug: jest.fn(),
  fetchSeriesCards: jest.fn(),
  saveProgress: jest.fn(() => Promise.resolve()),
}));

const mockSeries = fetchSeriesBySlug as jest.Mock;
const mockCards = fetchSeriesCards as jest.Mock;
const mockSave = saveProgress as jest.Mock;
const mockRefresh = supabase.auth.refreshSession as jest.Mock;

const detail = (over: Partial<SeriesDetail> = {}): SeriesDetail => ({
  id: 'g',
  slug: 'galata-kulesi',
  title: 'Galata Kulesi',
  summary: null,
  category: '📜 TARİH',
  coverUrl: null,
  cardCount: 31,
  sectionCount: 3,
  isFree: false,
  isFeatured: false,
  publishedAt: null,
  sections: [],
  sourceTitle: 'Galata Kulesi',
  sourceUrl: 'https://tr.wikipedia.org/wiki/Galata_Kulesi',
  license: 'CC BY-SA 4.0',
  ...over,
});

const cards = (n: number): SeriesCard[] =>
  Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    sectionTitle: i < 3 ? 'Giriş' : 'Tarihçe',
    body: `Gövde ${i + 1}`,
  }));

const viewItem = (index: number) =>
  act(() => {
    mockListProps.onViewableItemsChanged({
      viewableItems: [{ item: mockListProps.data[index], index }],
    });
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { slug: 'galata-kulesi' };
  mockSeries.mockResolvedValue(detail());
  mockCards.mockResolvedValue(cards(3));
  useAuthStore.setState({ hasPremium: false, user: null } as never);
});

describe('SeriesReaderScreen', () => {
  it('kartları sırayla çizer ve "<seri adı> · n / N" gösterir', async () => {
    mockSeries.mockResolvedValue(detail({ isFree: true, cardCount: 3 }));
    const { findByTestId, getByText, queryByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-reader');
    expect(getByText('Gövde 1')).toBeTruthy();
    expect(getByText('Gövde 3')).toBeTruthy();
    expect(getByText('Galata Kulesi · 1 / 3')).toBeTruthy();
    expect(queryByTestId('series-lock')).toBeNull();
    expect(mockListProps.data.map((d: { position: number }) => d.position)).toEqual([1, 2, 3]);
    viewItem(1);
    expect(getByText('Galata Kulesi · 2 / 3')).toBeTruthy();
  });

  it('?from= konumundan açılır', async () => {
    mockParams = { slug: 'galata-kulesi', from: '3' };
    const { findByText } = render(<SeriesReaderScreen />);
    expect(await findByText('Galata Kulesi · 3 / 31')).toBeTruthy();
    expect(mockListProps.initialScrollIndex).toBe(2);
  });

  it('sayfa değişince ilerlemeyi kaydeder (misafir: userId null)', async () => {
    const { findByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-reader');
    viewItem(1);
    expect(mockSave).toHaveBeenLastCalledWith('g', 2, 31, null);
  });

  it('girişli kullanıcıda userId ile kaydeder', async () => {
    useAuthStore.setState({ user: { id: 'u1' } } as never);
    const { findByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-reader');
    viewItem(2);
    expect(mockSave).toHaveBeenLastCalledWith('g', 3, 31, 'u1');
  });

  it('premium değilken 3. karttan sonra tek kilit sayfası gelir ve /premium açar', async () => {
    mockCards.mockResolvedValue(cards(5)); // RLS'siz sunucu bile 4+ dönse çizilmez
    const { findByTestId, getByText, queryByText, queryByTestId, getAllByTestId } = render(
      <SeriesReaderScreen />,
    );
    await findByTestId('series-lock');
    expect(getAllByTestId('series-lock')).toHaveLength(1);
    expect(queryByTestId('series-card-4')).toBeNull();
    expect(queryByText('Gövde 4')).toBeNull();
    expect(getByText("Serinin devamı Premium'da")).toBeTruthy();
    expect(getByText(/28 kart daha/)).toBeTruthy();
    fireEvent.press(getByText("Premium'u incele"));
    expect(mockPush).toHaveBeenCalledWith('/premium');
  });

  it('kilit sayfasındayken ilerleme kaydedilmez', async () => {
    const { findByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-lock');
    mockSave.mockClear();
    viewItem(3);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('premium görünürken 4. kart boş gelirse oturumu bir kez yeniler ve yeniden çeker', async () => {
    useAuthStore.setState({ hasPremium: true } as never);
    const { findByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-reader');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCards).toHaveBeenCalledTimes(2));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('premium ama belirteç eskiyse bilgi sayfası çıkar; yeniden dene oturumu tekrar yeniler; ilerleme düşmez', async () => {
    mockParams = { slug: 'galata-kulesi', from: '10' };
    useAuthStore.setState({ hasPremium: true } as never);
    const { findByTestId, getByText, queryByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-pending');
    expect(queryByTestId('series-lock')).toBeNull();
    expect(getByText('Premium erişimin hazırlanıyor')).toBeTruthy();
    expect(getByText('Birkaç saniye sonra yeniden dene.')).toBeTruthy();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    viewItem(2);
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.press(getByText('Yeniden dene'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(2));
  });

  it('premium ve tüm kartlar geliyorsa oturum yenilenmez', async () => {
    useAuthStore.setState({ hasPremium: true } as never);
    mockCards.mockResolvedValue(cards(31));
    const { findByTestId, queryByTestId } = render(<SeriesReaderScreen />);
    await findByTestId('series-reader');
    expect(queryByTestId('series-lock')).toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('kapat düğmesi geri döner', async () => {
    const { findByTestId } = render(<SeriesReaderScreen />);
    fireEvent.press(await findByTestId('series-reader-close'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('seri bulunamazsa mesaj gösterir, çökmez', async () => {
    mockSeries.mockResolvedValue(null);
    const { findByText } = render(<SeriesReaderScreen />);
    expect(await findByText('Seri bulunamadı.')).toBeTruthy();
  });

  it('ağ hatasında yeniden dene düğmesi çıkar', async () => {
    mockSeries.mockRejectedValueOnce(new Error('ağ'));
    const { findByText } = render(<SeriesReaderScreen />);
    fireEvent.press(await findByText('Yeniden dene'));
    await waitFor(() => expect(mockSeries).toHaveBeenCalledTimes(2));
  });
});
