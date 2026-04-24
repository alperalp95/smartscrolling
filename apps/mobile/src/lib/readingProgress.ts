import { supabase } from './supabase';

export type ReadingProgressInput = {
  bookId: string;
  currentPage: number;
  completed?: boolean;
};

export type ReadingProgressRecord = {
  user_id: string;
  book_id: string;
  current_page: number;
  last_read_at: string;
  completed: boolean;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
    console.error('[Dev] getUser failed for reading progress:', error.message);
    return null;
  }

  return user?.id ?? null;
}

export async function fetchReadingProgress(bookId: string) {
  if (!isUuid(bookId)) {
    return null;
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('reading_progress')
    .select('user_id, book_id, current_page, last_read_at, completed')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (error) {
    console.error('[Dev] reading progress fetch failed:', error.message);
    return null;
  }

  return data;
}

export async function upsertReadingProgress(input: ReadingProgressInput) {
  if (!isUuid(input.bookId)) {
    console.log('[Dev] Skipping reading progress sync for non-UUID demo book id:', input.bookId);
    return { synced: false, reason: 'invalid_book_id' as const };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { synced: false, reason: 'unauthenticated' as const };
  }

  const payload = {
    user_id: userId,
    book_id: input.bookId,
    current_page: Math.max(0, Math.floor(input.currentPage)),
    last_read_at: new Date().toISOString(),
    completed: input.completed ?? false,
  };

  const { error } = await supabase.from('reading_progress').upsert(payload, {
    onConflict: 'user_id,book_id',
  });

  if (error) {
    console.error('[Dev] reading progress upsert failed:', error.message);
    return { synced: false, reason: 'error' as const };
  }

  return { synced: true as const };
}
