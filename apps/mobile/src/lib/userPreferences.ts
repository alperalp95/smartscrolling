import { supabase } from './supabase';

export type DailyGoalPreference = {
  type: 'facts';
  value: 3 | 5;
} | null;

export type NotificationTimePreference = {
  hour: number;
  minute: number;
};

export type UserPreferences = {
  dailyGoal: DailyGoalPreference;
  interests: string[];
  notificationsEnabled: boolean;
  notificationTime: NotificationTimePreference;
};

export const DEFAULT_NOTIFICATION_TIME: NotificationTimePreference = {
  hour: 20,
  minute: 0,
};

function normalizeInterests(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeDailyGoal(
  type: string | null | undefined,
  value: number | null | undefined,
): DailyGoalPreference {
  if (type === 'facts' && (value === 3 || value === 5)) {
    return { type, value };
  }

  return null;
}

function normalizeNotificationTime(
  hour: number | null | undefined,
  minute: number | null | undefined,
): NotificationTimePreference {
  const normalizedHour =
    typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 20;
  const normalizedMinute =
    typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute <= 59
      ? minute
      : 0;

  return {
    hour: normalizedHour,
    minute: normalizedMinute,
  };
}

export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'interests, daily_goal_type, daily_goal_value, notifications_enabled, notification_hour, notification_minute',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    dailyGoal: normalizeDailyGoal(data?.daily_goal_type, data?.daily_goal_value),
    interests: normalizeInterests(data?.interests),
    notificationsEnabled: data?.notifications_enabled === true,
    notificationTime: normalizeNotificationTime(data?.notification_hour, data?.notification_minute),
  };
}

export async function updateUserInterests(userId: string, interests: string[]) {
  const normalizedInterests = normalizeInterests(interests).slice(0, 3);

  const { data, error } = await supabase
    .from('users')
    .upsert({ id: userId, interests: normalizedInterests }, { onConflict: 'id' })
    .select('interests')
    .single();

  if (error) {
    throw error;
  }

  return normalizeInterests(data?.interests);
}

export async function updateUserDailyGoal(userId: string, dailyGoal: DailyGoalPreference) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        daily_goal_type: dailyGoal?.type ?? null,
        daily_goal_value: dailyGoal?.value ?? null,
      },
      { onConflict: 'id' },
    )
    .select('daily_goal_type, daily_goal_value')
    .single();

  if (error) {
    throw error;
  }

  return normalizeDailyGoal(data?.daily_goal_type, data?.daily_goal_value);
}

export async function updateNotificationPreference(userId: string, enabled: boolean) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        notifications_enabled: enabled,
      },
      { onConflict: 'id' },
    )
    .select('notifications_enabled')
    .single();

  if (error) {
    throw error;
  }

  return data?.notifications_enabled === true;
}

export async function updateNotificationTimePreference(
  userId: string,
  time: NotificationTimePreference,
) {
  const normalizedTime = normalizeNotificationTime(time.hour, time.minute);
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        notification_hour: normalizedTime.hour,
        notification_minute: normalizedTime.minute,
      },
      { onConflict: 'id' },
    )
    .select('notification_hour, notification_minute')
    .single();

  if (error) {
    throw error;
  }

  return normalizeNotificationTime(data?.notification_hour, data?.notification_minute);
}
