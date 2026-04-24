import { supabase } from './supabase';

export type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiChatResult = {
  answer: string;
  model?: string;
  history?: AiChatMessage[];
};

function clampContext(input?: string, maxChars = 4000) {
  if (!input) {
    return undefined;
  }

  if (input.length <= maxChars) {
    return input;
  }

  return input.slice(0, maxChars);
}

async function describeFunctionError(error: unknown, fallbackLabel: string) {
  const fallbackMessage = error instanceof Error ? error.message : fallbackLabel;

  if (!error || typeof error !== 'object' || !('context' in error)) {
    return fallbackMessage;
  }

  const context = (error as { context?: unknown }).context;

  if (!context || typeof context !== 'object') {
    return fallbackMessage;
  }

  const response = context as {
    status?: number;
    clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  const statusPrefix = response.status ? `status ${response.status}` : 'request failed';

  try {
    const cloned = response.clone?.();
    const json = cloned && 'json' in cloned ? await cloned.json?.() : undefined;

    if (json && typeof json === 'object') {
      const errorMessage =
        'error' in json && typeof json.error === 'string'
          ? json.error
          : 'message' in json && typeof json.message === 'string'
            ? json.message
            : null;

      if (errorMessage) {
        return `${statusPrefix}: ${errorMessage}`;
      }
    }
  } catch {
    // Fallback to text parsing below.
  }

  try {
    const cloned = response.clone?.();
    const text = cloned && 'text' in cloned ? await cloned.text?.() : undefined;

    if (text?.trim()) {
      return `${statusPrefix}: ${text.trim()}`;
    }
  } catch {
    // Ignore and use fallback.
  }

  return fallbackMessage;
}

export async function fetchAiChat(input: {
  question: string;
  context?: string;
  bookTitle?: string;
  history?: AiChatMessage[];
}) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        question: input.question,
        context: clampContext(input.context),
        bookTitle: input.bookTitle,
        history: input.history?.slice(-6),
      },
    });

    if (error) {
      throw error;
    }

    return data as AiChatResult;
  } catch (error) {
    const message = await describeFunctionError(error, 'unknown error');
    throw new Error(`ai-chat failed: ${message}`);
  }
}
