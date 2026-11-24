import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DangerButton } from '../components/settings/danger-button';
import { SettingsRow } from '../components/settings/settings-row';
import { BottomSheet } from '../components/ui/bottom-sheet';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { GradientButton } from '../components/ui/gradient';
import { IconButton } from '../components/ui/icon-button';
import { Screen } from '../components/ui/screen';
import { TopBar } from '../components/ui/top-bar';
import { deleteCurrentAccount } from '../src/lib/accountDeletion';
import {
  cancelSmartScrollingScheduledNotifications,
  getLocalNotificationPermissionStatus,
  reconcileDailyLocalReminder,
  requestLocalNotificationPermission,
} from '../src/lib/notifications';
import { promptForPremium } from '../src/lib/premiumPrompt';
import { presentCustomerCenterSafe } from '../src/lib/purchases';
import {
  disableCurrentExpoPushToken,
  disableUserPushTokens,
  refreshCurrentExpoPushTokenIfPermissionGranted,
  upsertCurrentExpoPushToken,
} from '../src/lib/pushTokens';
import { supabase } from '../src/lib/supabase';
import { fetchActivitySummary } from '../src/lib/userActivity';
import type { DailyGoalPreference } from '../src/lib/userPreferences';
import {
  updateNotificationPreference,
  updateNotificationTimePreference,
  updateUserDailyGoal,
  updateUserInterests,
} from '../src/lib/userPreferences';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { colors, radius, space, type } from '../src/theme';

// Not: bu değerler veritabanında saklanan kimliklerdir, yazımları değiştirilmemeli.
const INTEREST_OPTIONS = ['Bilim', 'Tarih', 'Felsefe', 'Teknoloji', 'Saglik', 'Psikoloji'];
const DAILY_GOAL_OPTIONS: Exclude<DailyGoalPreference, null>[] = [
  { type: 'facts', value: 3 },
  { type: 'facts', value: 5 },
];
const NOTIFICATION_HOUR_OPTIONS = [18, 19, 20, 21, 22];

type Feedback = { message: string; tone: 'error' | 'info' | 'success' } | null;

export default function SettingsScreen() {
  const router = useRouter();

  const hasPremium = useAuthStore((state) => state.hasPremium);
  const user = useAuthStore((state) => state.user);

  const completeDailyGoal = useOnboardingStore((state) => state.completeDailyGoal);
  const completeInterestPicker = useOnboardingStore((state) => state.completeInterestPicker);
  const dailyGoal = useOnboardingStore((state) => state.dailyGoal);
  const notificationsEnabled = useOnboardingStore((state) => state.notificationsEnabled);
  const notificationTime = useOnboardingStore((state) => state.notificationTime);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const selectedInterests = useOnboardingStore((state) => state.selectedInterests);
  const setDailyGoal = useOnboardingStore((state) => state.setDailyGoal);
  const setNotificationsEnabled = useOnboardingStore((state) => state.setNotificationsEnabled);
  const setNotificationTime = useOnboardingStore((state) => state.setNotificationTime);
  const setSelectedInterests = useOnboardingStore((state) => state.setSelectedInterests);
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSavingDailyGoal, setIsSavingDailyGoal] = useState(false);
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);
  const [isEditingInterests, setIsEditingInterests] = useState(false);
  const [isTimeSheetVisible, setIsTimeSheetVisible] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const interestsBackup = useRef<string[]>([]);
  const dailyGoalBackup = useRef<DailyGoalPreference>(null);
  const notificationPermissionWasRevokedRef = useRef(false);

  const isLoggedIn = Boolean(user);
  const dailyGoalSummary = dailyGoal ? `Her gün ${dailyGoal.value} kart` : 'Seçilmedi';
  const interestsSummary = selectedInterests.length
    ? `${selectedInterests.length} alan`
    : 'Seçilmedi';
  const notificationTimeSummary = `${String(notificationTime.hour).padStart(2, '0')}:00`;

  useEffect(() => {
    let cancelled = false;

    if (!user?.id || !notificationsEnabled) {
      return;
    }

    void (async () => {
      const permission = await getLocalNotificationPermissionStatus();

      if (cancelled) {
        return;
      }

      if (permission.status === 'granted') {
        notificationPermissionWasRevokedRef.current = false;
        void refreshCurrentExpoPushTokenIfPermissionGranted(user.id);
        return;
      }

      if (permission.status === 'unsupported' || permission.status === 'error') {
        setFeedback({
          tone: permission.status === 'error' ? 'error' : 'info',
          message: permission.message,
        });
        return;
      }

      try {
        notificationPermissionWasRevokedRef.current = true;
        await updateNotificationPreference(user.id, false);
        await cancelSmartScrollingScheduledNotifications();
        await disableUserPushTokens(user.id);

        if (cancelled) {
          return;
        }

        setNotificationsEnabled(false);
        setIsTimeSheetVisible(false);
        setFeedback({
          tone: 'info',
          message: `${permission.message} Bildirim tercihin kapatıldı.`,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Bildirim izin durumu eşlenirken bir hata oluştu.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notificationsEnabled, setNotificationsEnabled, user?.id]);

  function handlePremiumPress() {
    if (hasPremium) {
      void presentCustomerCenterSafe(user?.id);
      return;
    }

    promptForPremium({
      title: 'Premium detaylarını incele',
      message:
        'Premium ile reklamsız kullanım, kartlara günde 30 soru ve kendi sorunu yazma açılır.',
      onConfirm: () => router.push('/premium'),
    });
  }

  async function performSignOut() {
    if (user?.id) {
      await disableCurrentExpoPushToken(user.id);
    }
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Çıkış başarısız', error.message);
      return;
    }

    resetOnboarding();
    setFeedback(null);
    Alert.alert('Tamam', 'Oturum kapatıldı.');
    router.back();
  }

  function handleSignOut() {
    Alert.alert('Çıkış yapılsın mı?', 'Bu cihazdaki oturum kapatılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => void performSignOut() },
    ]);
  }

  function closeDeleteConfirm() {
    if (isDeletingAccount) {
      return;
    }
    setDeleteConfirmationText('');
    setIsDeleteConfirmVisible(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmationText.trim() !== 'SIL') {
      Alert.alert('Onay gerekli', 'Hesabı silmek için kutuya SIL yaz.');
      return;
    }

    setIsDeletingAccount(true);

    const result = await deleteCurrentAccount();

    setIsDeletingAccount(false);

    if (!result.ok) {
      Alert.alert('Hesap silinemedi', result.message);
      return;
    }

    resetOnboarding();
    setFeedback(null);
    setDeleteConfirmationText('');
    setIsDeleteConfirmVisible(false);
    Alert.alert('Tamam', 'Hesabın ve verilerin silindi.');
    router.back();
  }

  function openInterestEditor() {
    interestsBackup.current = [...selectedInterests];
    setIsEditingInterests(true);
  }

  function cancelInterestEdit() {
    const backup = interestsBackup.current;
    const current = useOnboardingStore.getState().selectedInterests;
    if (JSON.stringify(backup) !== JSON.stringify(current)) {
      setSelectedInterests(backup);
    }
    setIsEditingInterests(false);
  }

  async function handleSaveInterests() {
    if (!user?.id) {
      Alert.alert('Giriş gerekli', 'İlgi alanlarını kaydetmek için önce hesabını bağla.');
      return;
    }

    if (!selectedInterests.length) {
      Alert.alert('Bir alan seç', 'Devam etmeden önce en az bir ilgi alanı seç.');
      return;
    }

    setIsSavingInterests(true);

    try {
      await updateUserInterests(user.id, selectedInterests);
      completeInterestPicker();
      setIsEditingInterests(false);
      Alert.alert('Harika', 'İlgi alanların kaydedildi.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'İlgi alanları kaydedilirken bir hata oluştu.';
      Alert.alert('Kaydedilemedi', message);
    } finally {
      setIsSavingInterests(false);
    }
  }

  function openDailyGoalEditor() {
    dailyGoalBackup.current = dailyGoal;
    setIsEditingDailyGoal(true);
  }

  function cancelDailyGoalEdit() {
    const backup = dailyGoalBackup.current;
    const current = useOnboardingStore.getState().dailyGoal;
    if (backup?.type !== current?.type || backup?.value !== current?.value) {
      setDailyGoal(backup);
    }
    setIsEditingDailyGoal(false);
  }

  function isDailyGoalSelected(option: Exclude<DailyGoalPreference, null>) {
    return dailyGoal?.type === option.type && dailyGoal?.value === option.value;
  }

  async function reconcileNotificationSchedule(enabled = notificationsEnabled) {
    if (!enabled) {
      return cancelSmartScrollingScheduledNotifications();
    }

    const summary = user?.id ? await fetchActivitySummary() : null;

    return reconcileDailyLocalReminder({
      dailyGoalValue: dailyGoal?.value ?? null,
      enabled,
      hour: notificationTime.hour,
      isStreakAtRiskToday: summary?.isStreakAtRiskToday ?? false,
      minute: notificationTime.minute,
      todayFactsRead: summary?.today.factsRead ?? 0,
    });
  }

  async function handleSaveDailyGoal() {
    if (!user?.id) {
      Alert.alert('Giriş gerekli', 'Günlük hedefini kaydetmek için önce hesabını bağla.');
      return;
    }

    if (!dailyGoal) {
      Alert.alert('Hedef seç', 'Devam etmeden önce bir günlük hedef seç.');
      return;
    }

    setIsSavingDailyGoal(true);

    try {
      await updateUserDailyGoal(user.id, dailyGoal);
      completeDailyGoal();
      setIsEditingDailyGoal(false);
      if (notificationsEnabled) {
        await reconcileNotificationSchedule(true);
      }
      Alert.alert('Kaydedildi', 'Günlük hedefin profile kaydedildi.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Günlük hedef kaydedilirken bir hata oluştu.';
      Alert.alert('Kaydedilemedi', message);
    } finally {
      setIsSavingDailyGoal(false);
    }
  }

  async function enableNotifications(userId: string) {
    setIsSavingNotifications(true);

    try {
      const shouldUseSettingsGuidance = notificationPermissionWasRevokedRef.current;
      const permission = shouldUseSettingsGuidance
        ? await getLocalNotificationPermissionStatus()
        : await requestLocalNotificationPermission();

      if (permission.status !== 'granted') {
        const permissionMessage = shouldUseSettingsGuidance
          ? 'Bildirimler sistem ayarlarından kapalı. Devam etmek için Android App Info > Notifications ayarını aç.'
          : permission.message;
        setNotificationsEnabled(false);
        setIsTimeSheetVisible(false);
        setFeedback({
          tone:
            permission.status === 'denied' || permission.status === 'blocked' ? 'error' : 'info',
          message: permissionMessage,
        });

        if (permission.status === 'blocked' || shouldUseSettingsGuidance) {
          Alert.alert('Bildirimler sistemden kapalı', permissionMessage, [
            { text: 'Tamam', style: 'cancel' },
            { text: 'Ayarlar', onPress: () => void Linking.openSettings() },
          ]);
        }
        return;
      }

      notificationPermissionWasRevokedRef.current = false;
      const savedValue = await updateNotificationPreference(userId, true);
      setNotificationsEnabled(savedValue);
      setIsTimeSheetVisible(false);
      const scheduleResult = await reconcileNotificationSchedule(savedValue);
      const tokenResult = await upsertCurrentExpoPushToken(userId);
      const tokenMessage =
        tokenResult.status === 'saved'
          ? tokenResult.message
          : `Remote push: ${tokenResult.message}`;
      setFeedback({
        tone:
          scheduleResult.status === 'error'
            ? 'error'
            : tokenResult.status === 'error'
              ? 'info'
              : 'success',
        message: `${notificationTimeSummary} hatırlatıcısı hazır. ${scheduleResult.message} ${tokenMessage}`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Bildirim tercihi güncellenirken bir hata oluştu.',
      });
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function disableNotifications(userId: string) {
    setIsSavingNotifications(true);

    try {
      const savedValue = await updateNotificationPreference(userId, false);
      setNotificationsEnabled(savedValue);
      setIsTimeSheetVisible(false);
      const cancelResult = await cancelSmartScrollingScheduledNotifications();
      await disableUserPushTokens(userId);
      setFeedback({
        tone: cancelResult.status === 'error' ? 'error' : 'success',
        message: 'Bildirim tercihin kapatıldı ve bekleyen hatırlatıcılar temizlendi.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Bildirim tercihi güncellenirken bir hata oluştu.',
      });
    } finally {
      setIsSavingNotifications(false);
    }
  }

  function handleNotificationSwitch(next: boolean) {
    if (isSavingNotifications) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Giriş gerekli', 'Bildirim tercihini yönetmek için önce hesabını bağla.');
      return;
    }

    void (next ? enableNotifications(user.id) : disableNotifications(user.id));
  }

  async function handleNotificationHourPress(hour: number) {
    if (isSavingNotifications) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Giriş gerekli', 'Bildirim saatini yönetmek için önce hesabını bağla.');
      return;
    }

    if (hour === notificationTime.hour) {
      setIsTimeSheetVisible(false);
      return;
    }

    setIsSavingNotifications(true);

    try {
      const savedTime = await updateNotificationTimePreference(user.id, { hour, minute: 0 });
      setNotificationTime(savedTime);
      setIsTimeSheetVisible(false);

      const summary = await fetchActivitySummary();
      const scheduleResult = await reconcileDailyLocalReminder({
        dailyGoalValue: dailyGoal?.value ?? null,
        enabled: notificationsEnabled,
        hour: savedTime.hour,
        isStreakAtRiskToday: summary?.isStreakAtRiskToday ?? false,
        minute: savedTime.minute,
        todayFactsRead: summary?.today.factsRead ?? 0,
      });

      setFeedback({
        tone: scheduleResult.status === 'error' ? 'error' : 'success',
        message: `Bildirim saati ${String(savedTime.hour).padStart(2, '0')}:00 olarak kaydedildi. ${scheduleResult.message}`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Bildirim saati kaydedilirken bir hata oluştu.',
      });
    } finally {
      setIsSavingNotifications(false);
    }
  }

  return (
    <Screen>
      <View style={s.root} testID="settings-screen">
        <TopBar
          title="Ayarlar"
          left={
            <IconButton
              name="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Geri"
              testID="settings-back"
            />
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {feedback ? (
            <Text
              style={[s.feedback, feedback.tone === 'error' && s.feedbackError]}
              testID="settings-feedback"
            >
              {feedback.message}
            </Text>
          ) : null}

          {!isLoggedIn ? (
            <SettingsRow
              icon="person-circle-outline"
              title="Hesabını bağla"
              onPress={() => router.back()}
              testID="settings-connect-account"
            />
          ) : null}

          <Text style={s.sectionTitle}>Tercihler</Text>
          {isLoggedIn ? (
            <>
              <SettingsRow
                icon="heart-outline"
                title="İlgi alanları"
                value={interestsSummary}
                onPress={openInterestEditor}
                testID="settings-interests"
              />
              <SettingsRow
                icon="flag-outline"
                title="Günlük hedef"
                value={dailyGoalSummary}
                onPress={openDailyGoalEditor}
                testID="settings-daily-goal"
              />
            </>
          ) : null}
          <SettingsRow
            icon="notifications-outline"
            title="Bildirimler"
            switchValue={notificationsEnabled}
            onSwitchChange={handleNotificationSwitch}
            disabled={isSavingNotifications}
            testID="settings-notifications"
          />
          {notificationsEnabled ? (
            <SettingsRow
              icon="time-outline"
              title="Hatırlatma saati"
              value={notificationTimeSummary}
              onPress={() => setIsTimeSheetVisible(true)}
              disabled={isSavingNotifications}
              testID="settings-notification-time"
            />
          ) : null}

          {isLoggedIn ? (
            <>
              <Text style={s.sectionTitle}>Hesap</Text>
              <SettingsRow
                icon="sparkles-outline"
                title="Premium"
                value={hasPremium ? 'Aktif' : undefined}
                onPress={handlePremiumPress}
                testID="settings-premium"
              />
              <SettingsRow
                icon="log-out-outline"
                title="Çıkış yap"
                onPress={handleSignOut}
                testID="settings-sign-out"
              />
              <View style={s.dangerGap} />
              <SettingsRow
                icon="trash-outline"
                title="Hesabımı ve verilerimi sil"
                danger
                disabled={isDeletingAccount}
                onPress={() => setIsDeleteConfirmVisible(true)}
                testID="account-delete-entry"
              />
            </>
          ) : null}
        </ScrollView>
      </View>

      <BottomSheet
        visible={isEditingInterests}
        onClose={cancelInterestEdit}
        title="İlgi alanları"
        testID="settings-interests-sheet"
      >
        <View style={s.chipWrap}>
          {INTEREST_OPTIONS.map((interest) => (
            <Chip
              key={interest}
              label={interest}
              selected={selectedInterests.includes(interest)}
              onPress={() => toggleInterest(interest)}
            />
          ))}
        </View>
        <GradientButton
          label={isSavingInterests ? 'Kaydediliyor...' : 'Kaydet'}
          onPress={() => void handleSaveInterests()}
          disabled={!selectedInterests.length || isSavingInterests}
          testID="settings-interests-save"
        />
      </BottomSheet>

      <BottomSheet
        visible={isEditingDailyGoal}
        onClose={cancelDailyGoalEdit}
        title="Günlük hedef"
        testID="settings-daily-goal-sheet"
      >
        <View style={s.chipWrap}>
          {DAILY_GOAL_OPTIONS.map((option) => (
            <Chip
              key={`${option.type}-${option.value}`}
              label={`${option.value} kart`}
              selected={isDailyGoalSelected(option)}
              onPress={() => setDailyGoal(option)}
            />
          ))}
        </View>
        <GradientButton
          label={isSavingDailyGoal ? 'Kaydediliyor...' : 'Kaydet'}
          onPress={() => void handleSaveDailyGoal()}
          disabled={!dailyGoal || isSavingDailyGoal}
          testID="settings-daily-goal-save"
        />
      </BottomSheet>

      <BottomSheet
        visible={isTimeSheetVisible}
        onClose={() => setIsTimeSheetVisible(false)}
        title="Hatırlatma saati"
        subtitle={notificationTimeSummary}
        testID="settings-time-sheet"
      >
        <View style={s.chipWrap}>
          {NOTIFICATION_HOUR_OPTIONS.map((hour) => (
            <Chip
              key={hour}
              label={`${String(hour).padStart(2, '0')}:00`}
              selected={notificationTime.hour === hour}
              onPress={() => void handleNotificationHourPress(hour)}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={isDeleteConfirmVisible}
        onClose={closeDeleteConfirm}
        title="Hesap kalıcı olarak silinsin mi?"
        subtitle="Bu işlem hesabını, okuma ilerlemeni, yer imlerini ve AI sohbetlerini kalıcı olarak siler. Devam etmek için SIL yaz."
        testID="account-delete-confirm"
      >
        <TextInput
          value={deleteConfirmationText}
          onChangeText={setDeleteConfirmationText}
          placeholder="SIL"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          style={s.input}
          editable={!isDeletingAccount}
          testID="account-delete-input"
        />
        <View style={s.deleteActions}>
          <Button
            label="Vazgeç"
            variant="ghost"
            onPress={closeDeleteConfirm}
            disabled={isDeletingAccount}
            testID="account-delete-cancel"
          />
          <DangerButton
            label={isDeletingAccount ? 'Siliniyor...' : 'Kalıcı olarak sil'}
            onPress={() => void handleDeleteAccount()}
            disabled={deleteConfirmationText.trim() !== 'SIL' || isDeletingAccount}
            testID="account-delete-submit"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: space.xxxl },
  feedback: {
    ...type.caption,
    color: colors.textSecondary,
    paddingHorizontal: space.screen,
    paddingVertical: space.sm,
  },
  feedbackError: { color: colors.danger },
  sectionTitle: {
    ...type.meta,
    color: colors.textTertiary,
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  dangerGap: { height: space.xl },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginVertical: space.lg,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.lg,
  },
  deleteActions: { gap: space.sm },
});
