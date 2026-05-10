import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const expoPushSendUrl = 'https://exp.host/--/api/v2/push/send';
const expoPushReceiptsUrl = 'https://exp.host/--/api/v2/push/getReceipts';
const maxSmokeTargets = 10;
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const expoPushAccessToken = Deno.env.get('EXPO_PUSH_ACCESS_TOKEN');

type PushTokenRow = {
  expo_push_token: string;
  id: string;
  platform: string;
};

type SmokeRequest =
  | {
      action?: 'send';
      body?: string;
      title?: string;
    }
  | {
      action?: 'receipts';
      ids?: string[];
    };

type AuthResult =
  | {
      error: null;
      token: string;
      userId: string;
    }
  | {
      error: Response;
      token: null;
      userId: null;
    };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function expoHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (expoPushAccessToken) {
    headers.Authorization = `Bearer ${expoPushAccessToken}`;
  }

  return headers;
}

function safeMessageText(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 140);
}

function summarizeTarget(token: PushTokenRow) {
  return {
    id: token.id,
    platform: token.platform,
    tokenSuffix: token.expo_push_token.slice(-8),
  };
}

async function readJson(req: Request): Promise<SmokeRequest | null> {
  try {
    return (await req.json()) as SmokeRequest;
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      error: jsonResponse({ error: 'Authentication required', code: 'auth_required' }, 401),
      token: null,
      userId: null,
    };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: jsonResponse({ error: 'Missing Supabase env for auth verification' }, 500),
      token: null,
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
      token: null,
      userId: null,
    };
  }

  return {
    error: null,
    token,
    userId: data.user.id,
  };
}

function createUserClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function fetchEnabledPushTokens(auth: AuthResult & { error: null }) {
  const supabase = createUserClient(auth.token);

  if (!supabase) {
    return {
      error: jsonResponse({ error: 'Missing Supabase env for token query' }, 500),
      tokens: null,
    };
  }

  const { data, error } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token, platform')
    .eq('user_id', auth.userId)
    .eq('enabled', true)
    .limit(maxSmokeTargets);

  if (error) {
    console.error('[remote-push-smoke] token query failed:', error.message);
    return {
      error: jsonResponse({ error: 'Push token query failed' }, 500),
      tokens: null,
    };
  }

  return {
    error: null,
    tokens: (data ?? []) as PushTokenRow[],
  };
}

async function sendSmokePush(reqBody: SmokeRequest, auth: AuthResult & { error: null }) {
  const tokenResult = await fetchEnabledPushTokens(auth);

  if (tokenResult.error) {
    return tokenResult.error;
  }

  const tokens = tokenResult.tokens ?? [];

  if (tokens.length === 0) {
    return jsonResponse(
      {
        code: 'no_enabled_push_tokens',
        error: 'No enabled push token found for this user',
      },
      404,
    );
  }

  const title = safeMessageText(
    'title' in reqBody ? reqBody.title : undefined,
    'SmartScrolling test',
  );
  const body = safeMessageText(
    'body' in reqBody ? reqBody.body : undefined,
    'Remote push smoke basarili.',
  );
  const messages = tokens.map((token) => ({
    to: token.expo_push_token,
    title,
    body,
    sound: 'default',
    data: {
      source: 'smartscrolling',
      kind: 'remote_push_smoke',
    },
  }));

  const expoResponse = await fetch(expoPushSendUrl, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify(messages),
  });
  const responseText = await expoResponse.text();
  let responseBody: unknown = responseText;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    // Keep raw response body for diagnostics.
  }

  console.log('[remote-push-smoke] send result:', {
    ok: expoResponse.ok,
    status: expoResponse.status,
    targetCount: tokens.length,
    userId: auth.userId,
  });

  const tickets =
    responseBody &&
    typeof responseBody === 'object' &&
    'data' in responseBody &&
    Array.isArray((responseBody as { data?: unknown }).data)
      ? ((responseBody as { data: Array<{ id?: string; status?: string }> }).data ?? [])
      : [];
  const ticketIds = tickets
    .map((ticket) => (ticket.status === 'ok' && ticket.id ? ticket.id : null))
    .filter((id): id is string => typeof id === 'string');

  return jsonResponse(
    {
      ok: expoResponse.ok,
      status: expoResponse.status,
      targets: tokens.map(summarizeTarget),
      targetCount: tokens.length,
      ticketIds,
      expo: responseBody,
    },
    expoResponse.ok ? 200 : 502,
  );
}

async function fetchReceipts(reqBody: SmokeRequest, auth: AuthResult & { error: null }) {
  const ids =
    'ids' in reqBody && Array.isArray(reqBody.ids)
      ? reqBody.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

  if (ids.length === 0) {
    return jsonResponse({ error: 'Receipt ids are required', code: 'missing_receipt_ids' }, 400);
  }

  const expoResponse = await fetch(expoPushReceiptsUrl, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids: ids.slice(0, 100) }),
  });
  const responseText = await expoResponse.text();
  let responseBody: unknown = responseText;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    // Keep raw response body for diagnostics.
  }

  console.log('[remote-push-smoke] receipt result:', {
    ok: expoResponse.ok,
    receiptCount: ids.length,
    status: expoResponse.status,
    userId: auth.userId,
  });

  return jsonResponse(
    {
      ok: expoResponse.ok,
      status: expoResponse.status,
      receiptIds: ids.slice(0, 100),
      expo: responseBody,
    },
    expoResponse.ok ? 200 : 502,
  );
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

  const body = await readJson(req);

  if (!body) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action === 'send') {
    return sendSmokePush(body, authResult);
  }

  if (body.action === 'receipts') {
    return fetchReceipts(body, authResult);
  }

  return jsonResponse({ error: 'Unsupported action', code: 'unsupported_action' }, 400);
});
