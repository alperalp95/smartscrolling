// src/llm/index.js
// İçerik hattı v2 LLM katmanı: rol bazlı sağlayıcı zinciri + üstel bekleme + günlük bütçe.
//
//   const llm = createLlm(loadConfig(), { env: process.env, usageStore: createFileUsageStore() });
//   const { json, provider, model, usage } = await llm.chat('scorer', { messages, json: true });
//   const { vectors } = await llm.embed(['metin 1', 'metin 2']);
//
// API anahtarları sadece env'den okunur; hiçbir log/olay/hata mesajına yazılmaz.
import { ensureConfig, loadConfig, validateConfig } from './config.js';
import {
  LlmConfigError,
  LlmExhaustedError,
  LlmOutputError,
  LlmRequestTooLargeError,
  OUTPUT_ERROR_KINDS,
  ProviderCallError,
} from './errors.js';
import { JSON_REPAIR_INSTRUCTION, extractJson, stripThinking } from './json.js';
import { adapters } from './providers/index.js';
import { classifyHttpFailure } from './providers/openai-compatible.js';
import { createRateLimiter, estimateMessageTokens } from './rate.js';
import {
  createFileUsageStore,
  createMemoryUsageStore,
  createUsageTracker,
  utcDayKey,
} from './usage.js';

export {
  loadConfig,
  validateConfig,
  LlmConfigError,
  LlmExhaustedError,
  LlmOutputError,
  LlmRequestTooLargeError,
  createFileUsageStore,
  createMemoryUsageStore,
  createUsageTracker,
  utcDayKey,
  extractJson,
  stripThinking,
};

/**
 * Hata metninden anahtar/hesap kimliklerini siler (sağlayıcı gövdeyi geri yansıtırsa diye).
 * @param {string} text
 * @param {string[]} secrets  config'teki tüm apiKeyEnv/accountIdEnv değerleri
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 4) out = out.split(secret).join('***');
  }
  return out.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer ***');
}

/** Son kullanıcı mesajına ek metin (ör. Qwen3 " /no_think" yumuşak anahtarı). */
function withUserSuffix(messages, suffix) {
  if (!suffix) return messages;
  const idx = messages.map((m) => m.role).lastIndexOf('user');
  if (idx < 0) return messages;
  return messages.map((m, i) => (i === idx ? { ...m, content: `${m.content}${suffix}` } : m));
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function estimateTokens(texts) {
  return texts.reduce((sum, t) => sum + Math.ceil(String(t).length / 4), 0);
}

/**
 * @param {object} config  pipeline.config.json içeriği (ham ya da loadConfig çıktısı)
 * @param {object} [deps]
 * @param {Record<string,string|undefined>} [deps.env]  varsayılan process.env
 * @param {typeof fetch} [deps.fetch]                     varsayılan global fetch
 * @param {() => number|Date} [deps.now]                  gün anahtarı ve olay zamanı için
 * @param {(ms:number) => Promise<void>} [deps.sleep]     üstel bekleme (testte sahte)
 * @param {{load(day):any, save(day,data):any}} [deps.usageStore]  varsayılan bellek içi
 * @param {(event:object) => void} [deps.onEvent]
 */
export function createLlm(config, deps = {}) {
  const cfg = ensureConfig(config);
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? defaultSleep;
  const usage = createUsageTracker({
    providers: cfg.providers,
    store: deps.usageStore ?? createMemoryUsageStore(),
    now,
  });
  const events = [];
  const rrCounters = new Map();
  // Bu run'da "model kapatıldı / yok" (404/410) diyen modeller: sonraki çağrılarda denenmez.
  const unavailable = new Map();
  const { maxAttempts, baseDelayMs, maxDelayMs, requestTimeoutMs } = cfg.retry;
  // Olay/hata metinlerinden silinecek değerler: tüm sağlayıcıların anahtar ve hesap kimlikleri.
  const secrets = Object.values(cfg.providers)
    .flatMap((p) => [env[p.apiKeyEnv], p.accountIdEnv ? env[p.accountIdEnv] : undefined])
    .filter((v) => typeof v === 'string' && v.length >= 4);

  if (typeof fetchImpl !== 'function') throw new LlmConfigError('fetch fonksiyonu bulunamadı');

  function emit(event) {
    const full = { ...event, at: new Date(now()).toISOString() };
    events.push(full);
    deps.onEvent?.(full);
    return full;
  }

  const rate = createRateLimiter({ providers: cfg.providers, now, sleep, emit });

  function roleDef(role) {
    const def = cfg.roles[role];
    if (!def)
      throw new LlmConfigError(
        `bilinmeyen rol '${role}' (tanımlı: ${Object.keys(cfg.roles).join(', ')})`,
      );
    return def;
  }

  /** Zincirin bu çağrı için deneme sırası (round_robin havuzları döndürülür). */
  function candidatesFor(role) {
    const out = [];
    roleDef(role).steps.forEach((step, i) => {
      if (step.strategy !== 'round_robin' || step.members.length < 2) {
        out.push(...step.members);
        return;
      }
      const key = `${role}:${i}`;
      const n = rrCounters.get(key) ?? 0;
      rrCounters.set(key, n + 1);
      const start = n % step.members.length;
      out.push(...step.members.slice(start), ...step.members.slice(0, start));
    });
    return out;
  }

  async function callOnce({ url, init }, parse) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    timer.unref?.();
    try {
      let res;
      try {
        res = await fetchImpl(url, { ...init, signal: controller.signal });
      } catch (err) {
        const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
        throw new ProviderCallError(
          'retryable',
          isTimeout ? `zaman aşımı (${requestTimeoutMs} ms)` : `ağ hatası: ${err?.message ?? err}`,
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw classifyHttpFailure(res.status, text, res.headers);
      }
      let body;
      try {
        body = await res.json();
      } catch (err) {
        throw new ProviderCallError('fatal', `yanıt JSON değil: ${err.message}`);
      }
      return parse(body);
    } catch (err) {
      if (err?.name === 'AbortError' && !(err instanceof ProviderCallError)) {
        throw new ProviderCallError('retryable', `zaman aşımı (${requestTimeoutMs} ms)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function withRetry(ctx, fn) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        // 429 / "Request too large" gövdesindeki "Limit N" → o modelin dakikalık sınırı güncellenir.
        if (err instanceof ProviderCallError && err.rateLimit)
          rate.learn(ctx.provider, ctx.model, err.rateLimit, ctx);
        if (
          !(err instanceof ProviderCallError) ||
          err.kind !== 'retryable' ||
          attempt >= maxAttempts
        )
          throw err;
        const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        const delayMs = Math.min(maxDelayMs, Math.max(backoff, err.retryAfterMs ?? 0));
        emit({
          type: 'retry',
          ...ctx,
          attempt,
          delayMs,
          status: err.status,
          error: redactSecrets(err.message, secrets).slice(0, 200),
        });
        await sleep(delayMs);
      }
    }
  }

  async function runChain(role, perMember, { only, splittable = false } = {}) {
    const attempts = [];
    const firstEvent = events.length;
    let candidates = candidatesFor(role);
    if (only)
      candidates = candidates.filter((m) => m.provider === only.provider && m.model === only.model);

    for (const member of candidates) {
      const { provider, model } = member;
      const adapter = adapters[provider];
      const providerCfg = cfg.providers[provider];
      const gone = unavailable.get(`${provider}/${model}`);
      if (gone) {
        attempts.push({
          provider,
          model,
          kind: 'unavailable',
          reason: `model bu run'da kapalı (${gone})`,
        });
        continue;
      }
      const creds = adapter.credentials(providerCfg, env);
      if (!creds.ok) {
        emit({ type: 'missing_credentials', role, provider, model, env: creds.missing });
        attempts.push({
          provider,
          model,
          reason: `ortam değişkeni yok: ${creds.missing.join(', ')}`,
        });
        continue;
      }
      const budget = await usage.check(provider, model);
      if (!budget.allowed) {
        emit({
          type: 'budget_skip',
          role,
          provider,
          model,
          reason: budget.reason,
          ...budget.detail,
        });
        attempts.push({ provider, model, reason: budget.reason });
        continue;
      }
      try {
        return await perMember({ member, adapter, providerCfg, creds });
      } catch (err) {
        if (!(err instanceof ProviderCallError)) throw err;
        const error = redactSecrets(err.message, secrets).replace(/\s+/g, ' ').slice(0, 200);
        if (err.kind === 'unavailable') {
          unavailable.set(
            `${provider}/${model}`,
            err.status ? `HTTP ${err.status}` : 'unavailable',
          );
          emit({ type: 'model_unavailable', role, provider, model, status: err.status, error });
        } else if (err.kind === 'too_large') {
          emit({
            type: 'request_too_large',
            role,
            provider,
            model,
            status: err.status,
            ...(err.rateLimit ?? {}),
            error,
          });
          if (splittable) {
            await usage.recordFailure(provider, model, {
              kind: err.kind,
              status: err.status,
              message: error,
            });
            throw new LlmRequestTooLargeError(role, {
              provider,
              model,
              limit: err.rateLimit?.limit,
              metric: err.rateLimit?.metric,
              attempts: [
                ...attempts,
                { provider, model, kind: err.kind, reason: `too_large: ${error.slice(0, 120)}` },
              ],
              events: events.slice(firstEvent),
            });
          }
        } else if (err.kind === 'quota') {
          const scope = Object.keys(providerCfg.dailyLimits.provider ?? {}).length
            ? 'provider'
            : 'model';
          await usage.markExhausted(provider, model, scope);
          emit({ type: 'quota_exhausted', role, provider, model, scope, error });
        } else {
          emit({
            type: 'provider_failed',
            role,
            provider,
            model,
            kind: err.kind,
            status: err.status,
            error,
          });
        }
        await usage.recordFailure(provider, model, {
          kind: err.kind,
          status: err.status,
          message: error,
        });
        const head = err.status ? `${err.kind} (${err.status})` : err.kind;
        attempts.push({
          provider,
          model,
          kind: err.kind,
          reason: `${head}: ${error.slice(0, 120)}`,
        });
      }
    }
    // En az bir üye çalışıp bozuk çıktı verdiyse (geçersiz JSON, kesik/boş yanıt) bu tükenme
    // değildir: çağıran adayı/batch'i hata sayar (attempts++), adım sonraki adaylarla sürer.
    // Sadece kapasite/erişim hataları (kota, bütçe, 429/5xx, anahtar yok, model yok) → tükenme.
    const kinds = attempts.map((a) => a.kind).filter(Boolean);
    const payload = { attempts, events: events.slice(firstEvent) };
    if (kinds.some((k) => OUTPUT_ERROR_KINDS.includes(k))) throw new LlmOutputError(role, payload);
    throw new LlmExhaustedError(role, payload);
  }

  async function recordUsage(provider, model, u, requests = 1) {
    const neurons = await usage.record(provider, model, { requests, ...u });
    return usage.estimateNeurons(provider, model, 0, 0) === undefined ? undefined : neurons;
  }

  function addUsage(total, u, neurons) {
    total.inputTokens += u.inputTokens ?? 0;
    total.outputTokens += u.outputTokens ?? 0;
    if (neurons !== undefined) total.neurons = (total.neurons ?? 0) + neurons;
  }

  /**
   * @param {string} role  scorer | writer | verifier | judge
   * splittable: true → tek istek dakikalık sınırdan büyükse ("Request too large") zincirde ilerlemek
   * yerine LlmRequestTooLargeError fırlatılır; çağıran işi ikiye bölüp tekrar dener.
   * @param {{ messages: Array<{role:string, content:string}>, json?: boolean, maxTokens?: number, splittable?: boolean }} req
   */
  async function chat(
    role,
    { messages, json = false, maxTokens: requestedMaxTokens, splittable = false } = {},
  ) {
    const def = roleDef(role);
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LlmConfigError('chat: messages boş olamaz');
    }

    return runChain(
      role,
      async ({ member, adapter, providerCfg, creds }) => {
        const { provider, model, params, userSuffix } = member;
        // Öncelik: zincir üyesinin maxTokens'ı (modele özgü, ör. düşünen yedek model) >
        // çağrıdaki maxTokens > config roles.<rol>.maxTokens.
        const maxTokens = member.maxTokens ?? requestedMaxTokens ?? def.maxTokens;
        const ctx = { role, provider, model };
        const total = { inputTokens: 0, outputTokens: 0 };

        const send = async (msgs) => {
          const finalMessages = withUserSuffix(msgs, userSuffix);
          const req = adapter.chatRequest({
            creds,
            providerCfg,
            model,
            messages: finalMessages,
            json,
            maxTokens,
            params,
          });
          // Dakikalık pencere ihtiyacı: girdi tahmini + bu istek için ayrılan çıktı
          // (roles.<rol>.expectedOutputTokens; en çok maxTokens ve OTPM kadar).
          const limits = rate.limitsFor(provider, model);
          const outCaps = [
            def.expectedOutputTokens,
            maxTokens,
            limits.outputTokensPerMinute,
          ].filter((v) => Number.isFinite(v) && v > 0);
          const need = {
            input: estimateMessageTokens(finalMessages),
            output: outCaps.length ? Math.min(...outCaps) : 0,
          };
          try {
            const out = await withRetry(ctx, async () => {
              await rate.acquire(provider, model, need, ctx);
              return callOnce(req, adapter.parseChat);
            });
            rate.record(provider, model, {
              input: out.usage?.inputTokens || need.input,
              output: out.usage?.outputTokens ?? need.output,
            });
            addUsage(total, out.usage, await recordUsage(provider, model, out.usage));
            // finish_reason=length: yanıt maxTokens'ta kesildi → tamir de kesilir; doğrudan yedeğe.
            if (out.finishReason === 'length') {
              emit({ type: 'truncated', ...ctx, maxTokens, outputTokens: out.usage?.outputTokens });
              throw new ProviderCallError(
                'truncated',
                `yanıt maxTokens (${maxTokens ?? 'varsayılan'}) sınırında kesildi (finish_reason=length, çıktı ${out.usage?.outputTokens ?? '?'} token)`,
              );
            }
            return stripThinking(out.text);
          } catch (err) {
            // Groq JSON modu geçersiz JSON üretirse 400 json_validate_failed döner; tamire gider.
            if (err instanceof ProviderCallError && err.kind === 'invalid_json' && json) {
              addUsage(total, {}, await recordUsage(provider, model, {}));
              return err.failedGeneration ?? '';
            }
            throw err;
          }
        };

        let text = await send(messages);
        let parsed;
        if (json) {
          parsed = extractJson(text);
          if (!parsed.ok) {
            emit({ type: 'json_repair', ...ctx, error: parsed.error });
            text = await send([
              ...messages,
              { role: 'assistant', content: text || '(boş)' },
              { role: 'user', content: JSON_REPAIR_INSTRUCTION },
            ]);
            parsed = extractJson(text);
            if (!parsed.ok)
              throw new ProviderCallError(
                'invalid_json',
                `tamir sonrası da geçersiz JSON: ${parsed.error}`,
              );
          }
        } else if (!text.trim()) {
          throw new ProviderCallError('empty', 'boş yanıt (düşünme bloğu dışında içerik yok)');
        }

        const result = { text, provider, model, usage: total };
        if (json) result.json = parsed.value;
        return result;
      },
      { splittable },
    );
  }

  /**
   * Metinleri vektöre çevirir; roles.embedding.batchSize'lık parçalarla gönderir.
   * Tüm parçalar aynı modelle hesaplanır (farklı modellerin vektörleri karıştırılmaz).
   * @param {string[]} texts
   */
  async function embed(texts) {
    const list = Array.isArray(texts) ? texts : [texts];
    if (list.length === 0)
      return {
        vectors: [],
        provider: null,
        model: null,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    if (list.some((t) => typeof t !== 'string' || !t.trim())) {
      throw new LlmConfigError('embed: her öğe boş olmayan bir metin olmalı');
    }
    const def = roleDef('embedding');
    const vectors = [];
    const total = { inputTokens: 0, outputTokens: 0 };
    let pinned = null;

    for (let i = 0; i < list.length; i += def.batchSize) {
      const batch = list.slice(i, i + def.batchSize);
      const r = await runChain(
        'embedding',
        async ({ member, adapter, creds }) => {
          const { provider, model } = member;
          if (!adapter.embedRequest) {
            throw new ProviderCallError('fatal', `${provider} adaptörü embedding desteklemiyor`);
          }
          const req = adapter.embedRequest({ creds, model, texts: batch });
          const out = await withRetry({ role: 'embedding', provider, model }, () =>
            callOnce(req, adapter.parseEmbed),
          );
          if (out.vectors.length !== batch.length) {
            throw new ProviderCallError(
              'fatal',
              `vektör sayısı uyuşmuyor (${out.vectors.length} != ${batch.length})`,
            );
          }
          const bad = out.vectors.find((v) => !Array.isArray(v) || v.length !== def.dimensions);
          if (bad) {
            throw new ProviderCallError(
              'fatal',
              `vektör boyutu ${bad?.length} != beklenen ${def.dimensions}`,
            );
          }
          const u = {
            inputTokens: out.usage.inputTokens || estimateTokens(batch),
            outputTokens: 0,
          };
          addUsage(total, u, await recordUsage(provider, model, u));
          return { vectors: out.vectors, provider, model };
        },
        { only: pinned },
      );
      pinned ??= { provider: r.provider, model: r.model };
      vectors.push(...r.vectors);
    }
    return { vectors, provider: pinned.provider, model: pinned.model, usage: total };
  }

  return { chat, embed, events, usage, rate, config: cfg };
}
