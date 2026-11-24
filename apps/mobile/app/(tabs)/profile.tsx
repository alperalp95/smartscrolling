import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../components/ui/icon-button';
import { promptForAuth } from '../../src/lib/authPrompt';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { presentCustomerCenterSafe } from '../../src/lib/purchases';
import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '../../src/lib/socialAuth';
import { supabase } from '../../src/lib/supabase';
import { type ActivitySummary, fetchActivitySummary } from '../../src/lib/userActivity';
import { useAuthStore } from '../../src/store/authStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';

const WEEK_DAYS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];

type AuthFeedback = {
  message: string;
  tone: 'error' | 'info' | 'success';
} | null;

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topPadding = Math.max(insets.top, Platform.OS === 'web' ? 24 : 0);

  const isInitializing = useAuthStore((state) => state.isInitializing);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const user = useAuthStore((state) => state.user);

  const dailyGoal = useOnboardingStore((state) => state.dailyGoal);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canUseAppleSignIn, setCanUseAppleSignIn] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const isLoggedIn = Boolean(user);
  const userEmail = user?.email?.trim() || 'Misafir Kullanici';
  const userInitial = userEmail.charAt(0).toUpperCase() || 'M';
  const authProvider =
    typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider : null;
  const authProviderLabel =
    authProvider === 'google'
      ? 'Google ile bagli'
      : authProvider === 'apple'
        ? 'Apple ile bagli'
        : authProvider === 'email'
          ? 'E-posta ile bagli'
          : 'Hesap baglandi';
  const todayKey = getTodayKey();
  const streakDays = activitySummary?.streakDays ?? 0;
  const bestStreakDays = activitySummary?.bestStreakDays ?? 0;
  const weeklyActivityMax = Math.max(
    dailyGoal?.value ?? 0,
    ...(activitySummary?.week.map((activity) => activity.factsRead) ?? []),
    1,
  );

  useEffect(() => {
    let cancelled = false;

    if (!isFocused || !user?.id) {
      setActivitySummary(null);
      return;
    }

    void (async () => {
      const summary = await fetchActivitySummary();

      if (!cancelled) {
        setActivitySummary(summary);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, user?.id]);

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

  function showAuthNeededForPremium() {
    promptForAuth({
      title: 'Premium icin giris yap',
      message:
        'Premium planlarini gormek ve satin alma akisina gecmek icin once hesabini bagla. Profilde asagidan Google veya e-posta ile devam edebilirsin.',
      onConfirm: () =>
        setAuthFeedback({
          tone: 'info',
          message: 'Asagidaki giris alanindan hesabinla devam edebilirsin.',
        }),
    });
  }

  function handlePremiumPress() {
    if (!isLoggedIn) {
      showAuthNeededForPremium();
      return;
    }

    if (hasPremium) {
      void presentCustomerCenterSafe(user?.id);
      return;
    }

    promptForPremium({
      title: 'Premium detaylarini incele',
      message:
        'Premium ile reklamsız kullanım, kartlara günde 30 soru ve kendi sorunu yazma açılır.',
      onConfirm: () => router.push('/premium'),
    });
  }

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setAuthFeedback({
        tone: 'error',
        message: 'E-posta ve sifre alanlarini doldur.',
      });
      return;
    }

    setAuthFeedback({
      tone: 'info',
      message: 'E-posta ile giris yapiliyor...',
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
      message: 'Giris basarili. Hesabin baglandi.',
    });
  }

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      setAuthFeedback({
        tone: 'error',
        message: 'Kayit icin e-posta ve sifre gerekli.',
      });
      return;
    }

    setAuthFeedback({
      tone: 'info',
      message: 'Hesap olusturuluyor...',
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
      message: 'Hesap olusturuldu. Gerekirse e-posta dogrulamani tamamla.',
    });
  }

  async function handleGoogleSignIn() {
    setAuthFeedback({
      tone: 'info',
      message: 'Google hesabin aciliyor...',
    });
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
      setAuthFeedback({
        tone: 'success',
        message: 'Google hesabinla devam ediyoruz...',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google ile giris sirasinda bir hata olustu.';
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
      message: 'Apple hesabin aciliyor...',
    });
    setIsSubmitting(true);

    try {
      await signInWithApple();
      setAuthFeedback({
        tone: 'success',
        message: 'Apple hesabinla devam ediyoruz...',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apple ile giris sirasinda bir hata olustu.';
      setAuthFeedback({
        tone: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View
      style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}
      testID="profile-screen"
    >
      <View style={[s.header, { paddingTop: topPadding + 10 }]}>
        <Text style={s.title}>Profil</Text>
        <IconButton
          name="menu-outline"
          accessibilityLabel="Ayarlar"
          testID="profile-settings-button"
          color="#fff"
          onPress={() => router.push('/settings')}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarHeight + 16 }]}
      >
        <View style={s.heroCard}>
          <View style={s.heroSection}>
            <View style={s.avatarGlow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{userInitial}</Text>
              </View>
            </View>
            <Text style={s.name} numberOfLines={1}>
              {userEmail}
            </Text>
            {!isLoggedIn ? <Text style={s.guestHint}>Hesabini bagla</Text> : null}
            <View style={[s.planBadge, hasPremium && s.planBadgePremium]}>
              <Ionicons
                name={hasPremium ? 'star' : isLoggedIn ? 'flash-outline' : 'person-circle-outline'}
                size={13}
                color={hasPremium ? '#f5b942' : '#a78bfa'}
              />
              <Text style={[s.planText, hasPremium && s.planTextPremium]}>
                {hasPremium ? 'Premium' : isLoggedIn ? 'Ucretsiz Plan' : 'Misafir Modu'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[s.streakCard, !isLoggedIn && s.streakCardGuest]}>
          <View style={s.streakAccentBar} />
          <View style={s.streakContent}>
            <View style={s.streakLeft}>
              <View style={s.streakNumberWrap}>
                <Text style={[s.streakNumber, !isLoggedIn && s.streakNumberGuest]}>
                  {streakDays}
                </Text>
                <Text style={[s.streakNumberLabel, !isLoggedIn && s.streakNumberLabelGuest]}>
                  Gun
                </Text>
              </View>
              <View style={s.streakDivider} />
              <View>
                <Text style={s.streakTitle}>
                  {streakDays > 0 ? 'Seruven Devam Ediyor' : 'Gunluk Seri'}
                </Text>
                <Text style={s.streakSubtitle}>
                  {!isLoggedIn
                    ? 'Ilk okumani yap ve serini baslat!'
                    : streakDays > 0
                      ? `Rekor: ${bestStreakDays} gun`
                      : 'Ilk okumani yap ve serini baslat!'}
                </Text>
              </View>
            </View>
            <View style={s.streakBars}>
              {WEEK_DAYS.map((day, i) => {
                const activity = activitySummary?.week[i];
                const factsRead = activity?.factsRead ?? 0;
                const barPercent = Math.max(15, Math.round((factsRead / weeklyActivityMax) * 100));
                const isToday = activity?.date === todayKey;
                return (
                  <View
                    key={`${day}-${activity?.date ?? i}`}
                    style={[
                      s.streakBar,
                      { height: `${barPercent}%` },
                      factsRead > 0 ? s.streakBarActive : null,
                      isToday && factsRead === 0 ? s.streakBarToday : null,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.premiumLink} onPress={handlePremiumPress} activeOpacity={0.85}>
          <Text style={s.premiumLinkText}>
            {hasPremium
              ? 'Uyeligimi Yonet'
              : isLoggedIn
                ? "Premium'u Incele"
                : 'Premium icin giris yap'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#a78bfa" />
        </TouchableOpacity>

        {isLoggedIn && authFeedback ? (
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

        {!isLoggedIn ? (
          <View style={s.authCard}>
            <Text style={s.authTitle}>Hesabini Bagla</Text>
            <Text style={s.authSubtitle}>
              Ilerlemeni kaydetmek ve tum ozelliklere erismek icin giris yap.
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
                <ActivityIndicator color="#a78bfa" size="small" />
                <Text style={s.loadingText}>Oturum bilgisi kontrol ediliyor.</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.googleButton, isSubmitting && s.buttonDisabled]}
              onPress={() => void handleGoogleSignIn()}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Ionicons name="logo-google" size={16} color="#1f2937" />
              <Text style={s.googleButtonText}>
                {isSubmitting ? 'Bekleyin...' : 'Google ile Devam Et'}
              </Text>
            </TouchableOpacity>

            {canUseAppleSignIn ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={12}
                onPress={() => void handleAppleSignIn()}
                style={[s.appleButton, isSubmitting && s.appleButtonDisabled]}
              />
            ) : null}

            <TouchableOpacity
              style={[s.emailAuthButton]}
              onPress={() => setShowEmailForm(!showEmailForm)}
              activeOpacity={0.85}
              testID="auth-email-toggle"
            >
              <Text style={s.emailAuthButtonText}>
                {showEmailForm ? 'E-posta Formunu Kapat' : 'E-posta ile Giris Yap'}
              </Text>
            </TouchableOpacity>

            {showEmailForm ? (
              <>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearErrorFeedback();
                  }}
                  placeholder="E-posta"
                  placeholderTextColor="#6b7280"
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
                  placeholder="Sifre"
                  placeholderTextColor="#6b7280"
                  secureTextEntry
                  style={s.input}
                  testID="auth-password-input"
                />

                <View style={s.inlineActions}>
                  <TouchableOpacity
                    style={[s.primaryButton, s.inlineButton]}
                    onPress={() => void handleSignIn()}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
                    testID="auth-submit-button"
                  >
                    <Text style={s.primaryButtonText}>
                      {isSubmitting ? 'Bekleyin...' : 'Giris Yap'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.secondaryButton, s.inlineButton]}
                    onPress={() => void handleSignUp()}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
                  >
                    <Text style={s.secondaryButtonText}>
                      {isSubmitting ? 'Bekleyin...' : 'Kayit Ol'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#0D0D0D',
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { paddingTop: 8 },

  heroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  avatarGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.12)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: { color: '#d0bcff', fontSize: 34, fontWeight: '700' },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  planBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  planBadgePremium: {
    backgroundColor: 'rgba(245,185,66,0.1)',
    borderColor: 'rgba(245,185,66,0.3)',
  },
  planText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  planTextPremium: { color: '#f5b942' },
  guestHint: { color: '#a78bfa', fontSize: 14, textAlign: 'center' },

  streakCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  streakCardGuest: {
    opacity: 0.7,
  },
  streakAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    paddingLeft: 20,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  streakNumberWrap: {
    alignItems: 'center',
  },
  streakNumber: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 34,
  },
  streakNumberGuest: {
    color: '#6b7280',
  },
  streakNumberLabel: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakNumberLabelGuest: {
    color: '#6b7280',
  },
  streakDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  streakTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  streakSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  streakBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 32,
  },
  streakBar: {
    width: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  streakBarActive: {
    backgroundColor: '#8b5cf6',
  },
  streakBarToday: {
    backgroundColor: 'rgba(139,92,246,0.35)',
  },
  premiumLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(139,92,246,0.1)',
    marginBottom: 14,
  },
  premiumLinkText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
  },

  authCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(139,92,246,0.2)',
    gap: 12,
  },
  authTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  authSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  appleButtonDisabled: { opacity: 0.55 },
  emailAuthButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emailAuthButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  feedbackBox: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    borderWidth: 0.5,
  },
  feedbackInfo: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.24)',
  },
  feedbackError: {
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderColor: 'rgba(255,69,58,0.24)',
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(48,209,88,0.12)',
    borderColor: 'rgba(48,209,88,0.24)',
  },
  feedbackText: { color: '#f8fafc', fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  loadingText: { color: '#c4b5fd', fontSize: 14 },

  input: {
    backgroundColor: '#0b1120',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 10,
  },
  inlineActions: { flexDirection: 'row', gap: 10 },
  inlineButton: { flex: 1 },
  primaryButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.55 },

  webHiddenScreen: { display: 'none' },
});
