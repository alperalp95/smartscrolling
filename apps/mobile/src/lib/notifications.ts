import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'daily-reminders';

type DeviceModule = typeof import('expo-device');
type NotificationsModule = typeof import('expo-notifications');

export type PushRegistrationResult =
  | {
      expoPushToken: string;
      message: string;
      status: 'granted';
    }
  | {
      message: string;
      status: 'denied' | 'error' | 'missing_project_id' | 'unsupported';
    };

export function configureForegroundNotifications() {
  void loadNotificationsModule().then((Notifications) => {
    if (!Notifications) {
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
  });
}

async function loadDeviceModule() {
  try {
    return await import('expo-device');
  } catch (error) {
    console.warn('[Notifications] expo-device unavailable:', error);
    return null;
  }
}

async function loadNotificationsModule() {
  try {
    return await import('expo-notifications');
  } catch (error) {
    console.warn('[Notifications] expo-notifications unavailable:', error);
    return null;
  }
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

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  try {
    if (Platform.OS === 'web') {
      return {
        status: 'unsupported',
        message: 'Web ortaminda push notification hazirligi desteklenmiyor.',
      };
    }

    const Notifications = await loadNotificationsModule();

    if (!Notifications) {
      return {
        status: 'unsupported',
        message:
          'Bu build notification native modulunu icermiyor. Development build yeniden alinmali.',
      };
    }

    await ensureAndroidNotificationChannel(Notifications);

    const Device: DeviceModule | null = await loadDeviceModule();

    if (!Device) {
      return {
        status: 'unsupported',
        message: 'Bu build device native modulunu icermiyor. Development build yeniden alinmali.',
      };
    }

    if (!Device.isDevice) {
      return {
        status: 'unsupported',
        message: 'Push bildirimi icin fiziksel cihaz ve development build gerekiyor.',
      };
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;

    if (finalStatus !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== 'granted') {
      return {
        status: 'denied',
        message: 'Bildirim izni verilmedi. Tercih acik kaydedilmedi.',
      };
    }

    const projectId = getExpoProjectId();

    if (!projectId) {
      return {
        status: 'missing_project_id',
        message: 'Expo projectId bulunamadi. EAS proje ayari kontrol edilmeli.',
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

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
