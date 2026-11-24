import {
  MAX_CONTEXT,
  MAX_HISTORY,
  MAX_HISTORY_CONTENT,
  MAX_QUESTION,
  PRESETS,
  QUOTA,
} from './config.ts';

export type PresetId = keyof typeof PRESETS;
export type Tier = 'free' | 'premium';
export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

export type AskRequest = {
  factId: string;
  presetId?: PresetId;
  question?: string;
  history: HistoryMessage[];
};

export type FactRow = {
  id: string;
  title: string;
  content: string;
  context_text: string | null;
  source_label: string | null;
  status: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRequest(body: unknown): { ok: true; value: AskRequest } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false };
  const b = body as Record<string, unknown>;

  if (typeof b.factId !== 'string' || !UUID_RE.test(b.factId)) return { ok: false };

  const hasPreset = b.presetId !== undefined && b.presetId !== null;
  const hasQuestion = b.question !== undefined && b.question !== null;
  if (hasPreset === hasQuestion) return { ok: false };

  let presetId: PresetId | undefined;
  let question: string | undefined;

  if (hasPreset) {
    if (typeof b.presetId !== 'string' || !Object.hasOwn(PRESETS, b.presetId)) return { ok: false };
    presetId = b.presetId as PresetId;
  } else {
    if (typeof b.question !== 'string') return { ok: false };
    const q = b.question.trim().replace(/\s+/g, ' ');
    if (!q || q.length > MAX_QUESTION) return { ok: false };
    question = q;
  }

  return {
    ok: true,
    value: {
      factId: b.factId,
      presetId,
      question,
      history: sanitizeHistory(b.history),
    },
  };
}

export function sanitizeHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  const out: HistoryMessage[] = [];
  for (const m of history) {
    if (!m || typeof m !== 'object') continue;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = content.trim().slice(0, MAX_HISTORY_CONTENT);
    if (!text) continue;
    out.push({ role, content: text });
  }
  return out.slice(-MAX_HISTORY);
}

export function resolveTier(appMetadata: Record<string, unknown> | undefined | null): Tier {
  return appMetadata?.premium === true ? 'premium' : 'free';
}

export function quotaLimit(tier: Tier): number {
  return QUOTA[tier];
}

/** Ücretsiz kullanıcı serbest soru yazamaz; sadece hazır sorular. */
export function checkAccess(
  tier: Tier,
  req: Pick<AskRequest, 'question'>,
): 'ok' | 'premium_required' {
  return tier === 'free' && req.question !== undefined ? 'premium_required' : 'ok';
}

export function nextUtcReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export const SYSTEM_PROMPT =
  "Türkçe bilgi kartı asistanısın. Sadece aşağıdaki KART ve KAYNAK metnine dayan. Kaynakta olmayan bir şey sorulursa 'Kaynakta bu bilgi yok.' de ve uydurma. En fazla 5 cümle, sade Türkçe. Okura seslenme kalıpları ve emoji kullanma. Siyasi yorum yapma.";

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export function buildMessages(fact: FactRow, req: AskRequest): ChatMessage[] {
  const context = fact.context_text?.trim() ? fact.context_text.trim().slice(0, MAX_CONTEXT) : '—';
  const system = [
    SYSTEM_PROMPT,
    '',
    `KART BAŞLIĞI: ${fact.title}`,
    `KART: ${fact.content}`,
    `KAYNAK: ${context}`,
    `KAYNAK ADI: ${fact.source_label?.trim() || '—'}`,
  ].join('\n');

  const userText = req.presetId ? PRESETS[req.presetId] : (req.question ?? '');
  return [{ role: 'system', content: system }, ...req.history, { role: 'user', content: userText }];
}

// --- Model zinciri ---------------------------------------------------------

export type AttemptOutcome =
  | { kind: 'ok'; answer: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null }
  | { kind: 'fail' }; // 5xx, zaman aşımı, boş cevap, ağ hatası

export type ChainResult =
  | { ok: true; answer: string; modelName: string }
  | { ok: false; code: 'ai_busy'; retryAfterSeconds: number }
  | { ok: false; code: 'ai_failed' };

export const DEFAULT_RETRY_AFTER_SECONDS = 30;

export async function runModelChain<M extends { name: string }>(
  models: readonly M[],
  attempt: (model: M) => Promise<AttemptOutcome>,
): Promise<ChainResult> {
  let rateLimited = 0;
  let maxRetry = 0;
  for (const model of models) {
    const outcome = await attempt(model);
    if (outcome.kind === 'ok') return { ok: true, answer: outcome.answer, modelName: model.name };
    if (outcome.kind === 'rate_limited') {
      rateLimited += 1;
      maxRetry = Math.max(maxRetry, outcome.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS);
    }
  }
  if (models.length > 0 && rateLimited === models.length) {
    return { ok: false, code: 'ai_busy', retryAfterSeconds: maxRetry };
  }
  return { ok: false, code: 'ai_failed' };
}

/** HTTP durumunu zincir sonucuna çevirir (cevap metni ayrı okunur). */
export function classifyStatus(status: number): 'ok' | 'rate_limited' | 'fail' {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429) return 'rate_limited';
  return 'fail';
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const s = Number.parseInt(value, 10);
  if (Number.isFinite(s) && s >= 0) return Math.min(s, 86_400);
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return Math.min(Math.max(Math.ceil((t - now) / 1000), 0), 86_400);
}

export function extractAnswer(json: unknown): string | null {
  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== 'string') return null;
  const t = content.trim();
  return t || null;
}
