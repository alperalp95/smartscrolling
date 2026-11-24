import { useAuthPromptStore } from '../store/authPromptStore';

type PromptOptions = {
  onConfirm: () => void;
  title?: string;
  message?: string;
};

export function promptForAuth(options: PromptOptions) {
  useAuthPromptStore.getState().openPrompt({
    onConfirm: options.onConfirm,
    title: options.title ?? 'Giriş Gerekli',
    message: options.message ?? 'Bu özelliği kullanmak için önce giriş yapman gerekiyor.',
  });
}
