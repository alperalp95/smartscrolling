import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getExpoPushTokenIfPermissionGranted, registerForPushNotifications } from './notifications';
import { supabase } from './supabase';

type PushTokenPersistenceResult =
  | {
      expoPushToken: string;
      message: string;
      status: 'saved';
    }
  | {
      message: string;
      status: 'disabled' | 'error' | 'skipped';
    };

function getPushPlatform() {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
}

function getAppVersion() {
  return Constants.expoConfig?.version ?? null;
}

async function persistExpoPushToken(
  userId: string,
  expoPushToken: string,
): Promise<PushTokenPersistenceResult> {
  const platform = getPushPlatform();

  if (!platform) {
    return {
      status: 'skipped',
      message: 'Bu platformda remote push token saklanmiyor.',
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('push_tokens').upsert(
    {
      app_version: getAppVersion(),
      enabled: true,
      expo_push_token: expoPushToken,
      last_seen_at: now,
      platform,
      revoked_at: null,
      updated_at: now,
      user_id: userId,
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  if (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }

  return {
    status: 'saved',
    expoPushToken,
    message: 'Push token kaydedildi.',
  };
}

export async function upsertCurrentExpoPushToken(
  userId: string,
): Promise<PushTokenPersistenceResult> {
  const registration = await registerForPushNotifications();

  if (registration.status !== 'granted') {
    return {
      status: 'skipped',
      message: registration.message,
    };
  }

  return persistExpoPushToken(userId, registration.expoPushToken);
}

export async function refreshCurrentExpoPushTokenIfPermissionGranted(
  userId: string,
): Promise<PushTokenPersistenceResult> {
  const registration = await getExpoPushTokenIfPermissionGranted();

  if (registration.status !== 'granted') {
    return {
      status: 'skipped',
      message: registration.message,
    };
  }

  return persistExpoPushToken(userId, registration.expoPushToken);
}

export async function disableUserPushTokens(userId: string): Promise<PushTokenPersistenceResult> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('push_tokens')
    .update({
      enabled: false,
      revoked_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }

  return {
    status: 'disabled',
    message: 'Push token kayitlari pasife alindi.',
  };
}

export async function disableCurrentExpoPushToken(
  userId: string,
): Promise<PushTokenPersistenceResult> {
  const registration = await getExpoPushTokenIfPermissionGranted();

  if (registration.status !== 'granted') {
    return {
      status: 'skipped',
      message: registration.message,
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('push_tokens')
    .update({
      enabled: false,
      revoked_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('expo_push_token', registration.expoPushToken);

  if (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }

  return {
    status: 'disabled',
    message: 'Mevcut push token kaydi pasife alindi.',
  };
}
