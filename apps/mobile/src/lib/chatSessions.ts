import type { AiChatMessage } from './aiChat';
import { supabase } from './supabase';

export type ChatSessionRecord = {
  id: string;
  user_id: string;
  context_type: string | null;
  context_id: string | null;
  messages: AiChatMessage[] | null;
  created_at: string;
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
    console.error('[Dev] getUser failed for chat sessions:', error.message);
    return null;
  }

  return user?.id ?? null;
}

export async function fetchLatestChatSession(bookId: string) {
  if (!isUuid(bookId)) {
    return null;
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, user_id, context_type, context_id, messages, created_at')
    .eq('user_id', userId)
    .eq('context_type', 'book')
    .eq('context_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Dev] chat session fetch failed:', error.message);
    return null;
  }

  return data as ChatSessionRecord | null;
}

export async function saveChatSession(input: { bookId: string; messages: AiChatMessage[] }) {
  if (!isUuid(input.bookId)) {
    console.log('[Dev] Skipping chat session sync for non-UUID demo book id:', input.bookId);
    return { synced: false, reason: 'invalid_book_id' as const };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { synced: false, reason: 'unauthenticated' as const };
  }

  const latestSession = await fetchLatestChatSession(input.bookId);
  const payload = {
    user_id: userId,
    context_type: 'book',
    context_id: input.bookId,
    messages: input.messages,
  };

  const query = latestSession
    ? supabase.from('chat_sessions').update(payload).eq('id', latestSession.id)
    : supabase.from('chat_sessions').insert(payload);

  const { error } = await query;

  if (error) {
    console.error('[Dev] chat session save failed:', error.message);
    return { synced: false, reason: 'error' as const };
  }

  return { synced: true as const };
}
