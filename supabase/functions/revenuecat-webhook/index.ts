import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  type RevenueCatEvent,
  checkWebhookAuth,
  decidePremium,
  mergeAppMetadata,
  resolveUserId,
} from './logic.ts';

const headers = { 'Content-Type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = checkWebhookAuth(
    req.headers.get('Authorization'),
    Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
  );
  if (auth === 'misconfigured') {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET missing');
    return json({ error: 'Webhook not configured' }, 500);
  }
  if (auth !== 'ok') {
    return json({ error: 'Unauthorized' }, 401);
  }

  let event: RevenueCatEvent | undefined;
  try {
    const body = await req.json();
    event = body?.event;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!event || typeof event !== 'object') {
    return json({ error: 'Missing event' }, 400);
  }

  const type = String(event.type ?? 'UNKNOWN');
  const decision = decidePremium(event);
  if (decision.action === 'ignore') {
    console.log('[revenuecat-webhook] ignored', type, decision.reason);
    return json({ ignored: decision.reason });
  }

  const userId = resolveUserId(event);
  if (!userId) {
    console.log('[revenuecat-webhook] anonymous user', type);
    return json({ ignored: 'anonymous_user' });
  }
  const shortId = userId.slice(0, 8);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[revenuecat-webhook] missing Supabase admin env');
    return json({ error: 'Missing Supabase admin env' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError || !data?.user) {
    // Kullanıcı yok (silinmiş olabilir): RevenueCat tekrar denemesin.
    console.log('[revenuecat-webhook] user not found', type, shortId);
    return json({ ignored: 'user_not_found' });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: mergeAppMetadata(
      data.user.app_metadata as Record<string, unknown>,
      decision.premium,
      new Date().toISOString(),
    ),
  });
  if (updateError) {
    console.error('[revenuecat-webhook] update failed', type, shortId, updateError.message);
    return json({ error: 'Update failed' }, 500);
  }

  console.log('[revenuecat-webhook] updated', type, shortId, decision.premium);
  return json({ ok: true, premium: decision.premium });
});
