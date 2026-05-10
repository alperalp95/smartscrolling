import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'daily-reminders';
const SMARTSCROLLING_NOTIFICATION_SOURCE = 'smartscrolling';
const SMARTSCROLLING_DAILY_REMINDER_KIND = 'daily_retention_reminder';
const REQUIRED_LOCAL_NOTIFICATION_MODULES = ['ExpoNotificationPermissionsModule'] as const;
const REQUIRED_PUSH_NOTIFICATION_MODULES = [
  'ExpoNotificationPermissionsModule',
  'ExpoPushTokenManager',
] as const;
let hasConfiguredNotificationHandler = false;

type DeviceModule = typeof import('expo-device');
type NotificationsModule = typeof import('expo-notifications');

type PermissionStatusResult =
  | {
      canAskAgain: boolean;
      message: string;
      status: 'granted';
    }
  | {
      canAskAgain?: boolean;
      message: string;
      status: 'blocked' | 'denied' | 'error' | 'unsupported';
    };

export type PushRegistrationResult =
  | {
      expoPushToken: string;
      message: string;
      status: 'granted';
    }
  | {
      message: string;
      status: 'blocked' | 'denied' | 'error' | 'missing_project_id' | 'unsupported';
    };

export type DailyReminderScheduleInput = {
  dailyGoalValue?: number | null;
  enabled: boolean;
  hour: number;
  minute: number;
  todayFactsRead?: number | null;
};

export type DailyReminderScheduleResult =
  | {
      identifier: string;
      message: string;
      scheduledFor: string;
      status: 'scheduled';
    }
  | {
      message: string;
      status: 'cancelled' | 'error' | 'skipped' | 'unsupported';
    };

function loadDeviceModule() {
  try {
    return require('expo-device') as DeviceModule;
  } catch (error) {
    console.warn('[Notifications] expo-device unavailable:', error);
    return null;
  }
}

function loadNotificationsModule() {
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('[Notifications] expo-notifications unavailable:', error);
    return null;
  }
}

function getMissingNativeModule(moduleNames: readonly string[]) {
  return moduleNames.find((moduleName) => !requireOptionalNativeModule(moduleName)) ?? null;
}

function getRequiredNotificationModules(requiresPushToken: boolean) {
  const baseModules = requiresPushToken
    ? REQUIRED_PUSH_NOTIFICATION_MODULES
    : REQUIRED_LOCAL_NOTIFICATION_MODULES;

  return Platform.OS === 'android'
    ? [...baseModules, 'ExpoNotificationChannelManager']
    : baseModules;
}

function ensureNotificationHandler(Notifications: NotificationsModule) {
  if (hasConfiguredNotificationHandler) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  hasConfiguredNotificationHandler = true;
}

async function ensureAndroidNotificationChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#8b5cf6',
    name: 'Gunluk hatirlaticilar',
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getExpoProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

function getNotificationRuntime(requiresPushToken: boolean) {
  if (Platform.OS === 'web') {
    return {
      message: 'Web ortaminda bildirim hazirligi desteklenmiyor.',
      Notifications: null,
      status: 'unsupported' as const,
    };
  }

  const missingNotificationModule = getMissingNativeModule(
    getRequiredNotificationModules(requiresPushToken),
  );

  if (missingNotificationModule) {
    return {
      message: `${missingNotificationModule} bu build icinde yok. Development build notification config'iyle yeniden alinmali.`,
      Notifications: null,
      status: 'unsupported' as const,
    };
  }

  const Notifications = loadNotificationsModule();

  if (!Notifications) {
    return {
      message: 'Notification native modulleri bu build icinde hazir degil.',
      Notifications: null,
      status: 'unsupported' as const,
    };
  }

  ensureNotificationHandler(Notifications);

  return {
    message: 'Notification native modulleri hazir.',
    Notifications,
    status: 'ready' as const,
  };
}

function hasNotificationPermission(
  Notifications: NotificationsModule,
  permission: Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>,
) {
  if (permission.status === 'granted') {
    return true;
  }

  const iosStatus = permission.ios?.status;

  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function getPermissionDeniedMessage(
  permission: Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>,
) {
  if (permission.canAskAgain === false) {
    return 'Bildirimler sistem ayarlarindan kapali. Tekrar acmak icin Android App Info > Notifications ayarini etkinlestir.';
  }

  return 'Bildirim izni verilmedigi icin local hatirlatici kurulamadi.';
}

async function getExistingLocalNotificationPermission(
  Notifications: NotificationsModule,
): Promise<PermissionStatusResult> {
  const permission = await Notifications.getPermissionsAsync();

  if (hasNotificationPermission(Notifications, permission)) {
    return {
      canAskAgain: permission.canAskAgain,
      status: 'granted',
      message: 'Bildirim izni hazir.',
    };
  }

  return {
    canAskAgain: permission.canAskAgain,
    status: permission.canAskAgain === false ? 'blocked' : 'denied',
    message: getPermissionDeniedMessage(permission),
  };
}

export async function getLocalNotificationPermissionStatus(): Promise<PermissionStatusResult> {
  try {
    const runtime = getNotificationRuntime(false);

    if (runtime.status !== 'ready') {
      return {
        status: runtime.status,
        message: runtime.message,
      };
    }

    await ensureAndroidNotificationChannel(runtime.Notifications);
    return getExistingLocalNotificationPermission(runtime.Notifications);
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Bildirim izni kontrol edilirken bilinmeyen bir hata olustu.',
    };
  }
}

export async function requestLocalNotificationPermission(): Promise<PermissionStatusResult> {
  try {
    const runtime = getNotificationRuntime(false);

    if (runtime.status !== 'ready') {
      return {
        status: runtime.status,
        message: runtime.message,
      };
    }

    await ensureAndroidNotificationChannel(runtime.Notifications);

    const existingPermission = await runtime.Notifications.getPermissionsAsync();
    let finalPermission = existingPermission;

    if (!hasNotificationPermission(runtime.Notifications, existingPermission)) {
      finalPermission = await runtime.Notifications.requestPermissionsAsync();
    }

    if (!hasNotificationPermission(runtime.Notifications, finalPermission)) {
      return {
        canAskAgain: finalPermission.canAskAgain,
        status: finalPermission.canAskAgain === false ? 'blocked' : 'denied',
        message:
          finalPermission.canAskAgain === false
            ? 'Bildirimler sistem ayarlarindan kapali. App Info > Notifications ayarini acmadan tercih etkinlestirilemez.'
            : 'Bildirim izni verilmedi. Tercih acik kaydedilmedi.',
      };
    }

    return {
      canAskAgain: finalPermission.canAskAgain,
      status: 'granted',
      message: 'Bildirim izni hazir.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Bildirim izni hazirlanirken bilinmeyen bir hata olustu.',
    };
  }
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  try {
    const runtime = getNotificationRuntime(true);

    if (runtime.status !== 'ready') {
      return {
        status: runtime.status,
        message: runtime.message,
      };
    }

    const missingDeviceModule = getMissingNativeModule(['ExpoDevice']);

    if (missingDeviceModule) {
      return {
        status: 'unsupported',
        message: `${missingDeviceModule} bu build icinde yok. Development build notification config'iyle yeniden alinmali.`,
      };
    }

    const Device = loadDeviceModule();

    if (!Device) {
      return {
        status: 'unsupported',
        message: 'Device native modulu bu build icinde hazir degil.',
      };
    }

    await ensureAndroidNotificationChannel(runtime.Notifications);

    if (!Device.isDevice) {
      return {
        status: 'unsupported',
        message: 'Push bildirimi icin fiziksel cihaz ve development build gerekiyor.',
      };
    }

    const permission = await requestLocalNotificationPermission();

    if (permission.status !== 'granted') {
      return {
        status: permission.status,
        message: permission.message,
      };
    }

    const projectId = getExpoProjectId();

    if (!projectId) {
      return {
        status: 'missing_project_id',
        message: 'Expo projectId bulunamadi. EAS proje ayari kontrol edilmeli.',
      };
    }

    const token = await runtime.Notifications.getExpoPushTokenAsync({ projectId });

    return {
      status: 'granted',
      expoPushToken: token.data,
      message: 'Bildirim izni alindi ve push token hazirlandi.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Push token hazirlanirken bilinmeyen bir hata olustu.',
    };
  }
}

function isSmartScrollingDailyReminder(
  request: Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number],
) {
  const data = request.content.data ?? {};

  return (
    data.source === SMARTSCROLLING_NOTIFICATION_SOURCE &&
    data.kind === SMARTSCROLLING_DAILY_REMINDER_KIND
  );
}

export async function cancelSmartScrollingScheduledNotifications(): Promise<DailyReminderScheduleResult> {
  try {
    const runtime = getNotificationRuntime(false);

    if (runtime.status !== 'ready') {
      return {
        status: runtime.status,
        message: runtime.message,
      };
    }

    const scheduledNotifications = await runtime.Notifications.getAllScheduledNotificationsAsync();
    const smartScrollingNotifications = scheduledNotifications.filter(
      isSmartScrollingDailyReminder,
    );

    await Promise.all(
      smartScrollingNotifications.map((request) =>
        runtime.Notifications.cancelScheduledNotificationAsync(request.identifier),
      ),
    );

    return {
      status: 'cancelled',
      message: `${smartScrollingNotifications.length} SmartScrolling hatirlaticisi temizlendi.`,
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Bildirimler temizlenirken bilinmeyen bir hata olustu.',
    };
  }
}

function getNextReminderDate(hour: number, minute: number, skipToday: boolean) {
  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setHours(hour, minute, 0, 0);

  if (skipToday || nextDate.getTime() <= now.getTime()) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

function getReminderCopy(input: DailyReminderScheduleInput) {
  const dailyGoalValue = input.dailyGoalValue ?? null;
  const todayFactsRead = Math.max(0, input.todayFactsRead ?? 0);

  if (dailyGoalValue && todayFactsRead < dailyGoalValue) {
    return {
      title: 'Serini korumak icin kisa bir mola',
      body: `Bugun ${todayFactsRead}/${dailyGoalValue} karttasin. Bir kart daha iyi gelir.`,
    };
  }

  return {
    title: 'Bugunku kartlarin hazir',
    body: 'Kisa bir bilgi molasi icin yeni kartlar seni bekliyor.',
  };
}

export async function reconcileDailyLocalReminder(
  input: DailyReminderScheduleInput,
): Promise<DailyReminderScheduleResult> {
  try {
    const runtime = getNotificationRuntime(false);

    if (runtime.status !== 'ready') {
      return {
        status: runtime.status,
        message: runtime.message,
      };
    }

    await ensureAndroidNotificationChannel(runtime.Notifications);
    await cancelSmartScrollingScheduledNotifications();

    if (!input.enabled) {
      return {
        status: 'cancelled',
        message: 'Bildirim tercihi kapali oldugu icin hatirlatici kurulmadi.',
      };
    }

    const permission = await getExistingLocalNotificationPermission(runtime.Notifications);

    if (permission.status !== 'granted') {
      return {
        status: 'skipped',
        message: permission.message,
      };
    }

    const dailyGoalValue = input.dailyGoalValue ?? null;
    const todayFactsRead = Math.max(0, input.todayFactsRead ?? 0);
    const shouldSkipToday = Boolean(dailyGoalValue && todayFactsRead >= dailyGoalValue);
    const triggerDate = getNextReminderDate(input.hour, input.minute, shouldSkipToday);
    const content = getReminderCopy(input);
    const identifier = await runtime.Notifications.scheduleNotificationAsync({
      content: {
        ...content,
        data: {
          source: SMARTSCROLLING_NOTIFICATION_SOURCE,
          kind: SMARTSCROLLING_DAILY_REMINDER_KIND,
          scheduledFor: triggerDate.toISOString(),
        },
        sound: false,
      },
      trigger: {
        type: runtime.Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: DEFAULT_NOTIFICATION_CHANNEL_ID,
      },
    });

    return {
      status: 'scheduled',
      identifier,
      scheduledFor: triggerDate.toISOString(),
      message: 'Gunluk local hatirlatici kuruldu.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Gunluk local hatirlatici kurulurken bilinmeyen bir hata olustu.',
    };
  }
}
