import { render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../../app/(tabs)/profile';
import { SavedGrid } from '../../components/profile/saved-grid';

let mockUser: { id: string; email: string } | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonStyle: { WHITE: 0 },
  AppleAuthenticationButtonType: { CONTINUE: 0 },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: mockUser, hasPremium: false, isInitializing: false }),
}));
jest.mock('../lib/supabase', () => ({ supabase: { auth: {} } }));
jest.mock('../lib/socialAuth', () => ({
  isAppleSignInAvailable: jest.fn(() => Promise.resolve(false)),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));
jest.mock('../lib/facts', () => ({ fetchSavedFacts: jest.fn(() => Promise.resolve([])) }));
jest.mock('../lib/userActivity', () => ({
  fetchActivitySummary: jest.fn(() => Promise.resolve({ streakDays: 4 })),
  fetchLifetimeFactsRead: jest.fn(() => Promise.resolve(27)),
}));

describe('ProfileScreen', () => {
  it('giriş yokken e-posta anahtarı ve ayarlar düğmesi görünür', () => {
    mockUser = null;
    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId('profile-screen')).toBeTruthy();
    expect(getByTestId('auth-email-toggle')).toBeTruthy();
    expect(getByTestId('profile-settings-button')).toBeTruthy();
  });

  it('giriş varken üç istatistik değeri görünür', async () => {
    mockUser = { id: 'u1', email: 'ada@example.com' };
    const { getByText, queryByTestId } = render(<ProfileScreen />);
    expect(queryByTestId('auth-email-toggle')).toBeNull();
    expect(getByText('ada')).toBeTruthy();
    await waitFor(() => {
      expect(getByText('4')).toBeTruthy();
      expect(getByText('27')).toBeTruthy();
      expect(getByText('0')).toBeTruthy();
    });
  });
});

describe('SavedGrid', () => {
  const fact = {
    id: 'f1',
    title: 'Başlık',
    content: 'x',
    category: 'bilim',
    tags: [],
    read_time_sq: 1,
    likes: 0,
  };

  it('görselsiz kartta media-fallback gösterir', () => {
    const { getByTestId, getAllByTestId } = render(
      <SavedGrid facts={[fact]} onPressFact={() => {}} />,
    );
    expect(getAllByTestId('saved-grid-item')).toHaveLength(1);
    expect(getByTestId('media-fallback')).toBeTruthy();
  });

  it('boş listede emptyText gösterir', () => {
    const { getByText } = render(
      <SavedGrid facts={[]} onPressFact={() => {}} emptyText="Boş burası" />,
    );
    expect(getByText('Boş burası')).toBeTruthy();
  });
});
