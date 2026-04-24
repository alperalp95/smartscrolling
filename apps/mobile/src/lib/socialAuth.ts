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
