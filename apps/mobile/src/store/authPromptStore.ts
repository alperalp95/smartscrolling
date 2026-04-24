import { create } from 'zustand';

type AuthPromptState = {
  isVisible: boolean;
  message: string;
  onConfirm: (() => void) | null;
  title: string;
  closePrompt: () => void;
  confirmPrompt: () => void;
  openPrompt: (options: { title: string; message: string; onConfirm: () => void }) => void;
};

export const useAuthPromptStore = create<AuthPromptState>()((set, get) => ({
  isVisible: false,
  title: 'Giris Gerekli',
  message: 'Bu ozelligi kullanmak icin once giris yapman gerekiyor.',
  onConfirm: null,
  openPrompt: (options) =>
    set({
      isVisible: true,
      title: options.title,
      message: options.message,
      onConfirm: options.onConfirm,
    }),
  closePrompt: () =>
    set({
      isVisible: false,
      onConfirm: null,
    }),
  confirmPrompt: () => {
    const onConfirm = get().onConfirm;

    set({
      isVisible: false,
      onConfirm: null,
    });

    onConfirm?.();
  },
}));
