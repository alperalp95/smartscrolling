import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MAX_TOKENS, MODELS, TIMEOUT_MS } from './config.ts';
import {
  type AttemptOutcome,
  type FactRow,
  buildMessages,
  checkAccess,
  classifyStatus,
  extractAnswer,
  nextUtcReset,
  parseRequest,
  parseRetryAfter,
  quotaLimit,
  resolveTier,
  runModelChain,
} from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function fail(status: number, code: string, error: string, extra: Record<string, unknown> = {}) {
  return json({ error, code, ...extra }, status);
}

// Log'a soru/cevap metni basılmaz; sadece kod, model, süre, kullanıcı id'sinin ilk 8 karakteri.
function log(code: string, userId: string, startedAt: number, model?: string) {
  console.log(
    JSON.stringify({
      fn: 'card-ask',
      code,
      model,
      ms: Date.now() - startedAt,
      user: userId.slice(0, 8),
    }),
  );
}

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'bad_request', 'Method not allowed');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('[card-ask] missing Supabase env');
    return fail(500, 'ai_failed', 'Server not configured');
  }

  // 1. Kimlik doğrulama
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail(401, 'auth_required', 'Authentication required');

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return fail(401, 'auth_required', 'Authentication required');
  const user = authData.user;

  // 2. Gövde doğrulama
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'bad_request', 'Invalid JSON body');
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return fail(400, 'bad_request', 'Invalid request');
  const request = parsed.value;

  // 3. Tier ve erişim (kota düşmeden)
  const tier = resolveTier(user.app_metadata);
  if (checkAccess(tier, request) === 'premium_required') {
    log('premium_required', user.id, startedAt);
    return fail(403, 'premium_required', 'Free-form questions require Premium');
  }

  // 4. Kartı oku (kota düşmeden)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: fact } = await admin
    .from('facts')
    .select('id,title,content,context_text,source_label,status')
    .eq('id', request.factId)
    .maybeSingle<FactRow>();
  if (!fact || fact.status !== 'published') {
    log('fact_not_found', user.id, startedAt);
    return fail(404, 'fact_not_found', 'Fact not found');
  }

  // 5. Kota (model hata verirse iade edilmez)
  const limit = quotaLimit(tier);
  const resetAt = nextUtcReset(new Date()).toISOString();
  const { data: quotaRows, error: quotaError } = await admin.rpc('consume_ai_quota', {
    p_user_id: user.id,
    p_limit: limit,
  });
  const quotaRow = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (quotaError || !quotaRow) {
    console.error('[card-ask] quota rpc failed:', quotaError?.message);
    log('quota_unavailable', user.id, startedAt);
    return fail(503, 'quota_unavailable', 'AI quota is temporarily unavailable');
  }
  if (!quotaRow.allowed) {
    log('quota_exceeded', user.id, startedAt);
    return fail(429, 'quota_exceeded', 'Daily limit reached', {
      quota: { tier, limit, remaining: 0, resetAt },
    });
  }

  // 6. Model zinciri
  const messages = buildMessages(fact, request);
  const result = await runModelChain(MODELS, async (m): Promise<AttemptOutcome> => {
    const apiKey = Deno.env.get(m.apiKeyEnv);
    if (!apiKey) {
      console.error(`[card-ask] missing secret ${m.apiKeyEnv}`);
      return { kind: 'fail' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(m.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: m.model,
          messages,
          temperature: 0.3,
          [m.maxTokensField]: MAX_TOKENS,
          ...m.extraBody,
        }),
      });
      const kind = classifyStatus(res.status);
      if (kind === 'rate_limited') {
        return {
          kind,
          retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')),
        };
      }
      if (kind === 'fail') return { kind };
      const answer = extractAnswer(await res.json());
      return answer ? { kind: 'ok', answer } : { kind: 'fail' };
    } catch {
      return { kind: 'fail' };
    } finally {
      clearTimeout(timer);
    }
  });

  if (!result.ok) {
    log(result.code, user.id, startedAt);
    if (result.code === 'ai_busy') {
      return fail(429, 'ai_busy', 'AI is busy', {
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
    return fail(502, 'ai_failed', 'AI request failed');
  }

  log('ok', user.id, startedAt, result.modelName);
  return json({
    answer: result.answer,
    presetId: request.presetId ?? null,
    quota: { tier, limit, remaining: quotaRow.remaining, resetAt },
  });
});
