import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { promptForAuth } from '../../src/lib/authPrompt';
import { registerForPushNotifications } from '../../src/lib/notifications';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { presentCustomerCenterSafe } from '../../src/lib/purchases';
import { signInWithGoogle } from '../../src/lib/socialAuth';
import { supabase } from '../../src/lib/supabase';
import { type ActivitySummary, fetchActivitySummary } from '../../src/lib/userActivity';
import type { DailyGoalPreference } from '../../src/lib/userPreferences';
import {
  updateNotificationPreference,
  updateUserDailyGoal,
  updateUserInterests,
} from '../../src/lib/userPreferences';
import { useAuthStore } from '../../src/store/authStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';

const WEEK_DAYS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];
const INTEREST_OPTIONS = ['Bilim', 'Tarih', 'Felsefe', 'Teknoloji', 'Saglik', 'Psikoloji'];
const DAILY_GOAL_OPTIONS: Exclude<DailyGoalPreference, null>[] = [
  { type: 'facts', value: 3 },
  { type: 'facts', value: 5 },
];

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

  const completeDailyGoal = useOnboardingStore((state) => state.completeDailyGoal);
  const completeInterestPicker = useOnboardingStore((state) => state.completeInterestPicker);
  const dailyGoal = useOnboardingStore((state) => state.dailyGoal);
  const notificationsEnabled = useOnboardingStore((state) => state.notificationsEnabled);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const selectedInterests = useOnboardingStore((state) => state.selectedInterests);
  const setDailyGoal = useOnboardingStore((state) => state.setDailyGoal);
  const setNotificationsEnabled = useOnboardingStore((state) => state.setNotificationsEnabled);
  const setSelectedInterests = useOnboardingStore((state) => state.setSelectedInterests);
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSavingDailyGoal, setIsSavingDailyGoal] = useState(false);
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);
  const [isEditingInterests, setIsEditingInterests] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const interestsBackup = useRef<string[]>([]);
  const dailyGoalBackup = useRef<DailyGoalPreference>(null);

  const cancelInterestEdit = useCallback(() => {
    const backup = interestsBackup.current;
    const current = useOnboardingStore.getState().selectedInterests;
    if (JSON.stringify(backup) !== JSON.stringify(current)) {
      setSelectedInterests(backup);
    }
    setIsEditingInterests(false);
  }, [setSelectedInterests]);

  const cancelDailyGoalEdit = useCallback(() => {
    const backup = dailyGoalBackup.current;
    const current = useOnboardingStore.getState().dailyGoal;
    if (backup?.type !== current?.type || backup?.value !== current?.value) {
      setDailyGoal(backup);
    }
    setIsEditingDailyGoal(false);
  }, [setDailyGoal]);

  const isLoggedIn = Boolean(user);
  const userEmail = user?.email?.trim() || 'Misafir Kullanici';
  const userInitial = userEmail.charAt(0).toUpperCase() || 'M';
  const authProvider =
    typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider : null;
  const authProviderLabel =
    authProvider === 'google'
      ? 'Google ile bagli'
      : authProvider === 'email'
        ? 'E-posta ile bagli'
        : 'Hesap baglandi';
  const dailyGoalSummary = dailyGoal ? `Her gun ${dailyGoal.value} kart` : 'Henuz hedef secilmedi';
  const todayKey = getTodayKey();
  const streakDays = activitySummary?.streakDays ?? 0;
  const bestStreakDays = activitySummary?.bestStreakDays ?? 0;
  const weeklyActivityMax = Math.max(
    dailyGoal?.value ?? 0,
    ...(activitySummary?.week.map((activity) => activity.factsRead) ?? []),
    1,
  );
  const shouldShowDailyGoalEditor = isEditingDailyGoal || !dailyGoal;
  const shouldShowInterestEditor = isEditingInterests || selectedInterests.length === 0;

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
      message: 'Premium ile reklamsiz kullanim, tum kutuphane ve serbest AI deneyimi acilir.',
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

  async function performSignOut() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signOut();
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Cikis basarisiz', error.message);
      return;
    }

    resetOnboarding();
    setAuthFeedback(null);
    Alert.alert('Tamam', 'Oturum kapatildi.');
  }

  function handleSignOut() {
    Alert.alert('Cikis yapilsin mi?', 'Bu cihazdaki oturum kapatilacak.', [
      { text: 'Vazgec', style: 'cancel' },
      { text: 'Cikis Yap', style: 'destructive', onPress: () => void performSignOut() },
    ]);
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

  async function handleSaveInterests() {
    if (!user?.id) {
      Alert.alert('Giris gerekli', 'Ilgi alanlarini kaydetmek icin once hesabini bagla.');
      return;
    }

    if (!selectedInterests.length) {
      Alert.alert('Bir alan sec', 'Devam etmeden once en az bir ilgi alani sec.');
      return;
    }

    setIsSavingInterests(true);

    try {
      await updateUserInterests(user.id, selectedInterests);
      completeInterestPicker();
      setIsEditingInterests(false);
      Alert.alert('Harika', 'Ilgi alanlarin kaydedildi.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ilgi alanlari kaydedilirken bir hata olustu.';
      Alert.alert('Kaydedilemedi', message);
    } finally {
      setIsSavingInterests(false);
    }
  }

  function isDailyGoalSelected(option: Exclude<DailyGoalPreference, null>) {
    return dailyGoal?.type === option.type && dailyGoal?.value === option.value;
  }

  async function handleSaveDailyGoal() {
    if (!user?.id) {
      Alert.alert('Giris gerekli', 'Gunluk hedefini kaydetmek icin once hesabini bagla.');
      return;
    }

    if (!dailyGoal) {
      Alert.alert('Hedef sec', 'Devam etmeden once bir gunluk hedef sec.');
      return;
    }

    setIsSavingDailyGoal(true);

    try {
      await updateUserDailyGoal(user.id, dailyGoal);
      completeDailyGoal();
      setIsEditingDailyGoal(false);
      Alert.alert('Kaydedildi', 'Gunluk hedefin profile kaydedildi.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gunluk hedef kaydedilirken bir hata olustu.';
      Alert.alert('Kaydedilemedi', message);
    } finally {
      setIsSavingDailyGoal(false);
    }
  }

  async function handleNotificationPreferencePress() {
    if (isSavingNotifications) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Giris gerekli', 'Bildirim tercihini yonetmek icin once hesabini bagla.');
      return;
    }

    const nextValue = !notificationsEnabled;
    setIsSavingNotifications(true);

    try {
      if (nextValue) {
        const registration = await registerForPushNotifications();

        if (registration.status !== 'granted') {
          setAuthFeedback({
            tone: registration.status === 'denied' ? 'error' : 'info',
            message: registration.message,
          });
          return;
        }
      }

      const savedValue = await updateNotificationPreference(user.id, nextValue);
      setNotificationsEnabled(savedValue);
      setAuthFeedback({
        tone: 'success',
        message: savedValue
          ? 'Bildirim izni hazir. Hatirlatma saati ve scheduling sonraki adimda eklenecek.'
          : 'Bildirim tercihin kapatildi.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bildirim tercihi guncellenirken bir hata olustu.';
      setAuthFeedback({
        tone: 'error',
        message,
      });
    } finally {
      setIsSavingNotifications(false);
    }
  }

  return (
    <View style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}>
      <View style={[s.header, { paddingTop: topPadding + 10 }]}>
        <Text style={s.title}>Profil</Text>
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
            {!isLoggedIn ? (
              <Text style={s.guestHint}>Hesabini bagla</Text>
            ) : null}
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
                <Text style={[s.streakNumber, !isLoggedIn && s.streakNumberGuest]}>{streakDays}</Text>
                <Text style={[s.streakNumberLabel, !isLoggedIn && s.streakNumberLabelGuest]}>Gun</Text>
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

            <TouchableOpacity
              style={[s.emailAuthButton]}
              onPress={() => setShowEmailForm(!showEmailForm)}
              activeOpacity={0.85}
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
                />

                <View style={s.inlineActions}>
                  <TouchableOpacity
                    style={[s.primaryButton, s.inlineButton]}
                    onPress={() => void handleSignIn()}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
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

        {isLoggedIn ? (
          <View style={s.interestsSection}>
            <Text style={s.sectionHeading}>Ilgi Alanlari</Text>
            <View style={s.chipWrap}>
              {shouldShowInterestEditor ? (
                INTEREST_OPTIONS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[s.chip, isSelected && s.chipSelected]}
                      onPress={() => toggleInterest(interest)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, isSelected && s.chipTextSelected]}>
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                selectedInterests.map((interest) => (
                  <View key={interest} style={s.chip}>
                    <Text style={s.chipText}>{interest}</Text>
                  </View>
                ))
              )}
              {!shouldShowInterestEditor ? (
                <TouchableOpacity
                  onPress={() => {
                    interestsBackup.current = [...selectedInterests];
                    setIsEditingInterests(true);
                  }}
                  style={s.editChip}
                  activeOpacity={0.85}
                >
                  <Text style={s.editChipText}>Duzenle</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {shouldShowInterestEditor ? (
              <View style={s.editorActions}>
                <TouchableOpacity
                  style={[s.editorCancelButton]}
                  onPress={cancelInterestEdit}
                  activeOpacity={0.85}
                >
                  <Text style={s.editorCancelText}>Vazgec</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.primaryButton,
                    { flex: 1 },
                    (!selectedInterests.length || isSavingInterests) && s.buttonDisabled,
                  ]}
                  onPress={() => void handleSaveInterests()}
                  activeOpacity={0.85}
                  disabled={!selectedInterests.length || isSavingInterests}
                >
                  <Text style={s.primaryButtonText}>
                    {isSavingInterests ? 'Kaydediliyor...' : 'Kaydet'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {isLoggedIn && shouldShowDailyGoalEditor ? (
          <View style={s.interestsSection}>
            <Text style={s.sectionHeading}>Gunluk Hedef</Text>
            <View style={s.chipWrap}>
              {DAILY_GOAL_OPTIONS.map((option) => {
                const label = `${option.value} kart`;
                const isSelected = isDailyGoalSelected(option);
                return (
                  <TouchableOpacity
                    key={`${option.type}-${option.value}`}
                    style={[s.chip, isSelected && s.chipSelected]}
                    onPress={() => setDailyGoal(option)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, isSelected && s.chipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.editorActions}>
              <TouchableOpacity
                style={[s.editorCancelButton]}
                onPress={cancelDailyGoalEdit}
                activeOpacity={0.85}
              >
                <Text style={s.editorCancelText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryButton, { flex: 1 }, (!dailyGoal || isSavingDailyGoal) && s.buttonDisabled]}
                onPress={() => void handleSaveDailyGoal()}
                activeOpacity={0.85}
                disabled={!dailyGoal || isSavingDailyGoal}
              >
                <Text style={s.primaryButtonText}>
                  {isSavingDailyGoal ? 'Kaydediliyor...' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={s.settingsSection}>
          <Text style={s.sectionHeading}>Ayarlar</Text>
          <View style={s.settingsCard}>
            <TouchableOpacity style={s.settingsRow} onPress={handlePremiumPress} activeOpacity={0.8}>
              <View style={s.settingsIconWrap}>
                <Ionicons name="star-outline" size={18} color="#f5b942" />
              </View>
              <Text style={s.settingsLabel}>Premium</Text>
              <Text style={s.settingsValue}>
                {hasPremium ? 'Aktif' : isLoggedIn ? 'Yukselt' : 'Kesfet'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#4b5563" />
            </TouchableOpacity>

            <View style={s.settingsDivider} />

            {isLoggedIn ? (
              <>
                <TouchableOpacity
                  style={s.settingsRow}
                  onPress={() => {
                    dailyGoalBackup.current = dailyGoal;
                    setIsEditingDailyGoal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.settingsIconWrap}>
                    <Ionicons name="flag-outline" size={18} color="#a78bfa" />
                  </View>
                  <Text style={s.settingsLabel}>Gunluk Hedef</Text>
                  <Text style={s.settingsValue}>{dailyGoalSummary}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#4b5563" />
                </TouchableOpacity>

                <View style={s.settingsDivider} />

                <TouchableOpacity
                  style={s.settingsRow}
                  onPress={() => void handleNotificationPreferencePress()}
                  activeOpacity={0.8}
                  disabled={isSavingNotifications}
                >
                  <View style={s.settingsIconWrap}>
                    <Ionicons name="notifications-outline" size={18} color="#a78bfa" />
                  </View>
                  <Text style={s.settingsLabel}>Bildirimler</Text>
                  <Text style={s.settingsValue}>{notificationsEnabled ? 'Acik' : 'Kapali'}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#4b5563" />
                </TouchableOpacity>
              </>
            ) : null}

            {isLoggedIn ? (
              <>
                <View style={s.settingsDivider} />
                <TouchableOpacity style={s.settingsRow} onPress={handleSignOut} activeOpacity={0.8}>
                  <View style={s.settingsIconWrap}>
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                  </View>
                  <Text style={s.settingsLabelDanger}>Cikis Yap</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(239,68,68,0.4)" />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { paddingBottom: 12, paddingHorizontal: 20, backgroundColor: '#0D0D0D' },
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
  name: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  emailText: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
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
  planText: { color: '#a78bfa', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
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

  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sectionText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20, marginBottom: 14 },

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
  dividerText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 10,
  },

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

  preferenceSection: { gap: 12 },
  preferenceHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  preferenceHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 16,
  },
  preferenceTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  preferenceHelp: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#111827',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  chipText: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#c4b5fd' },
  editChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editChipText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editorCancelText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  interestsSection: {
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 12,
  },
  sectionHeading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  inlinePreferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillOn: { backgroundColor: 'rgba(48,209,88,0.16)' },
  statusPillOff: { backgroundColor: 'rgba(142,142,147,0.16)' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statusPillTextOn: { color: '#30d158' },
  statusPillTextOff: { color: '#8e8e93' },
  smallEditButton: {
    backgroundColor: '#111827',
    borderColor: 'rgba(167,139,250,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallEditButtonText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '800',
  },

  settingsSection: {
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 12,
  },
  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 48,
  },
  settingsIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  settingsLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  settingsLabelDanger: {
    flex: 1,
    color: 'rgba(239,68,68,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  settingsValue: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },

  webHiddenScreen: { display: 'none' },
});
