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
      'Bu deneyim premium katmanında yer alıyor. Reklamsız kullanım, kartlara günde 30 AI sorusu ve kendi sorunu yazma premium ile açılır.',
    confirmLabel: options?.confirmLabel ?? 'Premiumu Incele',
    onConfirm:
      options?.onConfirm ??
      (() => {
        router.push('/premium' as never);
      }),
  });
}
