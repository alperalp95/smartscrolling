import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { presentCustomerCenterSafe } from '../../src/lib/purchases';
import { signInWithGoogle } from '../../src/lib/socialAuth';
import { supabase } from '../../src/lib/supabase';
import type { DailyGoalPreference } from '../../src/lib/userPreferences';
import {
  updateNotificationPreference,
  updateUserDailyGoal,
  updateUserInterests,
} from '../../src/lib/userPreferences';
import { useAuthStore } from '../../src/store/authStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';

const WEEK_DAYS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];
const DONE_DAYS = [0, 1, 2, 3, 4, 5, 6];
const INTEREST_OPTIONS = ['Bilim', 'Tarih', 'Felsefe', 'Teknoloji', 'Saglik', 'Psikoloji'];
const DAILY_GOAL_OPTIONS: Exclude<DailyGoalPreference, null>[] = [
  { type: 'facts', value: 3 },
  { type: 'facts', value: 5 },
  { type: 'minutes', value: 10 },
];

type AuthFeedback = {
  message: string;
  tone: 'error' | 'info' | 'success';
} | null;

type ManagementItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const BASE_MANAGEMENT_ITEMS: ManagementItem[] = [
  { label: 'Premium', icon: 'star-outline' },
  { label: 'Gorunum', icon: 'moon-outline' },
  { label: 'Dil', icon: 'language-outline' },
];

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
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSavingDailyGoal, setIsSavingDailyGoal] = useState(false);
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback>(null);

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
  const dailyGoalSummary = dailyGoal
    ? dailyGoal.type === 'facts'
      ? `Her gun ${dailyGoal.value} kart`
      : `Her gun ${dailyGoal.value} dakika`
    : 'Henuz hedef secilmedi';

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
    if (!user?.id) {
      Alert.alert('Giris gerekli', 'Bildirim tercihini yonetmek icin once hesabini bagla.');
      return;
    }

    const nextValue = !notificationsEnabled;

    try {
      const savedValue = await updateNotificationPreference(user.id, nextValue);
      setNotificationsEnabled(savedValue);
      setAuthFeedback({
        tone: 'success',
        message: savedValue
          ? 'Bildirim tercihin acildi. Gercek izin ve saat secimi daha sonra eklenecek.'
          : 'Bildirim tercihin kapatildi.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bildirim tercihi guncellenirken bir hata olustu.';
      setAuthFeedback({
        tone: 'error',
        message,
      });
    }
  }

  const managementItems = [...BASE_MANAGEMENT_ITEMS];
  if (isLoggedIn) {
    managementItems.push({ label: 'Cikis Yap', icon: 'log-out-outline' });
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
          <View style={s.heroTopRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{userInitial}</Text>
            </View>
            <View style={s.heroContent}>
              <Text style={s.name} numberOfLines={1}>
                {userEmail}
              </Text>
              <View style={[s.planBadge, hasPremium && s.planBadgePremium]}>
                <Ionicons
                  name={hasPremium ? 'star' : 'flash-outline'}
                  size={11}
                  color={hasPremium ? '#f5b942' : '#a78bfa'}
                />
                <Text style={[s.planText, hasPremium && s.planTextPremium]}>
                  {hasPremium ? 'Premium Aktif' : isLoggedIn ? 'Ucretsiz Plan' : 'Misafir Modu'}
                </Text>
              </View>
              {isLoggedIn ? (
                <View style={s.providerPill}>
                  <Ionicons
                    name={authProvider === 'google' ? 'logo-google' : 'mail-outline'}
                    size={12}
                    color="#c4b5fd"
                  />
                  <Text style={s.providerPillText}>{authProviderLabel}</Text>
                </View>
              ) : (
                <Text style={s.guestHint}>
                  Kayitlarini ve ilerlemeni korumak icin asagidan hesabinla devam edebilirsin.
                </Text>
              )}
            </View>
          </View>

          <View style={s.summaryRow}>
            <View style={s.summaryBlock}>
              <Text style={s.summaryValue}>7</Text>
              <Text style={s.summaryLabel}>Gunluk seri</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryBlock}>
              <Text style={s.summaryValue}>{dailyGoal ? dailyGoal.value : '-'}</Text>
              <Text style={s.summaryLabel}>{dailyGoal ? dailyGoalSummary : 'Gunluk hedef'}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryBlock}>
              <Text style={s.summaryValue}>{notificationsEnabled ? 'Acik' : 'Kapali'}</Text>
              <Text style={s.summaryLabel}>Bildirimler</Text>
            </View>
          </View>

          <View style={s.weekRow}>
            {WEEK_DAYS.map((day, i) => (
              <View key={day} style={s.dayCol}>
                <View
                  style={[
                    s.dayDot,
                    DONE_DAYS.includes(i) && (i === 6 ? s.dayDotToday : s.dayDotDone),
                  ]}
                />
                <Text style={s.dayLabel}>{day}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.heroAction} onPress={handlePremiumPress} activeOpacity={0.85}>
            <Text style={s.heroActionText}>
              {hasPremium
                ? 'Uyeligimi Yonet'
                : isLoggedIn
                  ? "Premium'u Incele"
                  : 'Premium icin giris yap'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isLoggedIn ? (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Hesabini Bagla</Text>
            <Text style={s.sectionText}>
              Kaydettiklerin, okuma ilerlemen ve AI gecmisin cihazlar arasinda senkronize olsun.
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
              style={[s.primaryButton, isSubmitting && s.buttonDisabled]}
              onPress={() => void handleGoogleSignIn()}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Ionicons name="logo-google" size={16} color="#fff" />
              <Text style={s.primaryButtonText}>
                {isSubmitting ? 'Bekleyin...' : 'Google ile Devam Et'}
              </Text>
            </TouchableOpacity>

            <Text style={s.dividerText}>veya e-posta ile</Text>

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
          </View>
        ) : (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Sana Gore Ayarla</Text>
            <Text style={s.sectionText}>
              Kucuk tercihleri burada yonet. Davranisi degistirmeden, deneyimi sana gore
              sekillendirecegiz.
            </Text>

            <View style={s.preferenceSection}>
              <Text style={s.preferenceTitle}>Ilgi Alanlari</Text>
              <Text style={s.preferenceHelp}>En fazla 3 alan sec.</Text>
              <View style={s.chipWrap}>
                {INTEREST_OPTIONS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[s.chip, isSelected && s.chipSelected]}
                      onPress={() => toggleInterest(interest)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, isSelected && s.chipTextSelected]}>{interest}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  s.primaryButton,
                  (!selectedInterests.length || isSavingInterests) && s.buttonDisabled,
                ]}
                onPress={() => void handleSaveInterests()}
                activeOpacity={0.85}
                disabled={!selectedInterests.length || isSavingInterests}
              >
                <Text style={s.primaryButtonText}>
                  {isSavingInterests ? 'Kaydediliyor...' : 'Ilgi Alanlarini Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.preferenceDivider} />

            <View style={s.preferenceSection}>
              <Text style={s.preferenceTitle}>Gunluk Hedef</Text>
              <Text style={s.preferenceHelp}>{dailyGoalSummary}</Text>
              <View style={s.chipWrap}>
                {DAILY_GOAL_OPTIONS.map((option) => {
                  const label =
                    option.type === 'facts' ? `${option.value} kart` : `${option.value} dakika`;
                  const isSelected = isDailyGoalSelected(option);

                  return (
                    <TouchableOpacity
                      key={`${option.type}-${option.value}`}
                      style={[s.chip, isSelected && s.chipSelected]}
                      onPress={() => setDailyGoal(option)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, isSelected && s.chipTextSelected]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[s.primaryButton, (!dailyGoal || isSavingDailyGoal) && s.buttonDisabled]}
                onPress={() => void handleSaveDailyGoal()}
                activeOpacity={0.85}
                disabled={!dailyGoal || isSavingDailyGoal}
              >
                <Text style={s.primaryButtonText}>
                  {isSavingDailyGoal ? 'Kaydediliyor...' : 'Gunluk Hedefi Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.preferenceDivider} />

            <TouchableOpacity
              style={s.inlinePreferenceRow}
              onPress={() => void handleNotificationPreferencePress()}
              activeOpacity={0.85}
            >
              <View>
                <Text style={s.preferenceTitle}>Bildirimler</Text>
                <Text style={s.preferenceHelp}>
                  Istersen simdilik tercihini ac; izin ve saat secimi daha sonra gelecek.
                </Text>
              </View>
              <View style={[s.statusPill, notificationsEnabled ? s.statusPillOn : s.statusPillOff]}>
                <Text
                  style={[
                    s.statusPillText,
                    notificationsEnabled ? s.statusPillTextOn : s.statusPillTextOff,
                  ]}
                >
                  {notificationsEnabled ? 'Acik' : 'Kapali'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Yonetim</Text>
          <Text style={s.sectionText}>Hesap ve uygulama tercihlerini buradan yonetebilirsin.</Text>

          {managementItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[s.managementRow, index < managementItems.length - 1 && s.managementBorder]}
              activeOpacity={0.8}
              onPress={
                item.label === 'Premium'
                  ? handlePremiumPress
                  : item.label === 'Cikis Yap'
                    ? handleSignOut
                    : undefined
              }
            >
              <View style={s.managementIcon}>
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={item.label === 'Premium' ? '#f5b942' : '#c4b5fd'}
                />
              </View>
              <Text style={s.managementLabel}>{item.label}</Text>
              {item.label === 'Premium' ? (
                <Text style={s.managementValue}>
                  {hasPremium ? 'Aktif' : isLoggedIn ? 'Yukselt' : 'Giris gerekli'}
                </Text>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color="#3a3a3c" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingBottom: 12, paddingHorizontal: 20, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { paddingTop: 8 },

  heroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroContent: { flex: 1 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  planBadgePremium: { backgroundColor: 'rgba(245,185,66,0.14)' },
  planText: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
  planTextPremium: { color: '#f5b942' },
  providerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  providerPillText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  guestHint: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginTop: 8 },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#0b1120',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  summaryBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  summaryValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayCol: { alignItems: 'center', gap: 5 },
  dayDot: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#2a2a2c' },
  dayDotDone: { backgroundColor: '#ff9f0a' },
  dayDotToday: {
    backgroundColor: '#ff9f0a',
    shadowColor: '#ff9f0a',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  dayLabel: { color: '#6b7280', fontSize: 10, fontWeight: '500' },
  heroAction: {
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },

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

  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  managementBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  managementIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  managementLabel: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
  managementValue: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },

  webHiddenScreen: { display: 'none' },
});
