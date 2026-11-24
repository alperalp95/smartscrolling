// "Karta Sor" ayarları. Kod bilmeyen biri de değiştirebilir: sadece tırnak
// içindeki metinleri ve sayıları düzenleyin. Değişiklikten sonra function'ı
// yeniden yüklemek (deploy) gerekir.

// Günlük soru hakkı (UTC gece yarısı sıfırlanır).
export const QUOTA = { free: 3, premium: 30 } as const;

// Hazır soru butonlarının yapay zekâya giden metni.
export const PRESETS = {
  why: 'Bu bilgi neden böyle? Nedenini açıkla.',
  more: 'Bu konuda kartta olmayan ama kaynakta geçen ilginç bir ayrıntı daha anlat.',
  simple: 'Bunu 12 yaşındaki birine anlatır gibi basitçe açıkla.',
} as const;

// Modeller sırayla denenir; biri meşgul/hatalı olursa sıradakine geçilir.
// apiKeyEnv: Supabase secret adı (anahtarın kendisi buraya YAZILMAZ).
export const MODELS = [
  {
    name: 'gemini-3.5-flash-lite',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKeyEnv: 'GEMINI_API_KEY',
    model: 'gemini-3.5-flash-lite',
    extraBody: {} as Record<string, unknown>,
    maxTokensField: 'max_tokens',
  },
  {
    name: 'groq-gpt-oss-20b',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    apiKeyEnv: 'GROQ_API_KEY',
    model: 'openai/gpt-oss-20b',
    extraBody: { reasoning_effort: 'low' } as Record<string, unknown>,
    maxTokensField: 'max_completion_tokens',
  },
] as const;

export const MAX_TOKENS = 500; // cevap uzunluğu üst sınırı
export const TIMEOUT_MS = 20000; // her model için bekleme süresi (ms)
export const MAX_QUESTION = 300; // serbest soru en fazla karakter
export const MAX_HISTORY = 4; // önceki mesajlardan son kaç tanesi gönderilir
export const MAX_HISTORY_CONTENT = 1200; // her önceki mesaj en fazla karakter
export const MAX_CONTEXT = 2400; // kaynak metni en fazla karakter
