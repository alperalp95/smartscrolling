import * as Linking from 'expo-linking';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { finalizeSocialAuthFromUrl } from '../../src/lib/socialAuth';
import { useAuthStore } from '../../src/store/authStore';
import { colors, type } from '../../src/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const clearPostAuthRedirectPath = useAuthStore((state) => state.clearPostAuthRedirectPath);
  const postAuthRedirectPath = useAuthStore((state) => state.postAuthRedirectPath);
  const user = useAuthStore((state) => state.user);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasHandledUrlRef = useRef(false);

  useEffect(() => {
    if (!url || hasHandledUrlRef.current) {
      return;
    }

    hasHandledUrlRef.current = true;

    void (async () => {
      const result = await finalizeSocialAuthFromUrl(url);

      if (result.error) {
        setErrorMessage(result.error);
      }
    })();
  }, [url]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const target = (postAuthRedirectPath ?? '/profile') as Href;
    clearPostAuthRedirectPath();
    router.replace(target);
  }, [clearPostAuthRedirectPath, postAuthRedirectPath, router, user]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      router.replace('/profile');
    }, 1800);

    return () => clearTimeout(timeout);
  }, [errorMessage, router]);

  return (
    <View style={s.container}>
      <ActivityIndicator color={colors.brandGradient[2]} size="large" />
      <Text style={s.title}>
        {errorMessage ? 'Google girişinde bir sorun oldu' : 'Giriş tamamlanıyor'}
      </Text>
      <Text style={s.message}>
        {errorMessage ?? 'Hesabın doğrulanıyor, seni uygulamaya geri alıyoruz.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    color: colors.text,
    ...type.cardTitle,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    ...type.body,
    lineHeight: 22,
    textAlign: 'center',
  },
});
