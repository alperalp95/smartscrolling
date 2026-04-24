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

const groqApiKey = Deno.env.get('GROQ_API_KEY');
const groqModel = Deno.env.get('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const MAX_CONTEXT_CHARS = 4000;

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

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { error: jsonResponse({ error: 'Missing bearer token' }, 401), userId: null };
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
    return { error: jsonResponse({ error: 'Invalid auth token' }, 401), userId: null };
  }

  return { error: null, userId: data.user.id };
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
