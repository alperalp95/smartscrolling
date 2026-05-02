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

export type AiChatQuota = {
  tier?: 'free' | 'premium';
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

export type AiChatErrorCode =
  | 'auth_required'
  | 'quota_exceeded'
  | 'quota_unavailable'
  | 'groq_rate_limited';

type AiChatErrorDetails = {
  code?: AiChatErrorCode;
  message: string;
  quota?: AiChatQuota;
  retryAfterSeconds?: number;
  status?: number;
};

export class AiChatRequestError extends Error {
  code?: AiChatErrorCode;
  quota?: AiChatQuota;
  retryAfterSeconds?: number;
  status?: number;

  constructor(message: string, details: Omit<AiChatErrorDetails, 'message'> = {}) {
    super(message);
    this.name = 'AiChatRequestError';
    this.code = details.code;
    this.quota = details.quota;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.status = details.status;
  }
}

function clampContext(input?: string, maxChars = 4000) {
  if (!input) {
    return undefined;
  }

  if (input.length <= maxChars) {
    return input;
  }

  return input.slice(0, maxChars);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function normalizeErrorCode(value: unknown): AiChatErrorCode | undefined {
  if (
    value === 'auth_required' ||
    value === 'quota_exceeded' ||
    value === 'quota_unavailable' ||
    value === 'groq_rate_limited'
  ) {
    return value;
  }

  return undefined;
}

function normalizeQuota(value: unknown): AiChatQuota | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const tier = value.tier === 'free' || value.tier === 'premium' ? value.tier : undefined;
  const limit = typeof value.limit === 'number' ? value.limit : undefined;
  const remaining = typeof value.remaining === 'number' ? value.remaining : undefined;
  const resetAt = typeof value.resetAt === 'string' ? value.resetAt : undefined;

  return {
    tier,
    limit,
    remaining,
    resetAt,
  };
}

function detailsFromPayload(payload: unknown, fallbackMessage: string): AiChatErrorDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const errorMessage =
    typeof payload.error === 'string'
      ? payload.error
      : typeof payload.message === 'string'
        ? payload.message
        : fallbackMessage;

  return {
    code: normalizeErrorCode(payload.code),
    message: errorMessage,
    quota: normalizeQuota(payload.quota),
    retryAfterSeconds:
      typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined,
  };
}

async function describeFunctionError(
  error: unknown,
  fallbackLabel: string,
): Promise<AiChatErrorDetails> {
  const fallbackMessage = error instanceof Error ? error.message : fallbackLabel;

  if (!error || typeof error !== 'object' || !('context' in error)) {
    return { message: fallbackMessage };
  }

  const context = (error as { context?: unknown }).context;

  if (!context || typeof context !== 'object') {
    return { message: fallbackMessage };
  }

  const response = context as {
    status?: number;
    clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  const statusPrefix = response.status ? `status ${response.status}` : 'request failed';

  try {
    const cloned = response.clone?.();
    const json = cloned && 'json' in cloned ? await cloned.json?.() : undefined;

    const details = detailsFromPayload(json, fallbackMessage);

    if (details) {
      return {
        ...details,
        message: `${statusPrefix}: ${details.message}`,
        status: response.status,
      };
    }
  } catch {
    // Fallback to text parsing below.
  }

  try {
    const cloned = response.clone?.();
    const text = cloned && 'text' in cloned ? await cloned.text?.() : undefined;

    if (text?.trim()) {
      return { message: `${statusPrefix}: ${text.trim()}`, status: response.status };
    }
  } catch {
    // Ignore and use fallback.
  }

  return { message: fallbackMessage, status: response.status };
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
    const details = await describeFunctionError(error, 'unknown error');
    throw new AiChatRequestError(`ai-chat failed: ${details.message}`, details);
  }
}
