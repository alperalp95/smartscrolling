import {
  CardAskError,
  askCard,
  buildHistory,
  cardAskErrorMessage,
  normalizeQuestion,
  shouldOfferPremium,
} from '../cardAsk';

const FACT = '11111111-1111-1111-1111-111111111111';

function errorResponse(status: number, payload: unknown) {
  return {
    data: null,
    error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: { status, clone: () => ({ json: async () => payload }) },
    }),
  };
}

describe('askCard validation', () => {
  it.each([
    ['both', { presetId: 'why' as const, question: 'x' }],
    ['neither', {}],
    ['too long', { question: 'a'.repeat(301) }],
  ])('rejects %s without a network call', async (_n, extra) => {
    const invoke = jest.fn();
    await expect(askCard({ factId: FACT, ...extra }, { invoke })).rejects.toMatchObject({
      code: 'bad_request',
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('askCard success', () => {
  const ok = {
    answer: 'cevap',
    presetId: 'why',
    quota: {
      tier: 'free',
      limit: 3,
      remaining: 2,
      resetAt: '2026-01-01T00:00:00Z',
    },
  };

  it('returns the 200 body as-is and omits question for presets', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: ok, error: null });
    const result = await askCard({ factId: FACT, presetId: 'why' }, { invoke });
    expect(result).toEqual(ok);
    expect(invoke).toHaveBeenCalledWith('card-ask', {
      body: { factId: FACT, presetId: 'why' },
    });
    expect(invoke.mock.calls[0][1].body).not.toHaveProperty('question');
  });

  it('sends normalized question and trimmed history', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: ok, error: null });
    await askCard(
      {
        factId: FACT,
        question: '  merhaba   dünya ',
        history: [{ role: 'user', content: 'a' }],
      },
      { invoke },
    );
    expect(invoke.mock.calls[0][1].body).toEqual({
      factId: FACT,
      question: 'merhaba dünya',
      history: [{ role: 'user', content: 'a' }],
    });
  });
});

describe('askCard errors', () => {
  it.each([
    [400, 'bad_request'],
    [401, 'auth_required'],
    [403, 'premium_required'],
    [404, 'fact_not_found'],
    [503, 'quota_unavailable'],
    [502, 'ai_failed'],
  ])('maps %i %s', async (status, code) => {
    const invoke = jest.fn().mockResolvedValue(errorResponse(status, { error: 'x', code }));
    await expect(askCard({ factId: FACT, presetId: 'why' }, { invoke })).rejects.toMatchObject({
      code,
      status,
    });
  });

  it('keeps quota on quota_exceeded', async () => {
    const quota = { tier: 'free', limit: 3, remaining: 0, resetAt: 'r' };
    const invoke = jest
      .fn()
      .mockResolvedValue(errorResponse(429, { error: 'q', code: 'quota_exceeded', quota }));
    const err = await askCard({ factId: FACT, presetId: 'why' }, { invoke }).catch((e) => e);
    expect(err).toBeInstanceOf(CardAskError);
    expect(err.quota).toEqual(quota);
  });

  it('keeps retryAfterSeconds on ai_busy', async () => {
    const invoke = jest.fn().mockResolvedValue(
      errorResponse(429, {
        error: 'b',
        code: 'ai_busy',
        retryAfterSeconds: 120,
      }),
    );
    const err = await askCard({ factId: FACT, presetId: 'why' }, { invoke }).catch((e) => e);
    expect(err.code).toBe('ai_busy');
    expect(err.retryAfterSeconds).toBe(120);
  });

  it('uses network code when body is unreadable', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: null,
      error: Object.assign(new Error('boom'), {
        context: {
          status: 500,
          clone: () => ({
            json: async () => {
              throw new Error('bad json');
            },
          }),
        },
      }),
    });
    await expect(askCard({ factId: FACT, presetId: 'why' }, { invoke })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('uses network code when invoke throws', async () => {
    const invoke = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(askCard({ factId: FACT, presetId: 'why' }, { invoke })).rejects.toMatchObject({
      code: 'network',
    });
  });
});

describe('cardAskErrorMessage', () => {
  const free = { hasPremium: false };
  it('handles quota_exceeded', () => {
    expect(cardAskErrorMessage({ code: 'quota_exceeded' }, free)).toBe(
      'Bugünkü 3 soru hakkını kullandın. Premium ile günde 30 soru sorabilirsin.',
    );
    expect(cardAskErrorMessage({ code: 'quota_exceeded', quota: { limit: 5 } }, free)).toContain(
      'Bugünkü 5 soru',
    );
    expect(cardAskErrorMessage({ code: 'quota_exceeded' }, { hasPremium: true })).toBe(
      'Bugünkü soru hakkın doldu. Yarın yenilenir.',
    );
  });
  it('handles other codes', () => {
    expect(cardAskErrorMessage({ code: 'premium_required' }, free)).toBe(
      "Kendi sorunu yazmak Premium'a özel. Hazır sorularla devam edebilirsin.",
    );
    expect(cardAskErrorMessage({ code: 'auth_required' }, free)).toBe(
      'Soru sormak için giriş yapman gerekiyor.',
    );
    expect(cardAskErrorMessage({ code: 'ai_busy' }, free)).toBe(
      'Yapay zekâ şu an yoğun. Biraz sonra tekrar dene.',
    );
    expect(cardAskErrorMessage({ code: 'ai_busy', retryAfterSeconds: 30 }, free)).toBe(
      'Yapay zekâ şu an yoğun. Biraz sonra tekrar dene.',
    );
    expect(cardAskErrorMessage({ code: 'ai_busy', retryAfterSeconds: 120 }, free)).toBe(
      'Yapay zekâ şu an yoğun. 2 dakika sonra tekrar dene.',
    );
    expect(cardAskErrorMessage({ code: 'fact_not_found' }, free)).toBe('Bu kart artık bulunamadı.');
    expect(cardAskErrorMessage({ code: 'ai_failed' }, free)).toBe(
      'Şu an cevap veremiyorum. Lütfen biraz sonra tekrar dene.',
    );
    expect(cardAskErrorMessage(null, free)).toBe(
      'Şu an cevap veremiyorum. Lütfen biraz sonra tekrar dene.',
    );
  });
});

describe('shouldOfferPremium', () => {
  it('offers only to free users on quota/premium errors', () => {
    expect(shouldOfferPremium({ code: 'quota_exceeded' }, { hasPremium: false })).toBe(true);
    expect(shouldOfferPremium({ code: 'premium_required' }, { hasPremium: false })).toBe(true);
    expect(shouldOfferPremium({ code: 'quota_exceeded' }, { hasPremium: true })).toBe(false);
    expect(shouldOfferPremium({ code: 'ai_busy' }, { hasPremium: false })).toBe(false);
  });
});

describe('normalizeQuestion / buildHistory', () => {
  it('normalizes questions', () => {
    expect(normalizeQuestion('  a \n b  ')).toEqual({ ok: true, value: 'a b' });
    expect(normalizeQuestion('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(normalizeQuestion('a'.repeat(301))).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(normalizeQuestion('a'.repeat(300)).ok).toBe(true);
  });

  it('keeps last 4 user/assistant messages, trimmed to 1200 chars', () => {
    const msgs = [
      { role: 'system', content: 's' },
      ...Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: `m${i}`,
      })),
    ];
    const h = buildHistory(msgs);
    expect(h.map((m) => m.content)).toEqual(['m2', 'm3', 'm4', 'm5']);
    expect(buildHistory([{ role: 'user', content: 'x'.repeat(2000) }])[0].content).toHaveLength(
      1200,
    );
  });
});
