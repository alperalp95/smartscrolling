import { create } from 'zustand';

type PremiumPromptState = {
  isVisible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: (() => void) | null;
  openPrompt: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm?: () => void;
  }) => void;
  closePrompt: () => void;
  confirmPrompt: () => void;
};

export const usePremiumPromptStore = create<PremiumPromptState>()((set, get) => ({
  isVisible: false,
  title: 'Premium ile Ac',
  message: 'Bu deneyim premium uyelikle aciliyor.',
  confirmLabel: 'Premiumu Incele',
  onConfirm: null,
  openPrompt: (options) =>
    set({
      isVisible: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Premiumu Incele',
      onConfirm: options.onConfirm ?? null,
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
