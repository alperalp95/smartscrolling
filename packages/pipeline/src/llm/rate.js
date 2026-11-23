// src/llm/rate.js
// Dakikalık token sınırları (Groq TPM / OTPM) için kayan pencere sayacı.
//
// Groq ücretsiz katmanında günlük sınırların yanında dakikalık sınırlar da var:
//   - TPM  (tokens per minute): girdi + çıktı
//   - OTPM (output tokens per minute): sadece çıktı (konsol tablosunda görünmeyebilir; 429 mesajında yazar)
// Her istekten önce: son 60 sn'de harcanan + bu isteğin tahmini > sınır ise pencere yeterince
// açılana kadar beklenir (en fazla 60 sn, tek bekleme). İstek bitince gerçek kullanım pencereye yazılır.
// 429 / "Request too large" mesajındaki "Limit N" okunur ve o modelin sınırı bu run için güncellenir.
//
// Config: providers.<ad>.perMinuteLimits = { "<model>": { tokensPerMinute, outputTokensPerMinute }, "default": {...} }

export const WINDOW_MS = 60_000;
export const MAX_WAIT_MS = 60_000;

const METRIC_FIELD = { TPM: 'tokensPerMinute', OTPM: 'outputTokensPerMinute' };

/** Metin uzunluğundan kaba token tahmini (Türkçe ~3,3, İngilizce ~4 karakter/token; temkinli 3,5). */
export function estimateMessageTokens(messages) {
  const chars = (messages ?? []).reduce((sum, m) => sum + String(m?.content ?? '').length, 0);
  return Math.ceil(chars / 3.5);
}

/**
 * @param {object} o
 * @param {object} o.providers  normalize edilmiş config.providers (perMinuteLimits okunur)
 * @param {() => number|Date} o.now
 * @param {(ms:number) => Promise<void>} o.sleep
 * @param {(event:object) => void} [o.emit]
 */
export function createRateLimiter({ providers, now, sleep, emit = () => {} }) {
  const windows = new Map(); // "provider/model" -> [{ t, input, output }]
  const learned = new Map(); // "provider/model" -> { tokensPerMinute?, outputTokensPerMinute? }

  const key = (provider, model) => `${provider}/${model}`;
  const nowMs = () => {
    const v = now();
    return v instanceof Date ? v.getTime() : Number(v);
  };

  /** O modelin geçerli dakikalık sınırları (öğrenilen > config modeli > config default). */
  function limitsFor(provider, model) {
    const table = providers?.[provider]?.perMinuteLimits ?? {};
    const base = { ...(table.default ?? {}), ...(table[model] ?? {}) };
    return { ...base, ...(learned.get(key(provider, model)) ?? {}) };
  }

  function entries(provider, model, t) {
    const k = key(provider, model);
    const list = (windows.get(k) ?? []).filter((e) => e.t + WINDOW_MS > t);
    windows.set(k, list);
    return list;
  }

  function sums(list) {
    return list.reduce(
      (acc, e) => ({ total: acc.total + e.input + e.output, output: acc.output + e.output }),
      { total: 0, output: 0 },
    );
  }

  function fits(list, limits, need) {
    const s = sums(list);
    const tpm = limits.tokensPerMinute;
    const otpm = limits.outputTokensPerMinute;
    if (tpm && s.total + need.input + need.output > tpm) return false;
    if (otpm && s.output + need.output > otpm) return false;
    return true;
  }

  return {
    limitsFor,

    /**
     * Gerekirse bekler. need = { input, output } tahmini (output = bu istek için ayrılan çıktı).
     * @returns {Promise<number>} beklenen ms (0 = beklemedi)
     */
    async acquire(provider, model, need, ctx = {}) {
      const limits = limitsFor(provider, model);
      if (!limits.tokensPerMinute && !limits.outputTokensPerMinute) return 0;
      const t = nowMs();
      const list = entries(provider, model, t);
      if (fits(list, limits, need)) return 0;
      // En eski kayıtlardan başlayarak pencereden düşür; isteğin sığdığı ilk an = bekleme.
      // İstek tek başına bile sığmıyorsa (boş pencerede de aşar) pencerenin tamamen boşalmasını
      // bekle; gerisini sağlayıcı söyler ("Request too large" → çağıran işi böler).
      let waitMs = list.length ? list[list.length - 1].t + WINDOW_MS - t : 0;
      for (let i = 0; i < list.length; i += 1) {
        if (fits(list.slice(i + 1), limits, need)) {
          waitMs = Math.max(0, list[i].t + WINDOW_MS - t);
          break;
        }
      }
      waitMs = Math.min(MAX_WAIT_MS, Math.ceil(waitMs));
      if (waitMs <= 0) return 0;
      const s = sums(list);
      emit({
        type: 'rate_wait',
        ...ctx,
        provider,
        model,
        delayMs: waitMs,
        windowTokens: s.total,
        windowOutputTokens: s.output,
        needInput: need.input,
        needOutput: need.output,
        tokensPerMinute: limits.tokensPerMinute ?? null,
        outputTokensPerMinute: limits.outputTokensPerMinute ?? null,
      });
      await sleep(waitMs);
      return waitMs;
    },

    /** Tamamlanan (ya da sağlayıcının saydığı) isteği pencereye yazar. */
    record(provider, model, { input = 0, output = 0 } = {}) {
      const t = nowMs();
      const list = entries(provider, model, t);
      list.push({ t, input: Math.max(0, input), output: Math.max(0, output) });
    },

    /**
     * 429 / "Request too large" mesajındaki sınırı öğrenir ({ metric: 'OTPM', limit: 1000 }).
     * @returns {boolean} sınır değiştiyse true
     */
    learn(provider, model, info, ctx = {}) {
      const field = METRIC_FIELD[info?.metric];
      if (!field || !Number.isFinite(info.limit) || info.limit <= 0) return false;
      const current = limitsFor(provider, model)[field];
      if (current === info.limit) return false;
      const k = key(provider, model);
      learned.set(k, { ...(learned.get(k) ?? {}), [field]: info.limit });
      emit({
        type: 'rate_limit_learned',
        ...ctx,
        provider,
        model,
        metric: info.metric,
        limit: info.limit,
        previous: current ?? null,
      });
      return true;
    },

    /** Test/teşhis için: pencerede kalan kullanım. */
    windowUsage(provider, model) {
      return sums(entries(provider, model, nowMs()));
    },
  };
}
