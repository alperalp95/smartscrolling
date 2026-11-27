import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import SeriesCoverScreen from '../../app/series/[slug]';
import { fetchSeriesBySlug, getProgress } from '../lib/series';
import { useAuthStore } from '../store/authStore';
import type { SeriesDetail } from '../types';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ slug: 'galata-kulesi' }),
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
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('../lib/series', () => ({ fetchSeriesBySlug: jest.fn(), getProgress: jest.fn() }));

const mockFetch = fetchSeriesBySlug as jest.Mock;
const mockProgress = getProgress as jest.Mock;

const detail = (over: Partial<SeriesDetail> = {}): SeriesDetail => ({
  id: 'g',
  slug: 'galata-kulesi',
  title: 'Galata Kulesi',
  summary: 'Bir İstanbul simgesinin hikayesi.',
  category: '📜 TARİH',
  coverUrl: null,
  cardCount: 31,
  sectionCount: 3,
  isFree: false,
  isFeatured: false,
  publishedAt: null,
  sections: [
    { title: 'Giriş', firstPosition: 1, cardCount: 3 },
    { title: 'Tarihçe', firstPosition: 4, cardCount: 20 },
    { title: 'Mimari', firstPosition: 24, cardCount: 8 },
  ],
  sourceTitle: 'Galata Kulesi',
  sourceUrl: 'https://tr.wikipedia.org/wiki/Galata_Kulesi',
  license: 'CC BY-SA 4.0',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(detail());
  mockProgress.mockResolvedValue(null);
  useAuthStore.setState({ hasPremium: false, user: null } as never);
});

describe('SeriesCoverScreen', () => {
  it('ilerleme yoksa "Okumaya başla" ve okuma rotasına gider', async () => {
    const { findByTestId, getByText } = render(<SeriesCoverScreen />);
    await findByTestId('series-cover');
    expect(getByText('Galata Kulesi')).toBeTruthy();
    expect(getByText('Okumaya başla')).toBeTruthy();
    fireEvent.press(await findByTestId('series-start'));
    expect(mockPush).toHaveBeenCalledWith('/series/galata-kulesi/read?from=1');
  });

  it('ilerleme varsa düğme "Devam et (12/31)" ve o karttan açar', async () => {
    mockProgress.mockResolvedValue({ seriesId: 'g', lastPosition: 12, completedAt: null });
    const { findByText, findByTestId } = render(<SeriesCoverScreen />);
    expect(await findByText('Devam et (12/31)')).toBeTruthy();
    fireEvent.press(await findByTestId('series-start'));
    expect(mockPush).toHaveBeenCalledWith('/series/galata-kulesi/read?from=12');
  });

  it('premium olmayanda premium serinin 3. karttan sonraki bölümleri kilitli', async () => {
    const { findByTestId, getByTestId } = render(<SeriesCoverScreen />);
    await findByTestId('series-section-1');
    expect(getByTestId('series-section-1').props.accessibilityLabel).not.toMatch(/kilitli/);
    expect(getByTestId('series-section-2').props.accessibilityLabel).toMatch(/kilitli/);
    expect(getByTestId('series-section-3').props.accessibilityLabel).toMatch(/kilitli/);
  });

  it('premium kullanıcıda kilit yok', async () => {
    useAuthStore.setState({ hasPremium: true } as never);
    const { findByTestId, getByTestId } = render(<SeriesCoverScreen />);
    await findByTestId('series-section-2');
    expect(getByTestId('series-section-2').props.accessibilityLabel).not.toMatch(/kilitli/);
  });

  it('ücretsiz seride premium olmayana da kilit yok', async () => {
    mockFetch.mockResolvedValue(detail({ isFree: true }));
    const { findByTestId, getByTestId } = render(<SeriesCoverScreen />);
    await findByTestId('series-section-3');
    expect(getByTestId('series-section-3').props.accessibilityLabel).not.toMatch(/kilitli/);
  });

  it('kaynak satırı bağlantıyı açar', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { findByText } = render(<SeriesCoverScreen />);
    fireEvent.press(await findByText(/Kaynak: Vikipedi/));
    expect(open).toHaveBeenCalledWith('https://tr.wikipedia.org/wiki/Galata_Kulesi');
  });

  it('seri bulunamazsa mesaj gösterir', async () => {
    mockFetch.mockResolvedValue(null);
    const { findByText } = render(<SeriesCoverScreen />);
    await waitFor(async () => expect(await findByText('Seri bulunamadı.')).toBeTruthy());
  });

  it('ağ hatasında "Yüklenemedi" ve yeniden dene düğmesi çıkar (bulunamadı değil)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ağ'));
    const { findByText, queryByText } = render(<SeriesCoverScreen />);
    expect(await findByText('Yüklenemedi.')).toBeTruthy();
    expect(queryByText('Seri bulunamadı.')).toBeNull();
    fireEvent.press(await findByText('Yeniden dene'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(await findByText('Okumaya başla')).toBeTruthy();
  });
});
