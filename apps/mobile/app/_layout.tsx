import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthPromptModal } from '../components/auth-prompt-modal';
import { PremiumPromptModal } from '../components/premium-prompt-modal';
import { hydratePremiumEntitlement } from '../src/lib/premiumEntitlements';
import { supabase } from '../src/lib/supabase';
import { fetchUserPreferences } from '../src/lib/userPreferences';
import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import { useOnboardingStore } from '../src/store/onboardingStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Ionicons.font);
  const finishInitializing = useAuthStore((state) => state.finishInitializing);
  const setHasPremium = useAuthStore((state) => state.setHasPremium);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSavedFacts = useFeedStore((state) => state.clearSavedFacts);
  const syncSavedFacts = useFeedStore((state) => state.syncSavedFacts);
  const hydrateDailyGoal = useOnboardingStore((state) => state.hydrateDailyGoal);
  const hydrateInterestPicker = useOnboardingStore((state) => state.hydrateInterestPicker);
  const hydrateNotificationPreference = useOnboardingStore(
    (state) => state.hydrateNotificationPreference,
  );
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  useEffect(() => {
    async function syncSessionSideEffects(userId?: string) {
      setHasPremium(await hydratePremiumEntitlement(userId));

      if (userId) {
        try {
          const prefs = await fetchUserPreferences(userId);
          hydrateDailyGoal(prefs.dailyGoal);
          hydrateInterestPicker(prefs.interests);
          hydrateNotificationPreference(prefs.notificationsEnabled);
        } catch (error) {
          console.warn('[ProfilePrefs] hydrate failed:', error);
        }

        await syncSavedFacts();
      } else {
        resetOnboarding();
        clearSavedFacts();
      }

      finishInitializing();
    }

    let isMounted = true;
    const initTimeout = setTimeout(() => {
      if (!isMounted) {
        return;
      }

      console.warn('[Auth] getSession timeout fallback triggered.');
      setSession(null);
      finishInitializing();
    }, 3500);

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!isMounted) {
        return;
      }

      clearTimeout(initTimeout);

      if (error) {
        console.error('[Auth] getSession failed:', error.message);
      }

      setSession(data.session ?? null);
      await syncSessionSideEffects(data.session?.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      void (async () => {
        await syncSessionSideEffects(session?.user?.id);
      })();
    });

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [
    clearSavedFacts,
    finishInitializing,
    hydrateDailyGoal,
    hydrateInterestPicker,
    hydrateNotificationPreference,
    resetOnboarding,
    setHasPremium,
    setSession,
    syncSavedFacts,
  ]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/callback" options={{ presentation: 'card' }} />
        <Stack.Screen name="book/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="fact/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="saved-facts" options={{ presentation: 'card' }} />
      </Stack>
      <AuthPromptModal />
      <PremiumPromptModal />
      <StatusBar style="light" backgroundColor="#000000" />
    </SafeAreaProvider>
  );
}
