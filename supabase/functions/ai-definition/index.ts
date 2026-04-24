import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

type DefinitionRequest = {
  word?: string;
  context?: string;
  bookTitle?: string;
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

function buildPrompt(input: { word: string; context?: string; bookTitle?: string }) {
  return [
    'Sen Turkce bilen bir okuma asistani ve edebi baglam yorumcususun.',
    'Kisa, net ve baglamsal aciklamalar uret.',
    'Yanitini yalnizca gecerli JSON olarak don.',
    'JSON seklinde su alanlari don: {"definition":"string","explanation":"string","confidence":"high|medium|low"}',
    'Definition alani en fazla 2 cumle olsun.',
    'Explanation alani kelimenin bu metindeki rolunu 2-3 cumlede anlatsin.',
    'Baglam yetersizse bunu acikca belirt ama tahmin uydurma.',
    `Kelime: ${input.word}`,
    `Kitap: ${input.bookTitle ?? 'Bilinmiyor'}`,
    `Baglam: ${sanitizeContext(input.context)}`,
  ].join('\n');
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

  let payload: DefinitionRequest;

  try {
    payload = (await req.json()) as DefinitionRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const word = payload.word?.trim();

  if (!word) {
    return jsonResponse({ error: 'word is required' }, 400);
  }

  const prompt = buildPrompt({
    word,
    context: payload.context?.trim(),
    bookTitle: payload.bookTitle?.trim(),
  });

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Sen guvenilir bir Turkce okuma asistanisin. Yanitlarini yalnizca istenen JSON seklinde ver.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!groqResponse.ok) {
    const groqErrorText = await groqResponse.text();
    console.error('[ai-definition] Groq API error:', groqResponse.status, groqErrorText);
    return jsonResponse({ error: 'Groq request failed' }, 502);
  }

  const groqData = await groqResponse.json();
  const content = groqData?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    return jsonResponse({ error: 'Invalid Groq response' }, 502);
  }

  try {
    const parsed = JSON.parse(content) as {
      definition?: string;
      explanation?: string;
      confidence?: 'high' | 'medium' | 'low';
    };

    return jsonResponse({
      word,
      definition: parsed.definition?.trim() ?? '',
      explanation: parsed.explanation?.trim() ?? '',
      confidence: parsed.confidence ?? 'medium',
      model: groqModel,
    });
  } catch (error) {
    console.error('[ai-definition] JSON parse error:', error);
    return jsonResponse({ error: 'Unable to parse Groq response' }, 502);
  }
});
