// src/llm/providers/openai-compatible.js
// Groq, Cloudflare (/ai/v1) ve Gemini (/v1beta/openai) için ortak OpenAI-uyumlu
// /chat/completions istek kurma + yanıt ayrıştırma + HTTP hata sınıflandırma.
import { ProviderCallError } from '../errors.js';

export function trimSlash(url) {
  return String(url).replace(/\/+$/, '');
}

/**
 * @param {object} o
 * @param {string} o.url              tam /chat/completions adresi
 * @param {string} o.apiKey           Bearer token (log'a yazılmaz)
 * @param {string} o.model
 * @param {Array}  o.messages
 * @param {boolean} [o.json]          JSON istendi mi
 * @param {boolean} [o.jsonMode]      sağlayıcı response_format destekliyor mu
 * @param {number} [o.maxTokens]
 * @param {string} [o.maxTokensField] 'max_tokens' | 'max_completion_tokens'
 * @param {object} [o.params]         config'teki ek gövde alanları (ör. reasoning_effort)
 */
export function buildOpenAiChatRequest({
  url,
  apiKey,
  model,
  messages,
  json = false,
  jsonMode = false,
  maxTokens,
  maxTokensField = 'max_tokens',
  params = {},
}) {
  const body = { model, messages, ...params };
  if (maxTokens) body[maxTokensField] = maxTokens;
  if (json && jsonMode) body.response_format = { type: 'json_object' };
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    },
  };
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('');
  }
  return '';
}

export function parseOpenAiChatResponse(body) {
  const message = body?.choices?.[0]?.message;
  if (!message) {
    throw new ProviderCallError('fatal', 'yanıtta choices[0].message yok');
  }
  // Akıl yürütme ayrı alanda gelirse (reasoning / reasoning_content) içerik sayılmaz.
  const text = contentToText(message.content);
  const usage = body.usage ?? {};
  const finishReason = body.choices[0].finish_reason ?? body.choices[0].finishReason ?? null;
  return {
    text,
    finishReason: typeof finishReason === 'string' ? finishReason.toLowerCase() : null,
    usage: {
      inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0,
      outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0,
    },
  };
}

const UNAVAILABLE_RE =
  /model_decommissioned|model_not_found|decommissioned|no such model|model .{0,80}(does not exist|not found|is not supported)|unknown model/i;
const QUOTA_RE =
  /tokens per day|requests per day|\(TPD\)|\(RPD\)|per[_ ]day|daily free allocation|daily limit|quota exceeded|exceeded your current quota/i;
const JSON_FAIL_RE = /json_validate_failed|failed to validate json|JSON Mode couldn't be met/i;

export function parseRetryAfterMs(headers) {
  const raw = headers?.get?.('retry-after');
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

/**
 * Groq 429 gövdesindeki "Please try again in 7.5s" / "in 650ms" / "in 1m2.5s" ipucu (başlık yoksa).
 * @returns {number|undefined} milisaniye
 */
export function parseRetryHintMs(bodyText) {
  const m = String(bodyText ?? '').match(/try again in\s+(?:(\d+)m(?!s))?\s*(?:(\d+(?:\.\d+)?)(ms|s))?/i);
  if (!m || (!m[1] && !m[2])) return undefined;
  const minutes = Number(m[1] ?? 0);
  const value = Number(m[2] ?? 0);
  const ms = m[3]?.toLowerCase() === 'ms' ? value : value * 1000;
  return Math.ceil(minutes * 60000 + ms);
}

function extractFailedGeneration(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    return parsed?.error?.failed_generation;
  } catch {
    return undefined;
  }
}

/**
 * HTTP hata yanıtını sınıflandırır.
 * - unavailable: 404 / model kapatıldı / model yok -> hemen sonraki sağlayıcı
 * - quota: günlük kota bitti -> bugün için atla (tekrar denemek boşuna)
 * - retryable: 429 / 5xx -> üstel bekleme
 * - invalid_json: JSON modu geçerli JSON üretemedi -> tamir denemesi
 * - fatal: diğer 4xx (401/403/400...) -> sonraki sağlayıcı, tekrar yok
 */
export function classifyHttpFailure(status, bodyText = '', headers) {
  const snippet = String(bodyText).slice(0, 300);
  const msg = `HTTP ${status}: ${snippet}`;
  if (status === 404 || UNAVAILABLE_RE.test(bodyText)) {
    return new ProviderCallError('unavailable', msg, { status });
  }
  if (status === 429 && QUOTA_RE.test(bodyText)) {
    return new ProviderCallError('quota', msg, { status });
  }
  if (status === 429 || status === 408 || status === 498 || status >= 500) {
    return new ProviderCallError('retryable', msg, {
      status,
      retryAfterMs: parseRetryAfterMs(headers) ?? parseRetryHintMs(bodyText),
    });
  }
  if (JSON_FAIL_RE.test(bodyText)) {
    return new ProviderCallError('invalid_json', msg, {
      status,
      failedGeneration: extractFailedGeneration(bodyText),
    });
  }
  return new ProviderCallError('fatal', msg, { status });
}
