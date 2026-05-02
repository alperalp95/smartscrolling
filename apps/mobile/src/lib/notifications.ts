import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'daily-reminders';
const REQUIRED_NOTIFICATION_MODULES = [
  'ExpoNotificationPermissionsModule',
  'ExpoPushTokenManager',
] as const;

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

    const requiredModules =
      Platform.OS === 'android'
        ? [...REQUIRED_NOTIFICATION_MODULES, 'ExpoNotificationChannelManager']
        : REQUIRED_NOTIFICATION_MODULES;
    const missingNotificationModule = getMissingNativeModule(requiredModules);

    if (missingNotificationModule) {
      return {
        status: 'unsupported',
        message: `${missingNotificationModule} bu build icinde yok. Development build notification config'iyle yeniden alinmali.`,
      };
    }

    const missingDeviceModule = getMissingNativeModule(['ExpoDevice']);

    if (missingDeviceModule) {
      return {
        status: 'unsupported',
        message: `${missingDeviceModule} bu build icinde yok. Development build notification config'iyle yeniden alinmali.`,
      };
    }

    const Notifications = loadNotificationsModule();
    const Device = loadDeviceModule();

    if (!Notifications || !Device) {
      return {
        status: 'unsupported',
        message: 'Notification native modulleri bu build icinde hazir degil.',
      };
    }

    await ensureAndroidNotificationChannel(Notifications);

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
