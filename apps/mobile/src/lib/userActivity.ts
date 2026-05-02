import { supabase } from './supabase';

type DailyActivityIncrement = {
  factsRead?: number;
  pagesRead?: number;
  aiQueries?: number;
};

export type DailyActivity = {
  aiQueries: number;
  date: string;
  factsRead: number;
  isActive: boolean;
  pagesRead: number;
};

export type ActivitySummary = {
  bestStreakDays: number;
  streakDays: number;
  today: DailyActivity;
  week: DailyActivity[];
};

function normalizeIncrement(value: number | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function addDays(dateKey: string, days: number) {
  const date = getDateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function getCurrentWeekDateKeys() {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return getLocalDateKey(date);
  });
}

function getBestStreakDays(activeDates: Set<string>) {
  let bestStreakDays = 0;

  for (const date of activeDates) {
    const previousDate = addDays(date, -1);

    if (activeDates.has(previousDate)) {
      continue;
    }

    let streakDays = 0;
    let cursor = date;

    while (activeDates.has(cursor)) {
      streakDays += 1;
      cursor = addDays(cursor, 1);
    }

    bestStreakDays = Math.max(bestStreakDays, streakDays);
  }

  return bestStreakDays;
}

function normalizeActivityRow(
  row:
    | {
        ai_queries: number | null;
        date: string | null;
        facts_read: number | null;
        pages_read: number | null;
      }
    | null
    | undefined,
  fallbackDate: string,
): DailyActivity {
  const factsRead = Math.max(0, row?.facts_read ?? 0);
  const pagesRead = Math.max(0, row?.pages_read ?? 0);
  const aiQueries = Math.max(0, row?.ai_queries ?? 0);

  return {
    aiQueries,
    date: row?.date ?? fallbackDate,
    factsRead,
    isActive: factsRead + pagesRead + aiQueries > 0,
    pagesRead,
  };
}

async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Dev] getUser failed for activity tracking:', error.message);
    return null;
  }

  return user?.id ?? null;
}

export async function fetchTodayActivity() {
  const userId = await getCurrentUserId();
  const todayKey = getLocalDateKey();

  if (!userId) {
    return normalizeActivityRow(null, todayKey);
  }

  const { data, error } = await supabase
    .from('user_activity')
    .select('date,facts_read,pages_read,ai_queries')
    .eq('user_id', userId)
    .eq('date', todayKey)
    .maybeSingle();

  if (error) {
    console.error('[Dev] today activity fetch failed:', error.message);
    return normalizeActivityRow(null, todayKey);
  }

  return normalizeActivityRow(data, todayKey);
}

export async function fetchActivitySummary(): Promise<ActivitySummary> {
  const userId = await getCurrentUserId();
  const todayKey = getLocalDateKey();
  const emptyToday = normalizeActivityRow(null, todayKey);
  const weekKeys = getCurrentWeekDateKeys();

  if (!userId) {
    return {
      bestStreakDays: 0,
      streakDays: 0,
      today: emptyToday,
      week: weekKeys.map((date) => normalizeActivityRow(null, date)),
    };
  }

  const sinceDate = addDays(todayKey, -90);
  const { data, error } = await supabase
    .from('user_activity')
    .select('date,facts_read,pages_read,ai_queries')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .lte('date', todayKey)
    .order('date', { ascending: false });

  if (error) {
    console.error('[Dev] activity summary fetch failed:', error.message);
    return {
      bestStreakDays: 0,
      streakDays: 0,
      today: emptyToday,
      week: weekKeys.map((date) => normalizeActivityRow(null, date)),
    };
  }

  const activityByDate = new Map(
    (data ?? []).map((row) => {
      const activity = normalizeActivityRow(row, row.date ?? todayKey);
      return [activity.date, activity] as const;
    }),
  );
  const activeDates = new Set(
    [...activityByDate.values()]
      .filter((activity) => activity.isActive)
      .map((activity) => activity.date),
  );
  const today = activityByDate.get(todayKey) ?? emptyToday;
  const streakStart = activeDates.has(todayKey)
    ? todayKey
    : activeDates.has(addDays(todayKey, -1))
      ? addDays(todayKey, -1)
      : null;
  let streakDays = 0;

  if (streakStart) {
    let cursor = streakStart;

    while (activeDates.has(cursor)) {
      streakDays += 1;
      cursor = addDays(cursor, -1);
    }
  }

  return {
    bestStreakDays: getBestStreakDays(activeDates),
    streakDays,
    today,
    week: weekKeys.map((date) => activityByDate.get(date) ?? normalizeActivityRow(null, date)),
  };
}

export async function incrementDailyActivity(input: DailyActivityIncrement) {
  const increments = {
    facts_read: normalizeIncrement(input.factsRead),
    pages_read: normalizeIncrement(input.pagesRead),
    ai_queries: normalizeIncrement(input.aiQueries),
  };

  if (!increments.facts_read && !increments.pages_read && !increments.ai_queries) {
    return { synced: false as const, reason: 'empty_increment' as const };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { synced: false as const, reason: 'unauthenticated' as const };
  }

  const activityDate = getLocalDateKey();
  const { data: currentActivity, error: fetchError } = await supabase
    .from('user_activity')
    .select('facts_read,pages_read,ai_queries')
    .eq('user_id', userId)
    .eq('date', activityDate)
    .maybeSingle();

  if (fetchError) {
    console.error('[Dev] activity fetch failed:', fetchError.message);
    return { synced: false as const, reason: 'fetch_error' as const };
  }

  const payload = {
    user_id: userId,
    date: activityDate,
    facts_read: (currentActivity?.facts_read ?? 0) + increments.facts_read,
    pages_read: (currentActivity?.pages_read ?? 0) + increments.pages_read,
    ai_queries: (currentActivity?.ai_queries ?? 0) + increments.ai_queries,
  };

  const { error } = await supabase.from('user_activity').upsert(payload, {
    onConflict: 'user_id,date',
  });

  if (error) {
    console.error('[Dev] activity upsert failed:', error.message);
    return { synced: false as const, reason: 'upsert_error' as const };
  }

  return { synced: true as const };
}
