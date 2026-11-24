import { create } from 'zustand';

export type DialogAction = {
  label: string;
  style?: 'primary' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogOptions = {
  title: string;
  message?: string;
  actions?: DialogAction[];
};

export type DialogRequest = {
  title: string;
  message?: string;
  actions: DialogAction[];
};

type DialogState = {
  current: DialogRequest | null;
  queue: DialogRequest[];
  enqueue: (request: DialogRequest) => void;
  dismiss: () => void;
};

export const useDialogStore = create<DialogState>()((set, get) => ({
  current: null,
  queue: [],
  enqueue: (request) => {
    if (get().current) {
      set({ queue: [...get().queue, request] });
      return;
    }
    set({ current: request });
  },
  dismiss: () => {
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
  },
}));
