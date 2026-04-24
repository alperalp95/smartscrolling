import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { usePremiumPromptStore } from '../store/premiumPromptStore';

type PremiumPromptOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
};

export function promptForPremium(options?: PremiumPromptOptions) {
  usePremiumPromptStore.getState().openPrompt({
    title: options?.title ?? 'Premium ile Ac',
    message:
      options?.message ??
      'Bu deneyim premium kutuphane katmaninda yer aliyor. Reklamsiz kullanim, tam kutuphane ve daha derin AI deneyimi premium ile acilir.',
    confirmLabel: options?.confirmLabel ?? 'Premiumu Incele',
    onConfirm:
      options?.onConfirm ??
      (() => {
        router.push('/premium' as never);
      }),
  });
}
