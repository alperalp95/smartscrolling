import { create } from 'zustand';

export type DailyGoalPreference =
  | {
      type: 'facts';
      value: 3 | 5;
    }
  | {
      type: 'minutes';
      value: 10;
    }
  | null;

type OnboardingState = {
  dailyGoal: DailyGoalPreference;
  ftueEntryPath: 'feed' | 'free_book' | null;
  hasCompletedDailyGoal: boolean;
  hasCompletedInterestPicker: boolean;
  hasCompletedNotificationPreference: boolean;
  notificationsEnabled: boolean;
  selectedInterests: string[];
  completeInterestPicker: () => void;
  completeDailyGoal: () => void;
  completeNotificationPreference: () => void;
  hydrateDailyGoal: (goal: DailyGoalPreference) => void;
  hydrateInterestPicker: (interests: string[]) => void;
  hydrateNotificationPreference: (enabled: boolean) => void;
  resetOnboarding: () => void;
  setDailyGoal: (goal: DailyGoalPreference) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSelectedInterests: (interests: string[]) => void;
  setFtueEntryPath: (path: 'feed' | 'free_book') => void;
  toggleInterest: (interest: string) => void;
};

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  dailyGoal: null,
  ftueEntryPath: null,
  selectedInterests: [],
  hasCompletedDailyGoal: false,
  hasCompletedInterestPicker: false,
  hasCompletedNotificationPreference: false,
  notificationsEnabled: false,
  setFtueEntryPath: (path) => set({ ftueEntryPath: path }),
  setDailyGoal: (goal) => set({ dailyGoal: goal }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setSelectedInterests: (interests) =>
    set({
      selectedInterests: interests.slice(0, 3),
    }),
  toggleInterest: (interest) =>
    set((state) => ({
      selectedInterests: state.selectedInterests.includes(interest)
        ? state.selectedInterests.filter((item) => item !== interest)
        : [...state.selectedInterests, interest].slice(0, 3),
    })),
  completeInterestPicker: () => set({ hasCompletedInterestPicker: true }),
  completeDailyGoal: () => set({ hasCompletedDailyGoal: true }),
  completeNotificationPreference: () => set({ hasCompletedNotificationPreference: true }),
  hydrateDailyGoal: (goal) =>
    set({
      dailyGoal: goal,
      hasCompletedDailyGoal: Boolean(goal),
    }),
  hydrateInterestPicker: (interests) =>
    set({
      selectedInterests: interests.slice(0, 3),
      hasCompletedInterestPicker: interests.length > 0,
    }),
  hydrateNotificationPreference: (enabled) =>
    set({
      notificationsEnabled: enabled,
      hasCompletedNotificationPreference: enabled,
    }),
  resetOnboarding: () =>
    set({
      dailyGoal: null,
      ftueEntryPath: null,
      hasCompletedDailyGoal: false,
      hasCompletedInterestPicker: false,
      hasCompletedNotificationPreference: false,
      notificationsEnabled: false,
      selectedInterests: [],
    }),
}));
