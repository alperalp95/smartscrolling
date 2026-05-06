import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const SOCIAL_AUTH_CALLBACK_PATH = 'auth/callback';

type SocialAuthCallbackResult = {
  handled: boolean;
  error?: string;
};

function createNonce() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getGoogleRedirectTo() {
  return Linking.createURL(SOCIAL_AUTH_CALLBACK_PATH, {
    scheme: 'mobile',
  });
}

function parseSearchParams(input: string) {
  const params = new URLSearchParams(input);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

function getParamsFromUrl(url: string) {
  const normalizedUrl = url.replace('#', '?');
  const parsed = new URL(normalizedUrl);

  return {
    ...parseSearchParams(parsed.search),
    ...parseSearchParams(parsed.hash.replace(/^#/, '')),
  };
}

export function getSocialAuthRedirectPath() {
  return SOCIAL_AUTH_CALLBACK_PATH;
}

export function getGoogleRedirectUri() {
  return getGoogleRedirectTo();
}

export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') {
    return false;
  }

  return AppleAuthentication.isAvailableAsync();
}

export async function finalizeSocialAuthFromUrl(url: string): Promise<SocialAuthCallbackResult> {
  const params = getParamsFromUrl(url);

  if (typeof params.error_description === 'string') {
    return {
      handled: true,
      error: params.error_description,
    };
  }

  if (typeof params.error === 'string') {
    return {
      handled: true,
      error: params.error,
    };
  }

  const code = typeof params.code === 'string' ? params.code : null;
  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return {
      handled: true,
      error: error?.message,
    };
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return {
      handled: true,
      error: error?.message,
    };
  }

  return { handled: false };
}

export async function signInWithGoogle() {
  const redirectTo = getGoogleRedirectTo();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }

    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'email profile',
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Google auth URL olusturulamadi.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    const callback = await finalizeSocialAuthFromUrl(result.url);

    if (callback.error) {
      throw new Error(callback.error);
    }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google girisi iptal edildi.');
  }
}

function getAppleFullNameData(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  if (!fullName) {
    return null;
  }

  const fullNameValue = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!fullNameValue && !fullName.givenName && !fullName.familyName) {
    return null;
  }

  return {
    full_name: fullNameValue || undefined,
    given_name: fullName.givenName ?? undefined,
    family_name: fullName.familyName ?? undefined,
  };
}

function isAppleRequestCanceled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple ile giris yalnizca iOS cihazlarda desteklenir.');
  }

  const nonce = createNonce();

  try {
    const credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple identity token donmedi.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });

    if (error) {
      throw error;
    }

    const nameData = getAppleFullNameData(credential.fullName);

    if (nameData) {
      await supabase.auth.updateUser({ data: nameData });
    }
  } catch (error) {
    if (isAppleRequestCanceled(error)) {
      throw new Error('Apple girisi iptal edildi.');
    }

    throw error;
  }
}
