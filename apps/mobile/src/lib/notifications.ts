import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'daily-reminders';

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
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidNotificationChannel() {
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

    await ensureAndroidNotificationChannel();

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
