import { fireEvent, render } from '@testing-library/react-native';
import SettingsScreen from '../../app/settings';

let mockUser: { id: string } | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser, hasPremium: false }),
}));
jest.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));
jest.mock('../lib/accountDeletion', () => ({ deleteCurrentAccount: jest.fn() }));
jest.mock('../lib/notifications', () => ({
  cancelSmartScrollingScheduledNotifications: jest.fn(),
  getLocalNotificationPermissionStatus: jest.fn(),
  reconcileDailyLocalReminder: jest.fn(),
  requestLocalNotificationPermission: jest.fn(),
}));
jest.mock('../lib/premiumPrompt', () => ({ promptForPremium: jest.fn() }));
jest.mock('../lib/purchases', () => ({ presentCustomerCenterSafe: jest.fn() }));
jest.mock('../lib/pushTokens', () => ({
  disableCurrentExpoPushToken: jest.fn(),
  disableUserPushTokens: jest.fn(),
  refreshCurrentExpoPushTokenIfPermissionGranted: jest.fn(),
  upsertCurrentExpoPushToken: jest.fn(),
}));
jest.mock('../lib/userActivity', () => ({ fetchActivitySummary: jest.fn() }));
jest.mock('../lib/userPreferences', () => ({
  updateNotificationPreference: jest.fn(),
  updateNotificationTimePreference: jest.fn(),
  updateUserDailyGoal: jest.fn(),
  updateUserInterests: jest.fn(),
}));

describe('SettingsScreen', () => {
  it('giriş yokken "Hesabını bağla" görünür, silme girişi görünmez', () => {
    mockUser = null;
    const { getByText, queryByTestId, getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByText('Hesabını bağla')).toBeTruthy();
    expect(queryByTestId('account-delete-entry')).toBeNull();
  });

  it('giriş varken silme girişi görünür ve basınca onay paneli açılır', () => {
    mockUser = { id: 'u1' };
    const { getByTestId, queryByText, getByText } = render(<SettingsScreen />);
    expect(queryByText('Hesap kalıcı olarak silinsin mi?')).toBeNull();
    fireEvent.press(getByTestId('account-delete-entry'));
    expect(getByText('Hesap kalıcı olarak silinsin mi?')).toBeTruthy();
    expect(getByTestId('account-delete-confirm')).toBeTruthy();
  });
});
