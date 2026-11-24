export const CARD_ASK_PRESETS = [
  { id: 'why', label: 'Neden böyle?' },
  { id: 'more', label: 'Daha fazla anlat' },
  { id: 'simple', label: 'Basitçe açıkla' },
] as const;

export type CardAskPresetId = (typeof CARD_ASK_PRESETS)[number]['id'];

export const CARD_ASK_MAX_QUESTION = 300;
export const CARD_ASK_MAX_HISTORY = 4;
const CARD_ASK_MAX_HISTORY_CONTENT = 1200;

export type CardAskMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type CardAskQuota = {
  tier?: 'free' | 'premium';
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

export type CardAskResult = {
  answer: string;
  presetId: string | null;
  quota: CardAskQuota;
};

export type CardAskInput = {
  factId: string;
  presetId?: CardAskPresetId;
  question?: string;
  history?: CardAskMessage[];
};

export type CardAskDeps = {
  invoke: (
    name: string,
    options: { body: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: unknown }>;
};

export class CardAskError extends Error {
  code: string;
  status?: number;
  quota?: CardAskQuota;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    details: {
      code: string;
      status?: number;
      quota?: CardAskQuota;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = 'CardAskError';
    this.code = details.code;
    this.status = details.status;
    this.quota = details.quota;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

export function normalizeQuestion(
  text: string,
): { ok: true; value: string } | { ok: false; reason: 'empty' | 'too_long' } {
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value) {
    return { ok: false, reason: 'empty' };
  }
  if (value.length > CARD_ASK_MAX_QUESTION) {
    return { ok: false, reason: 'too_long' };
  }
  return { ok: true, value };
}

export function buildHistory(messages: readonly { role: string; content: string }[]) {
  return messages
    .filter(
      (m): m is CardAskMessage =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    )
    .slice(-CARD_ASK_MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, CARD_ASK_MAX_HISTORY_CONTENT),
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function normalizeQuota(value: unknown): CardAskQuota | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    tier: value.tier === 'free' || value.tier === 'premium' ? value.tier : undefined,
    limit: typeof value.limit === 'number' ? value.limit : undefined,
    remaining: typeof value.remaining === 'number' ? value.remaining : undefined,
    resetAt: typeof value.resetAt === 'string' ? value.resetAt : undefined,
  };
}

async function toCardAskError(error: unknown): Promise<CardAskError> {
  const fallbackMessage = error instanceof Error ? error.message : 'card-ask failed';
  const context =
    error && typeof error === 'object' ? (error as { context?: unknown }).context : undefined;

  if (context && typeof context === 'object') {
    const response = context as {
      status?: number;
      clone?: () => { json?: () => Promise<unknown> };
    };
    try {
      const cloned = response.clone?.();
      const json = cloned?.json ? await cloned.json() : undefined;
      if (isRecord(json) && typeof json.code === 'string') {
        return new CardAskError(typeof json.error === 'string' ? json.error : fallbackMessage, {
          code: json.code,
          status: response.status,
          quota: normalizeQuota(json.quota),
          retryAfterSeconds:
            typeof json.retryAfterSeconds === 'number' ? json.retryAfterSeconds : undefined,
        });
      }
    } catch {
      // Gövde okunamadı; network olarak ele alınır.
    }
    return new CardAskError(fallbackMessage, {
      code: 'network',
      status: response.status,
    });
  }

  return new CardAskError(fallbackMessage, { code: 'network' });
}

async function defaultInvoke(
  name: string,
  options: { body: Record<string, unknown> },
): Promise<{ data: unknown; error: unknown }> {
  const { supabase } = await import('./supabase');
  return supabase.functions.invoke(name, options);
}

export async function askCard(
  input: CardAskInput,
  deps: CardAskDeps = { invoke: defaultInvoke },
): Promise<CardAskResult> {
  const hasPreset = Boolean(input.presetId);
  const hasQuestion = input.question !== undefined && input.question !== '';

  if (hasPreset === hasQuestion) {
    throw new CardAskError('presetId or question must be provided (exactly one)', {
      code: 'bad_request',
    });
  }

  const body: Record<string, unknown> = { factId: input.factId };

  if (hasPreset) {
    body.presetId = input.presetId;
  } else {
    const normalized = normalizeQuestion(input.question ?? '');
    if (!normalized.ok) {
      throw new CardAskError(`invalid question: ${normalized.reason}`, {
        code: 'bad_request',
      });
    }
    body.question = normalized.value;
  }

  if (input.history && input.history.length > 0) {
    body.history = buildHistory(input.history);
  }

  let data: unknown;
  try {
    const result = await deps.invoke('card-ask', { body });
    if (result.error) {
      throw result.error;
    }
    data = result.data;
  } catch (error) {
    if (error instanceof CardAskError) {
      throw error;
    }
    throw await toCardAskError(error);
  }

  return data as CardAskResult;
}

export function cardAskErrorMessage(
  err: { code?: string; quota?: CardAskQuota; retryAfterSeconds?: number } | null | undefined,
  { hasPremium }: { hasPremium: boolean },
): string {
  switch (err?.code) {
    case 'quota_exceeded':
      if (hasPremium) {
        return 'Bugünkü soru hakkın doldu. Yarın yenilenir.';
      }
      return `Bugünkü ${err.quota?.limit ?? 3} soru hakkını kullandın. Premium ile günde 30 soru sorabilirsin.`;
    case 'premium_required':
      return "Kendi sorunu yazmak Premium'a özel. Hazır sorularla devam edebilirsin.";
    case 'auth_required':
      return 'Soru sormak için giriş yapman gerekiyor.';
    case 'ai_busy': {
      const seconds = err.retryAfterSeconds;
      if (typeof seconds === 'number' && seconds >= 60) {
        return `Yapay zekâ şu an yoğun. ${Math.ceil(seconds / 60)} dakika sonra tekrar dene.`;
      }
      return 'Yapay zekâ şu an yoğun. Biraz sonra tekrar dene.';
    }
    case 'fact_not_found':
      return 'Bu kart artık bulunamadı.';
    default:
      return 'Şu an cevap veremiyorum. Lütfen biraz sonra tekrar dene.';
  }
}

export function shouldOfferPremium(
  err: { code?: string } | null | undefined,
  { hasPremium }: { hasPremium: boolean },
): boolean {
  if (hasPremium) {
    return false;
  }
  return err?.code === 'quota_exceeded' || err?.code === 'premium_required';
}
