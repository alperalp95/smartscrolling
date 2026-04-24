import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type FtueState = {
  hasHydrated: boolean;
  hasSeenFtue: boolean;
  hideFtue: () => void;
  isFtueVisible: boolean;
  setHydrated: () => void;
  showFtue: () => void;
};

export const useFtueStore = create<FtueState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      hasSeenFtue: false,
      isFtueVisible: false,
      setHydrated: () => set({ hasHydrated: true }),
      showFtue: () => {
        if (get().hasSeenFtue || !get().hasHydrated) {
          return;
        }

        set({ isFtueVisible: true });
      },
      hideFtue: () =>
        set({
          hasSeenFtue: true,
          isFtueVisible: false,
        }),
    }),
    {
      name: 'smartscrolling-ftue',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasSeenFtue: state.hasSeenFtue }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();

        if (!state?.hasSeenFtue) {
          state?.showFtue();
        }
      },
    },
  ),
);
