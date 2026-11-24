import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SavedGrid } from '../../components/profile/saved-grid';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { GradientButton } from '../../components/ui/gradient';
import { IconButton } from '../../components/ui/icon-button';
import { Screen } from '../../components/ui/screen';
import { StatBlock } from '../../components/ui/stat-block';
import { TopBar } from '../../components/ui/top-bar';
import { fetchSavedFacts } from '../../src/lib/facts';
import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '../../src/lib/socialAuth';
import { supabase } from '../../src/lib/supabase';
import {
  type ActivitySummary,
  fetchActivitySummary,
  fetchLifetimeFactsRead,
} from '../../src/lib/userActivity';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors, radius, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';

const MAX_PROFILE_GRID = 9;
const APPLE_BUTTON_HEIGHT = space.xxxl + space.md;

type AuthFeedback = {
  message: string;
  tone: 'error' | 'info' | 'success';
} | null;

export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();

  const isInitializing = useAuthStore((state) => state.isInitializing);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const user = useAuthStore((state) => state.user);
  const savedIds = useFeedStore((state) => state.savedIds);
  const savedIdsVersion = savedIds.join('|');

  const dailyGoal = useOnboardingStore((state) => state.dailyGoal);
  const selectedInterests = useOnboardingStore((state) => state.selectedInterests);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canUseAppleSignIn, setCanUseAppleSignIn] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [lifetimeFactsRead, setLifetimeFactsRead] = useState(0);
  const [savedFacts, setSavedFacts] = useState<FactType[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const isLoggedIn = Boolean(user);
  const emailPrefix = user?.email?.split('@')[0]?.trim() ?? '';
  const topBarTitle = emailPrefix || 'Profil';
  const streakDays = activitySummary?.streakDays ?? 0;
  const visibleSavedFacts = useMemo(
    () => savedFacts.filter((fact) => savedIds.includes(fact.id)),
    [savedFacts, savedIds],
  );
  const gridFacts = visibleSavedFacts.slice(0, MAX_PROFILE_GRID);
  const hasMoreSaved = visibleSavedFacts.length > MAX_PROFILE_GRID;
  const interestsText = selectedInterests.slice(0, 3).join(', ');
  const summaryParts = [
    dailyGoal?.value ? `Günlük hedef: ${dailyGoal.value} kart` : null,
    interestsText ? `İlgi: ${interestsText}` : null,
  ].filter(Boolean);

  useEffect(() => {
    let cancelled = false;

    if (!isFocused || !user?.id) {
      setActivitySummary(null);
      setLifetimeFactsRead(0);
      return;
    }

    void (async () => {
      const [summary, total] = await Promise.all([
        fetchActivitySummary(),
        fetchLifetimeFactsRead(),
      ]);

      if (!cancelled) {
        setActivitySummary(summary);
        setLifetimeFactsRead(total);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, user?.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: savedIdsVersion kayıt listesi değişince yeniden yükler
  useEffect(() => {
    let cancelled = false;

    if (!isFocused || !user?.id) {
      setSavedFacts([]);
      return;
    }

    void (async () => {
      const next = await fetchSavedFacts(user.id, 50);

      if (!cancelled) {
        setSavedFacts(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, savedIdsVersion, user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS !== 'ios') {
      setCanUseAppleSignIn(false);
      return;
    }

    void isAppleSignInAvailable().then((isAvailable) => {
      if (!cancelled) {
        setCanUseAppleSignIn(isAvailable);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function clearErrorFeedback() {
    setAuthFeedback((current) => (current?.tone === 'error' ? null : current));
  }

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setAuthFeedback({
        tone: 'error',
        message: 'E-posta ve şifre alanlarını doldur.',
      });
      return;
    }

    setAuthFeedback({
      tone: 'info',
      message: 'E-posta ile giriş yapılıyor...',
    });
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setIsSubmitting(false);

    if (error) {
      setAuthFeedback({
        tone: 'error',
        message: error.message,
      });
      return;
    }

    setAuthFeedback({
      tone: 'success',
      message: 'Giriş başarılı. Hesabın bağlandı.',
    });
  }

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      setAuthFeedback({
        tone: 'error',
        message: 'Kayıt için e-posta ve şifre gerekli.',
      });
      return;
    }

    setAuthFeedback({
      tone: 'info',
      message: 'Hesap oluşturuluyor...',
    });
    setIsSubmitting(true);

    const { error } = await supabase.auth.signUp({ email: email.trim(), password });

    setIsSubmitting(false);

    if (error) {
      setAuthFeedback({
        tone: 'error',
        message: error.message,
      });
      return;
    }

    setAuthFeedback({
      tone: 'success',
      message: 'Hesap oluşturuldu. Gerekirse e-posta doğrulamanı tamamla.',
    });
  }

  async function handleGoogleSignIn() {
    setAuthFeedback({
      tone: 'info',
      message: 'Google hesabın açılıyor...',
    });
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
      setAuthFeedback({
        tone: 'success',
        message: 'Google hesabınla devam ediyoruz...',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google ile giriş sırasında bir hata oluştu.';
      setAuthFeedback({
        tone: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    if (isSubmitting) {
      return;
    }

    setAuthFeedback({
      tone: 'info',
      message: 'Apple hesabın açılıyor...',
    });
    setIsSubmitting(true);

    try {
      await signInWithApple();
      setAuthFeedback({
        tone: 'success',
        message: 'Apple hesabınla devam ediyoruz...',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apple ile giriş sırasında bir hata oluştu.';
      setAuthFeedback({
        tone: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const authForm = (
    <View style={s.authBox}>
      <Text style={s.authTitle}>Hesabını bağla</Text>
      <Text style={s.authSubtitle}>
        İlerlemeni kaydetmek ve tüm özelliklere erişmek için giriş yap.
      </Text>

      {authFeedback ? (
        <View
          style={[
            s.feedbackBox,
            authFeedback.tone === 'error'
              ? s.feedbackError
              : authFeedback.tone === 'success'
                ? s.feedbackSuccess
                : s.feedbackInfo,
          ]}
        >
          <Text style={s.feedbackText}>{authFeedback.message}</Text>
        </View>
      ) : null}

      {isInitializing ? (
        <View style={s.loadingRow}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
          <Text style={s.loadingText}>Oturum bilgisi kontrol ediliyor.</Text>
        </View>
      ) : null}

      <Button
        label={isSubmitting ? 'Bekleyin...' : 'Google ile devam et'}
        onPress={() => void handleGoogleSignIn()}
        disabled={isSubmitting}
      />

      {canUseAppleSignIn ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          cornerRadius={radius.sm}
          onPress={() => void handleAppleSignIn()}
          style={[s.appleButton, isSubmitting && s.disabled]}
        />
      ) : null}

      <Button
        label={showEmailForm ? 'E-posta formunu kapat' : 'E-posta ile giriş yap'}
        onPress={() => setShowEmailForm(!showEmailForm)}
        testID="auth-email-toggle"
      />

      {showEmailForm ? (
        <>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearErrorFeedback();
            }}
            placeholder="E-posta"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={s.input}
            testID="auth-email-input"
          />
          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearErrorFeedback();
            }}
            placeholder="Şifre"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            style={s.input}
            testID="auth-password-input"
          />
          <GradientButton
            label={isSubmitting ? 'Bekleyin...' : 'Giriş yap'}
            onPress={() => void handleSignIn()}
            disabled={isSubmitting}
            testID="auth-submit-button"
          />
          <Button
            label={isSubmitting ? 'Bekleyin...' : 'Kayıt ol'}
            onPress={() => void handleSignUp()}
            disabled={isSubmitting}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View
        style={[s.root, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}
        testID="profile-screen"
      >
        <TopBar
          title={topBarTitle}
          right={
            <IconButton
              name="menu-outline"
              accessibilityLabel="Ayarlar"
              testID="profile-settings-button"
              onPress={() => router.push('/settings')}
            />
          }
        />

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.topRow}>
            <Avatar initial={isLoggedIn ? emailPrefix || 'P' : '?'} ring={isLoggedIn} size={72} />
            <View style={s.stats}>
              <View style={s.statCell}>
                <StatBlock value={streakDays} label="gün seri" />
              </View>
              <View style={s.statCell}>
                <StatBlock value={lifetimeFactsRead} label="kart" />
              </View>
              <View style={s.statCell}>
                <StatBlock value={savedIds.length} label="kayıtlı" />
              </View>
            </View>
          </View>

          {summaryParts.length > 0 ? (
            <Text style={s.summary}>{summaryParts.join(' · ')}</Text>
          ) : null}

          {isLoggedIn ? (
            <View style={s.buttonRow}>
              <View style={s.buttonCell}>
                <Button label="Profili düzenle" onPress={() => router.push('/settings')} />
              </View>
              <View style={s.buttonCell}>
                {hasPremium ? (
                  <Button label="Premium aktif" onPress={() => router.push('/settings')} />
                ) : (
                  <GradientButton label="Premium" onPress={() => router.push('/premium')} />
                )}
              </View>
            </View>
          ) : (
            authForm
          )}

          {isLoggedIn && authFeedback ? (
            <View style={[s.feedbackBox, s.feedbackInfo, s.feedbackOuter]}>
              <Text style={s.feedbackText}>{authFeedback.message}</Text>
            </View>
          ) : null}

          <View style={s.separator} />
          <View style={s.tabHeader}>
            <Ionicons name="grid-outline" size={22} color={colors.text} />
          </View>

          <SavedGrid
            facts={gridFacts}
            emptyText="Kaydettiğin kartlar burada görünür."
            onPressFact={(fact) => router.push(`/fact/${fact.id}` as never)}
          />
          {hasMoreSaved ? (
            <Button
              variant="ghost"
              label="Tümünü gör"
              onPress={() => router.push('/(tabs)/saved')}
            />
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  webHiddenScreen: { display: 'none' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.screen,
    paddingVertical: space.md,
  },
  stats: { flex: 1, flexDirection: 'row' },
  statCell: { flex: 1 },
  summary: {
    ...type.caption,
    color: colors.textSecondary,
    paddingHorizontal: space.screen,
    marginBottom: space.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.screen,
    marginBottom: space.lg,
  },
  buttonCell: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.separator },
  tabHeader: { alignItems: 'center', paddingVertical: space.md },

  authBox: {
    gap: space.md,
    paddingHorizontal: space.screen,
    marginBottom: space.lg,
  },
  authTitle: { ...type.screenTitle, color: colors.text },
  authSubtitle: { ...type.body, color: colors.textSecondary },
  appleButton: { height: APPLE_BUTTON_HEIGHT, width: '100%' },
  disabled: { opacity: 0.5 },
  input: {
    ...type.body,
    backgroundColor: colors.fill,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  feedbackBox: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  feedbackOuter: { marginHorizontal: space.screen, marginBottom: space.md },
  feedbackInfo: { backgroundColor: colors.fill },
  feedbackError: { backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.danger },
  feedbackSuccess: { backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.success },
  feedbackText: { ...type.caption, color: colors.text },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  loadingText: { ...type.caption, color: colors.textSecondary },
});
