import { useAuthPromptStore } from '../store/authPromptStore';

type PromptOptions = {
  onConfirm: () => void;
  title?: string;
  message?: string;
};

export function promptForAuth(options: PromptOptions) {
  useAuthPromptStore.getState().openPrompt({
    onConfirm: options.onConfirm,
    title: options.title ?? 'Giris Gerekli',
    message: options.message ?? 'Bu ozelligi kullanmak icin once giris yapman gerekiyor.',
  });
}
