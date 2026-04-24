import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://gfbhzvaqngaxucbjljht.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYmh6dmFxbmdheHVjYmpsamh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjEyMjIsImV4cCI6MjA5MTQ5NzIyMn0.An0x826hB2EZl3r-zsps5hva1ehSEddDxFB1b05LCYE';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryStorage = new Map<string, string>();

const fallbackStorage: StorageLike = {
  getItem: async (key) => memoryStorage.get(key) ?? null,
  setItem: async (key, value) => {
    memoryStorage.set(key, value);
  },
  removeItem: async (key) => {
    memoryStorage.delete(key);
  },
};

let storageWarningShown = false;

function isExpectedLegacyStorageError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('Native module is null, cannot access legacy storage')
  );
}

function warnStorageFallback(message: string, error: unknown) {
  if (isExpectedLegacyStorageError(error)) {
    return;
  }

  if (storageWarningShown) {
    return;
  }

  storageWarningShown = true;
  console.warn(message, error);
}

function createSafeNativeStorage(): StorageLike | undefined {
  if (Platform.OS === 'web') {
    return undefined;
  }

  try {
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    let useFallbackOnly = false;

    return {
      getItem: async (key) => {
        if (useFallbackOnly) {
          return fallbackStorage.getItem(key);
        }

        try {
          return await asyncStorage.getItem(key);
        } catch (error) {
          useFallbackOnly = true;
          warnStorageFallback(
            '[Supabase] AsyncStorage getItem failed, using in-memory fallback.',
            error,
          );
          return fallbackStorage.getItem(key);
        }
      },
      setItem: async (key, value) => {
        if (useFallbackOnly) {
          await fallbackStorage.setItem(key, value);
          return;
        }

        try {
          await asyncStorage.setItem(key, value);
        } catch (error) {
          useFallbackOnly = true;
          warnStorageFallback(
            '[Supabase] AsyncStorage setItem failed, using in-memory fallback.',
            error,
          );
          await fallbackStorage.setItem(key, value);
        }
      },
      removeItem: async (key) => {
        if (useFallbackOnly) {
          await fallbackStorage.removeItem(key);
          return;
        }

        try {
          await asyncStorage.removeItem(key);
        } catch (error) {
          useFallbackOnly = true;
          warnStorageFallback(
            '[Supabase] AsyncStorage removeItem failed, using in-memory fallback.',
            error,
          );
          await fallbackStorage.removeItem(key);
        }
      },
    };
  } catch (error) {
    warnStorageFallback(
      '[Supabase] AsyncStorage module unavailable, using in-memory fallback.',
      error,
    );
    return fallbackStorage;
  }
}

const storageAdapter = createSafeNativeStorage();

const authOptions =
  Platform.OS === 'web'
    ? { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    : {
        storage: storageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
});
