// src/llm/usage.js
// Günlük bütçe sayacı: sağlayıcı/model başına istek + token (Cloudflare için Neuron tahmini).
// stopAtPercent'e gelen sağlayıcı/model o gün için atlanır.
// Saklama enjekte edilir (usageStore): bellek içi, JSON dosya ya da `pipeline_state` (DB; GitHub Actions).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getState, setState } from '../v2/db/state-repo.js';

export const DEFAULT_USAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.cache',
);

/** Gün anahtarı UTC (Cloudflare 00:00 UTC'de sıfırlar). */
export function utcDayKey(nowValue) {
  const d = nowValue instanceof Date ? nowValue : new Date(nowValue);
  return d.toISOString().slice(0, 10);
}

function emptyDay(day) {
  return { date: day, providers: {} };
}

/** Bellek içi saklama (testler ve tek süreçli çalışma için). */
export function createMemoryUsageStore(initial = {}) {
  const days = new Map(Object.entries(initial));
  return {
    async load(day) {
      const v = days.get(day);
      return v ? structuredClone(v) : null;
    },
    async save(day, data) {
      days.set(day, structuredClone(data));
    },
    dump() {
      return Object.fromEntries(days);
    },
  };
}

/** JSON dosya saklama: {dir}/llm-usage-YYYY-MM-DD.json */
export function createFileUsageStore({ dir = DEFAULT_USAGE_DIR } = {}) {
  const fileFor = (day) => path.join(dir, `llm-usage-${day}.json`);
  return {
    file: fileFor,
    async load(day) {
      try {
        return JSON.parse(await readFile(fileFor(day), 'utf8'));
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
    async save(day, data) {
      await mkdir(dir, { recursive: true });
      const target = fileFor(day);
      const tmp = `${target}.${process.pid}.tmp`;
      await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await rename(tmp, target);
    },
  };
}

/** `pipeline_state` anahtar öneki: `llm-usage:YYYY-MM-DD` (UTC gün). */
export const USAGE_STATE_PREFIX = 'llm-usage:';

/**
 * DB saklama: günlük sayaç `pipeline_state` tablosunda `llm-usage:<YYYY-MM-DD>` anahtarıyla tutulur.
 * GitHub Actions her run'da sıfırdan başladığı için (yerel `.cache` kaybolur) `--apply` modunda bu kullanılır;
 * aynı gündeki run'lar bütçeyi paylaşır.
 *
 * Yazma hatası hattı durdurmaz: `onError` çağrılır, `errors` sayacı artar, sayaç bellekte devam eder
 * (tracker kayıtları zincirlediği için bir fırlatma sonraki tüm yazımları da bozardı).
 * Okuma hatası fırlatılır (DB'ye ulaşılamıyorsa `--apply` zaten çalışamaz).
 *
 * @param {object} o
 * @param {{ from: Function }} o.client  Supabase client
 * @param {(client, key) => Promise<any>} [o.getState]
 * @param {(client, key, value) => Promise<void>} [o.setState]
 * @param {string} [o.prefix]
 * @param {(err: Error, day: string) => void} [o.onError]
 */
export function createStateUsageStore({
  client,
  getState: getStateFn = getState,
  setState: setStateFn = setState,
  prefix = USAGE_STATE_PREFIX,
  onError,
} = {}) {
  if (!client || typeof client.from !== 'function')
    throw new TypeError('createStateUsageStore: Supabase client gerekli');
  const keyFor = (day) => `${prefix}${day}`;
  const store = {
    kind: 'db',
    key: keyFor,
    errors: 0,
    async load(day) {
      const value = await getStateFn(client, keyFor(day));
      return value && typeof value === 'object' ? value : null;
    },
    async save(day, data) {
      try {
        await setStateFn(client, keyFor(day), data);
      } catch (err) {
        store.errors += 1;
        onError?.(err, day);
      }
    },
  };
  return store;
}

/**
 * @param {object} o
 * @param {object} o.providers  normalize edilmiş config.providers
 * @param {object} o.store      { load(day), save(day, data) }
 * @param {() => number|Date} o.now
 */
export function createUsageTracker({ providers, store, now = () => Date.now() }) {
  let day = null;
  let data = null;
  let loading = null;
  let saveChain = Promise.resolve();

  // Eşzamanlı çağrılar aynı yüklemeyi bekler (gün değişiminde tek load).
  async function current() {
    const today = utcDayKey(now());
    if (today === day && data) return data;
    if (!loading || loading.day !== today) {
      const p = (async () => {
        const loaded = (await store.load(today)) ?? emptyDay(today);
        if (!loaded.providers) loaded.providers = {};
        return loaded;
      })();
      loading = { day: today, promise: p };
    }
    const { promise } = loading;
    const loaded = await promise;
    if (loading?.promise === promise && day !== today) {
      day = today;
      data = loaded;
    }
    return day === today ? data : loaded;
  }

  function providerBucket(d, provider) {
    if (!d.providers[provider]) {
      d.providers[provider] = { requests: 0, tokens: 0, neurons: 0, exhausted: false, models: {} };
    }
    return d.providers[provider];
  }

  function modelBucket(d, provider, model) {
    const p = providerBucket(d, provider);
    if (!p.models[model]) {
      p.models[model] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        tokens: 0,
        neurons: 0,
        exhausted: false,
      };
    }
    return p.models[model];
  }

  function persist() {
    const snapshotDay = day;
    const snapshot = structuredClone(data);
    saveChain = saveChain.then(() => store.save(snapshotDay, snapshot));
    return saveChain;
  }

  function overLimit(used, limits, pct) {
    for (const [metric, limit] of Object.entries(limits ?? {})) {
      if (limit === null || limit === undefined) continue;
      const threshold = (limit * pct) / 100;
      if ((used[metric] ?? 0) >= threshold) {
        return { metric, used: used[metric] ?? 0, limit, threshold };
      }
    }
    return null;
  }

  /** Neuron tahmini (sadece neuronsPerMillionTokens tanımlı sağlayıcılarda). */
  function estimateNeurons(provider, model, inputTokens = 0, outputTokens = 0) {
    const table = providers[provider]?.neuronsPerMillionTokens;
    if (!table || Object.keys(table).length === 0) return undefined;
    const rate = table[model] ?? table.default;
    if (!rate) return undefined;
    return (inputTokens * (rate.input ?? 0) + outputTokens * (rate.output ?? 0)) / 1_000_000;
  }

  return {
    estimateNeurons,

    /** @returns {Promise<{ allowed: boolean, reason?: string, detail?: object }>} */
    async check(provider, model) {
      const d = await current();
      const cfg = providers[provider];
      const pct = cfg?.stopAtPercent ?? 90;
      const p = providerBucket(d, provider);
      const m = modelBucket(d, provider, model);
      if (p.exhausted)
        return { allowed: false, reason: 'quota_exhausted', detail: { scope: 'provider' } };
      if (m.exhausted)
        return { allowed: false, reason: 'quota_exhausted', detail: { scope: 'model' } };
      const provHit = overLimit(p, cfg?.dailyLimits?.provider, pct);
      if (provHit)
        return { allowed: false, reason: 'budget', detail: { scope: 'provider', ...provHit } };
      const modelHit = overLimit(m, cfg?.dailyLimits?.perModel, pct);
      if (modelHit)
        return { allowed: false, reason: 'budget', detail: { scope: 'model', ...modelHit } };
      return { allowed: true };
    },

    async record(
      provider,
      model,
      { requests = 1, inputTokens = 0, outputTokens = 0, cachedTokens = 0, neurons } = {},
    ) {
      const d = await current();
      const p = providerBucket(d, provider);
      const m = modelBucket(d, provider, model);
      const tokens = inputTokens + outputTokens;
      const n = neurons ?? estimateNeurons(provider, model, inputTokens, outputTokens) ?? 0;
      for (const b of [p, m]) {
        b.requests += requests;
        b.tokens += tokens;
        b.neurons = Math.round((b.neurons + n) * 1000) / 1000;
      }
      m.inputTokens += inputTokens;
      m.outputTokens += outputTokens;
      // Eski kayıtlarda alan yok: 0 kabul edilir. Bütçe (tokens/requests) bu alandan etkilenmez.
      m.cachedInputTokens = (m.cachedInputTokens ?? 0) + cachedTokens;
      await persist();
      return n;
    },

    /**
     * Başarısız istek (HTTP hatası, geçersiz/kesik çıktı). Bütçe sayaçlarını DEĞİŞTİRMEZ;
     * sadece "denendi ama düştü" izini bırakır (usage dosyasında 0 istek ≠ hiç denenmedi).
     * @param {{ kind?: string, status?: number, message?: string }} info  anahtar içermemeli
     */
    async recordFailure(provider, model, { kind, status, message } = {}) {
      const d = await current();
      const m = modelBucket(d, provider, model);
      m.failures = (m.failures ?? 0) + 1;
      m.lastError = {
        kind: kind ?? 'unknown',
        ...(status ? { status } : {}),
        message: String(message ?? '').slice(0, 200),
        at: new Date(now()).toISOString(),
      };
      await persist();
    },

    /** Sağlayıcı günlük kotanın bittiğini söylediyse (ör. 429 TPD) bugün için kapat. */
    async markExhausted(provider, model, scope = 'model') {
      const d = await current();
      if (scope === 'provider') providerBucket(d, provider).exhausted = true;
      else modelBucket(d, provider, model).exhausted = true;
      await persist();
    },

    async snapshot() {
      return structuredClone(await current());
    },
  };
}
