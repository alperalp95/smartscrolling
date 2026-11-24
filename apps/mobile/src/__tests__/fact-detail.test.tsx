import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FactDetailScreen from '../../app/fact/[id]';

const mockToggleSave = jest.fn();
const mockFetchFactById = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'f1' }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../lib/facts', () => ({
  fetchFactById: (...args: unknown[]) => mockFetchFactById(...args),
}));
jest.mock('../store/feedStore', () => ({
  useFeedStore: (sel: (s: unknown) => unknown) =>
    sel({ savedIds: [], toggleSave: (...args: unknown[]) => mockToggleSave(...args) }),
}));

const fact = {
  id: 'f1',
  title: 'Test başlığı',
  content: 'Test içeriği',
  category: 'Bilim',
  tags: [],
  media_url: null,
  source_label: 'Kaynak adı',
  source_url: null,
  read_time_sq: 30,
};

describe('FactDetailScreen', () => {
  beforeEach(() => {
    mockToggleSave.mockClear();
    mockFetchFactById.mockReset();
  });

  it('görselsiz kartta fallback ve başlık görünür', async () => {
    mockFetchFactById.mockResolvedValue(fact);
    const { findByText, getByTestId } = render(<FactDetailScreen />);
    expect(await findByText('Test başlığı')).toBeTruthy();
    expect(getByTestId('media-fallback')).toBeTruthy();
    expect(getByTestId('fact-detail-screen')).toBeTruthy();
  });

  it('kaydet butonu toggleSave(id) çağırır', async () => {
    mockFetchFactById.mockResolvedValue(fact);
    const { findByTestId } = render(<FactDetailScreen />);
    fireEvent.press(await findByTestId('fact-detail-save'));
    expect(mockToggleSave).toHaveBeenCalledWith('f1');
  });

  it('kart yoksa "Kart bulunamadı." görünür', async () => {
    mockFetchFactById.mockResolvedValue(null);
    const { findByText } = render(<FactDetailScreen />);
    await waitFor(async () => expect(await findByText('Kart bulunamadı.')).toBeTruthy());
  });
});
