import { create } from 'zustand';

export type DailyGoalPreference = {
  type: 'facts';
  value: 3 | 5;
} | null;

export type NotificationTimePreference = {
  hour: number;
  minute: number;
};

const DEFAULT_NOTIFICATION_TIME: NotificationTimePreference = {
  hour: 20,
  minute: 0,
};

type OnboardingState = {
  dailyGoal: DailyGoalPreference;
  ftueEntryPath: 'feed' | 'free_book' | null;
  hasCompletedDailyGoal: boolean;
  hasCompletedInterestPicker: boolean;
  hasCompletedNotificationPreference: boolean;
  notificationsEnabled: boolean;
  notificationTime: NotificationTimePreference;
  selectedInterests: string[];
  completeInterestPicker: () => void;
  completeDailyGoal: () => void;
  completeNotificationPreference: () => void;
  hydrateDailyGoal: (goal: DailyGoalPreference) => void;
  hydrateInterestPicker: (interests: string[]) => void;
  hydrateNotificationPreference: (enabled: boolean, time?: NotificationTimePreference) => void;
  resetOnboarding: () => void;
  setDailyGoal: (goal: DailyGoalPreference) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotificationTime: (time: NotificationTimePreference) => void;
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
  notificationTime: DEFAULT_NOTIFICATION_TIME,
  setFtueEntryPath: (path) => set({ ftueEntryPath: path }),
  setDailyGoal: (goal) => set({ dailyGoal: goal }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setNotificationTime: (time) => set({ notificationTime: time }),
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
  hydrateNotificationPreference: (enabled, time) =>
    set({
      notificationsEnabled: enabled,
      notificationTime: time ?? DEFAULT_NOTIFICATION_TIME,
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
      notificationTime: DEFAULT_NOTIFICATION_TIME,
      selectedInterests: [],
    }),
}));
