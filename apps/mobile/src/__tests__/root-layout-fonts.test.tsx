import { render } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [false]) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => {
  const Stack = () => null;
  Stack.Screen = () => null;
  return { Stack };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: () => null }));
jest.mock('../../components/auth-prompt-modal', () => ({ AuthPromptModal: () => null }));
jest.mock('../../components/premium-prompt-modal', () => ({ PremiumPromptModal: () => null }));
jest.mock('../lib/adMob', () => ({
  initializeGoogleMobileAdsForDemoSmoke: jest.fn(() => Promise.resolve()),
}));
jest.mock('../lib/notifications', () => ({
  cancelSmartScrollingScheduledNotifications: jest.fn(),
  reconcileDailyLocalReminder: jest.fn(),
}));
jest.mock('../lib/premiumEntitlements', () => ({ hydratePremiumEntitlement: jest.fn() }));
jest.mock('../lib/pushTokens', () => ({
  refreshCurrentExpoPushTokenIfPermissionGranted: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => new Promise(() => {})),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
jest.mock('../lib/userActivity', () => ({ fetchActivitySummary: jest.fn() }));
jest.mock('../lib/userPreferences', () => ({ fetchUserPreferences: jest.fn() }));

describe('RootLayout fonts', () => {
  it('renders null until fonts are loaded', () => {
    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
  });
});
