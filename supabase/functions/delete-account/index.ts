import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

type AuthResult =
  | {
      error: null;
      userId: string;
    }
  | {
      error: Response;
      userId: null;
    };

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const userOwnedTables = ['bookmarks', 'reading_progress', 'chat_sessions', 'user_activity'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

async function requireAuthenticatedUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      error: jsonResponse({ error: 'Authentication required', code: 'auth_required' }, 401),
      userId: null,
    };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: jsonResponse({ error: 'Missing Supabase env for auth verification' }, 500),
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
      userId: null,
    };
  }

  return {
    error: null,
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

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase admin env' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const table of userOwnedTables) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', authResult.userId);

    if (error) {
      console.error('[delete-account] cleanup failed:', table, error.message);
      return jsonResponse({ error: 'Account cleanup failed', table }, 500);
    }
  }

  const { error: profileDeleteError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', authResult.userId);

  if (profileDeleteError) {
    console.error('[delete-account] users cleanup failed:', profileDeleteError.message);
    return jsonResponse({ error: 'Account profile cleanup failed' }, 500);
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authResult.userId);

  if (authDeleteError) {
    console.error('[delete-account] auth deletion failed:', authDeleteError.message);
    return jsonResponse({ error: 'Auth user deletion failed' }, 500);
  }

  return jsonResponse({ deleted: true });
});
