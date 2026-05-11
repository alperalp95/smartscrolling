const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const expoPushSendUrl = 'https://exp.host/--/api/v2/push/send';
const expoPushReceiptsUrl = 'https://exp.host/--/api/v2/push/getReceipts';
const freshWindowHours = 3;
const expoChunkSize = 100;
const tokenPageSize = 1000;
const defaultTitle = 'Yeni kartlar hazir';
const defaultBody = 'Bugun yeni bilgiler seni bekliyor.';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const expoPushAccessToken = Deno.env.get('EXPO_PUSH_ACCESS_TOKEN');

type ContentPushRequest =
  | {
      action?: 'send';
    }
  | {
      action?: 'receipts';
      ids?: string[];
    };

type FactSummary = {
  category: string;
  created_at: string | null;
  id: string;
  title: string;
};

type PushTokenRow = {
  expo_push_token: string;
  id: string;
  platform: string;
  user_id: string;
};

type InternalAuth =
  | {
      error: null;
      token: string;
    }
  | {
      error: Response;
      token: null;
    };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  return authHeader?.replace(/^Bearer\s+/i, '').trim() ?? null;
}

function requireInternalAuth(req: Request): InternalAuth {
  const token = getBearerToken(req);

  if (!token) {
    return {
      error: jsonResponse({ error: 'Internal authorization required', code: 'internal_auth' }, 401),
      token: null,
    };
  }

  return {
    error: null,
    token,
  };
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function summarizeTarget(token: PushTokenRow) {
  return {
    id: token.id,
    platform: token.platform,
    tokenSuffix: token.expo_push_token.slice(-8),
    userId: token.user_id,
  };
}

async function readJson(req: Request): Promise<ContentPushRequest | null> {
  try {
    return (await req.json()) as ContentPushRequest;
  } catch {
    return null;
  }
}

function serviceHeaders(serviceToken: string, extraHeaders?: Record<string, string>) {
  return {
    apikey: serviceToken,
    Authorization: `Bearer ${serviceToken}`,
    ...extraHeaders,
  };
}

async function fetchSupabaseRest(
  serviceToken: string,
  path: string,
  extraHeaders?: Record<string, string>,
) {
  const headers = serviceHeaders(serviceToken, extraHeaders);

  if (!supabaseUrl) {
    return {
      error: jsonResponse({ error: 'Missing Supabase env for REST query' }, 500),
      response: null,
    };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[content-freshness-push] Supabase REST query failed:', {
      body,
      path,
      status: response.status,
    });
    return {
      error: jsonResponse(
        {
          error: 'Supabase REST query failed',
          status: response.status,
          code:
            response.status === 401 || response.status === 403
              ? 'internal_auth_failed'
              : 'supabase_rest_failed',
        },
        response.status === 401 || response.status === 403 ? 401 : 500,
      ),
      response: null,
    };
  }

  return {
    error: null,
    response,
  };
}

async function fetchFreshFacts(serviceToken: string) {
  const cutoff = new Date(Date.now() - freshWindowHours * 60 * 60 * 1000).toISOString();
  const path = `facts?select=id,title,category,created_at&created_at=gte.${encodeURIComponent(
    cutoff,
  )}&order=created_at.desc&limit=25`;
  const result = await fetchSupabaseRest(serviceToken, path, { Prefer: 'count=exact' });

  if (result.error || !result.response) {
    return {
      cutoff,
      error: result.error,
      facts: null,
      freshFactCount: 0,
    };
  }

  const contentRange = result.response.headers.get('content-range');
  const countText = contentRange?.split('/')[1];
  const data = (await result.response.json()) as FactSummary[];

  return {
    cutoff,
    error: null,
    facts: data,
    freshFactCount: countText && countText !== '*' ? Number(countText) : data.length,
  };
}

async function fetchEnabledPushTargets(serviceToken: string) {
  const allTokens: PushTokenRow[] = [];

  for (let offset = 0; ; offset += tokenPageSize) {
    const path = `push_tokens?select=id,expo_push_token,platform,user_id,users!inner(notifications_enabled)&enabled=eq.true&revoked_at=is.null&users.notifications_enabled=eq.true&limit=${tokenPageSize}&offset=${offset}`;
    const result = await fetchSupabaseRest(serviceToken, path);

    if (result.error || !result.response) {
      return {
        error: result.error,
        tokens: null,
      };
    }

    const page = (await result.response.json()) as PushTokenRow[];
    allTokens.push(...page);

    if (page.length < tokenPageSize) {
      break;
    }
  }

  const deduped = new Map<string, PushTokenRow>();

  for (const token of allTokens) {
    if (!deduped.has(token.expo_push_token)) {
      deduped.set(token.expo_push_token, token);
    }
  }

  return {
    error: null,
    tokens: [...deduped.values()],
  };
}

function extractTicketIds(responseBody: unknown) {
  const tickets =
    responseBody &&
    typeof responseBody === 'object' &&
    'data' in responseBody &&
    Array.isArray((responseBody as { data?: unknown }).data)
      ? ((responseBody as { data: Array<{ id?: string; status?: string }> }).data ?? [])
      : [];

  return tickets
    .map((ticket) => (ticket.status === 'ok' && ticket.id ? ticket.id : null))
    .filter((id): id is string => typeof id === 'string');
}

async function postExpoMessages(messages: Array<Record<string, unknown>>) {
  const chunks = chunkArray(messages, expoChunkSize);
  const ticketIds: string[] = [];
  const expoResponses: Array<{
    body: unknown;
    chunkIndex: number;
    ok: boolean;
    status: number;
  }> = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const expoResponse = await fetch(expoPushSendUrl, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify(chunk),
    });
    const responseText = await expoResponse.text();
    let responseBody: unknown = responseText;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // Keep raw response body for diagnostics.
    }

    ticketIds.push(...extractTicketIds(responseBody));
    expoResponses.push({
      body: responseBody,
      chunkIndex,
      ok: expoResponse.ok,
      status: expoResponse.status,
    });

    if (!expoResponse.ok) {
      break;
    }
  }

  return {
    expoResponses,
    ok: expoResponses.every((response) => response.ok),
    ticketIds,
  };
}

async function sendContentFreshnessPush(auth: InternalAuth & { error: null }) {
  const freshFactsResult = await fetchFreshFacts(auth.token);

  if (freshFactsResult.error) {
    return freshFactsResult.error;
  }

  if (freshFactsResult.freshFactCount < 1) {
    console.log('[content-freshness-push] skipped: no fresh facts', {
      cutoff: freshFactsResult.cutoff,
    });
    return jsonResponse({
      sent: false,
      reason: 'no_fresh_facts',
      cutoff: freshFactsResult.cutoff,
      freshFactCount: freshFactsResult.freshFactCount,
      targetCount: 0,
      ticketIds: [],
    });
  }

  const targetResult = await fetchEnabledPushTargets(auth.token);

  if (targetResult.error) {
    return targetResult.error;
  }

  const targets = targetResult.tokens ?? [];

  if (targets.length === 0) {
    console.log('[content-freshness-push] skipped: no enabled push targets', {
      freshFactCount: freshFactsResult.freshFactCount,
    });
    return jsonResponse({
      sent: false,
      reason: 'no_enabled_push_targets',
      cutoff: freshFactsResult.cutoff,
      freshFactCount: freshFactsResult.freshFactCount,
      targetCount: 0,
      ticketIds: [],
    });
  }

  const messages = targets.map((target) => ({
    to: target.expo_push_token,
    title: defaultTitle,
    body: defaultBody,
    sound: 'default',
    data: {
      source: 'smartscrolling',
      kind: 'content_freshness',
      freshnessWindowHours: freshWindowHours,
    },
  }));

  const expoResult = await postExpoMessages(messages);

  console.log('[content-freshness-push] send result:', {
    chunkCount: expoResult.expoResponses.length,
    freshFactCount: freshFactsResult.freshFactCount,
    ok: expoResult.ok,
    targetCount: targets.length,
    ticketCount: expoResult.ticketIds.length,
  });

  return jsonResponse(
    {
      sent: expoResult.ok,
      cutoff: freshFactsResult.cutoff,
      freshFactCount: freshFactsResult.freshFactCount,
      freshFacts: freshFactsResult.facts,
      targetCount: targets.length,
      targets: targets.slice(0, 10).map(summarizeTarget),
      ticketIds: expoResult.ticketIds,
      expo: expoResult.expoResponses,
    },
    expoResult.ok ? 200 : 502,
  );
}

async function fetchReceipts(reqBody: ContentPushRequest) {
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
    body: JSON.stringify({ ids: ids.slice(0, 1000) }),
  });
  const responseText = await expoResponse.text();
  let responseBody: unknown = responseText;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    // Keep raw response body for diagnostics.
  }

  console.log('[content-freshness-push] receipt result:', {
    ok: expoResponse.ok,
    receiptCount: ids.length,
    status: expoResponse.status,
  });

  return jsonResponse(
    {
      ok: expoResponse.ok,
      status: expoResponse.status,
      receiptIds: ids.slice(0, 1000),
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

  const authResult = requireInternalAuth(req);

  if (authResult.error) {
    return authResult.error;
  }

  const body = await readJson(req);

  if (!body) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action === 'send') {
    return sendContentFreshnessPush(authResult);
  }

  if (body.action === 'receipts') {
    return fetchReceipts(body);
  }

  return jsonResponse({ error: 'Unsupported action', code: 'unsupported_action' }, 400);
});
