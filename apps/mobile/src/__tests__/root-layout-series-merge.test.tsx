import { render, waitFor } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';
import { mergeGuestProgress } from '../lib/series';
import { supabase } from '../lib/supabase';

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
jest.mock('../lib/premiumEntitlements', () => ({
  hydratePremiumEntitlement: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../lib/pushTokens', () => ({
  refreshCurrentExpoPushTokenIfPermissionGranted: jest.fn(),
}));
jest.mock('../lib/series', () => ({ mergeGuestProgress: jest.fn(() => Promise.resolve()) }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => new Promise(() => {})),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
jest.mock('../lib/userActivity', () => ({ fetchActivitySummary: jest.fn() }));
jest.mock('../lib/userPreferences', () => ({
  fetchUserPreferences: jest.fn(() => Promise.reject(new Error('yok'))),
}));
jest.mock('../store/feedStore', () => ({
  useFeedStore: (sel: (s: unknown) => unknown) =>
    sel({ clearSavedFacts: jest.fn(), syncSavedFacts: jest.fn(() => Promise.resolve()) }),
}));

const authChange = () =>
  (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0] as (
    event: string,
    session: unknown,
  ) => void;

describe('RootLayout misafir seri ilerlemesi', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (mergeGuestProgress as jest.Mock).mockClear();
  });

  it('oturum açılınca bir kez birleştirir; token yenilemesi tekrar çağırmaz', async () => {
    render(<RootLayout />);
    const session = { user: { id: 'u1' } };
    authChange()('SIGNED_IN', session);
    await waitFor(() => expect(mergeGuestProgress).toHaveBeenCalledWith('u1'));
    authChange()('TOKEN_REFRESHED', session);
    await new Promise((r) => setTimeout(r, 20));
    expect(mergeGuestProgress).toHaveBeenCalledTimes(1);
  });

  it('oturum yokken birleştirmez', async () => {
    render(<RootLayout />);
    authChange()('SIGNED_OUT', null);
    await new Promise((r) => setTimeout(r, 20));
    expect(mergeGuestProgress).not.toHaveBeenCalled();
  });
});
