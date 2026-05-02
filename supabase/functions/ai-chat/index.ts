import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  question?: string;
  context?: string;
  bookTitle?: string;
  history?: ChatMessage[];
};

type AuthenticatedUser = {
  app_metadata?: Record<string, unknown>;
  id: string;
};

type AuthResult =
  | {
      error: null;
      user: AuthenticatedUser;
      userId: string;
    }
  | {
      error: Response;
      user: null;
      userId: null;
    };

type QuotaTier = 'free' | 'premium';

const groqApiKey = Deno.env.get('GROQ_API_KEY');
const groqModel = Deno.env.get('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const upstashRedisRestUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')?.replace(/\/+$/, '');
const upstashRedisRestToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
const MAX_CONTEXT_CHARS = 4000;
const QUOTA_LIMITS: Record<QuotaTier, number> = {
  free: 5,
  premium: 50,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function sanitizeHistory(history: ChatMessage[] | undefined) {
  return (history ?? [])
    .filter((message) => message?.role && message?.content)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function sanitizeContext(context?: string) {
  const normalized = context?.trim();

  if (!normalized) {
    return 'Baglam verilmedi.';
  }

  if (normalized.length <= MAX_CONTEXT_CHARS) {
    return normalized;
  }

  return normalized.slice(0, MAX_CONTEXT_CHARS);
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds, 86_400);
  }

  const retryDateMs = Date.parse(value);

  if (!Number.isFinite(retryDateMs)) {
    return null;
  }

  const deltaSeconds = Math.ceil((retryDateMs - Date.now()) / 1000);

  if (deltaSeconds < 0) {
    return 0;
  }

  return Math.min(deltaSeconds, 86_400);
}

function getUtcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getNextUtcReset(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
}

function getQuotaTtlSeconds(now = new Date()) {
  const resetAt = getNextUtcReset(now);
  return Math.max(60, Math.ceil((resetAt.getTime() - now.getTime()) / 1000) + 300);
}

function getQuotaKey(userId: string, now = new Date()) {
  return `ai_chat_quota:${getUtcDayKey(now)}:${userId}`;
}

function buildRedisCommandUrl(command: string, ...args: Array<number | string>) {
  if (!upstashRedisRestUrl) {
    return null;
  }

  return [upstashRedisRestUrl, command, ...args.map((arg) => encodeURIComponent(String(arg)))].join(
    '/',
  );
}

async function runRedisCommand<T>(command: string, ...args: Array<number | string>) {
  if (!upstashRedisRestToken) {
    throw new Error('missing_upstash_secret');
  }

  const url = buildRedisCommandUrl(command, ...args);

  if (!url) {
    throw new Error('missing_upstash_url');
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${upstashRedisRestToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`upstash_${response.status}`);
  }

  const body = (await response.json()) as { error?: string; result?: T };

  if (body.error) {
    throw new Error('upstash_command_error');
  }

  return body.result as T;
}

function resolveQuotaTier(user: AuthenticatedUser): QuotaTier {
  const metadata = user.app_metadata ?? {};

  if (metadata.premium === true || metadata.entitlement === 'premium') {
    return 'premium';
  }

  if (Array.isArray(metadata.entitlements) && metadata.entitlements.includes('premium')) {
    return 'premium';
  }

  return 'free';
}

async function enforceAiChatQuota(user: AuthenticatedUser) {
  const now = new Date();
  const tier = resolveQuotaTier(user);
  const limit = QUOTA_LIMITS[tier];
  const resetAt = getNextUtcReset(now);
  const key = getQuotaKey(user.id, now);

  try {
    const count = Number(await runRedisCommand<number>('incr', key));

    if (!Number.isFinite(count)) {
      throw new Error('invalid_upstash_count');
    }

    if (count === 1) {
      await runRedisCommand<number>('expire', key, getQuotaTtlSeconds(now));
    }

    return {
      ok: count <= limit,
      quota: {
        tier,
        limit,
        remaining: Math.max(limit - count, 0),
        resetAt: resetAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('[ai-chat] quota check failed:', error instanceof Error ? error.message : error);
    return {
      error: jsonResponse(
        {
          error: 'AI quota is temporarily unavailable',
          code: 'quota_unavailable',
        },
        503,
      ),
    };
  }
}

async function requireAuthenticatedUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      error: jsonResponse({ error: 'Authentication required', code: 'auth_required' }, 401),
      user: null,
      userId: null,
    };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: jsonResponse({ error: 'Missing Supabase env for auth verification' }, 500),
      user: null,
      userId: null,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: jsonResponse({ error: 'Authentication required', code: 'auth_required' }, 401),
      user: null,
      userId: null,
    };
  }

  return {
    error: null,
    user: {
      app_metadata: data.user.app_metadata,
      id: data.user.id,
    },
    userId: data.user.id,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await requireAuthenticatedUser(req);

  if (authResult.error) {
    return authResult.error;
  }

  if (!authResult.userId || !authResult.user) {
    return jsonResponse({ error: 'Authentication required', code: 'auth_required' }, 401);
  }

  if (!groqApiKey) {
    return jsonResponse({ error: 'Missing GROQ_API_KEY secret' }, 500);
  }

  let payload: ChatRequest;

  try {
    payload = (await req.json()) as ChatRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const question = payload.question?.trim();

  if (!question) {
    return jsonResponse({ error: 'question is required' }, 400);
  }

  const quotaResult = await enforceAiChatQuota(authResult.user);

  if ('error' in quotaResult) {
    return quotaResult.error;
  }

  if (!quotaResult.ok) {
    return jsonResponse(
      {
        error: 'Daily AI chat limit reached',
        code: 'quota_exceeded',
        quota: quotaResult.quota,
      },
      429,
    );
  }

  const history = sanitizeHistory(payload.history);
  const messages = [
    {
      role: 'system',
      content: [
        'Sen Turkce bilen, kitap baglaminda net ve yardimci cevap veren bir okuma asistanisin.',
        'Cevaplarini kisa, dogrudan ve baglamli ver.',
        'Eger verilen baglam yetersizse bunu acikca belirt ama uydurma bilgi verme.',
        `Aktif kitap: ${payload.bookTitle?.trim() || 'Bilinmiyor'}`,
        `Aktif baglam: ${sanitizeContext(payload.context)}`,
      ].join('\n'),
    },
    ...history,
    {
      role: 'user',
      content: question,
    },
  ];

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.4,
      messages,
    }),
  });

  if (!groqResponse.ok) {
    if (groqResponse.status === 429) {
      const retryAfterSeconds = parseRetryAfterSeconds(groqResponse.headers.get('retry-after'));
      console.warn('[ai-chat] Groq rate limited:', { retryAfterSeconds });

      return jsonResponse(
        {
          error: 'AI is temporarily busy',
          code: 'groq_rate_limited',
          ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
        },
        429,
      );
    }

    const groqErrorText = await groqResponse.text();
    console.error('[ai-chat] Groq API error:', groqResponse.status, groqErrorText);
    return jsonResponse({ error: 'Groq request failed' }, 502);
  }

  const groqData = await groqResponse.json();
  const answer = groqData?.choices?.[0]?.message?.content;

  if (typeof answer !== 'string' || !answer.trim()) {
    return jsonResponse({ error: 'Invalid Groq response' }, 502);
  }

  return jsonResponse({
    answer: answer.trim(),
    model: groqModel,
    history,
  });
});
