import { supabase } from './supabase';

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

export type UserPreferences = {
  dailyGoal: DailyGoalPreference;
  interests: string[];
  notificationsEnabled: boolean;
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

  if (type === 'minutes' && value === 10) {
    return { type, value };
  }

  return null;
}

export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('users')
    .select('interests, daily_goal_type, daily_goal_value, notifications_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    dailyGoal: normalizeDailyGoal(data?.daily_goal_type, data?.daily_goal_value),
    interests: normalizeInterests(data?.interests),
    notificationsEnabled: data?.notifications_enabled === true,
  };
}

export async function updateUserInterests(userId: string, interests: string[]) {
  const normalizedInterests = normalizeInterests(interests).slice(0, 3);

  const { data, error } = await supabase
    .from('users')
    .update({ interests: normalizedInterests })
    .eq('id', userId)
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
    .update({
      daily_goal_type: dailyGoal?.type ?? null,
      daily_goal_value: dailyGoal?.value ?? null,
    })
    .eq('id', userId)
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
    .update({
      notifications_enabled: enabled,
    })
    .eq('id', userId)
    .select('notifications_enabled')
    .single();

  if (error) {
    throw error;
  }

  return data?.notifications_enabled === true;
}
