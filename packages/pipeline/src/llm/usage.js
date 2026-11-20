// src/llm/usage.js
// Günlük bütçe sayacı: sağlayıcı/model başına istek + token (Cloudflare için Neuron tahmini).
// stopAtPercent'e gelen sağlayıcı/model o gün için atlanır.
// Saklama enjekte edilir (usageStore): bellek içi ya da JSON dosya. DB'ye yazma V2-08'de.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
      p.models[model] = { requests: 0, inputTokens: 0, outputTokens: 0, tokens: 0, neurons: 0, exhausted: false };
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
      if (p.exhausted) return { allowed: false, reason: 'quota_exhausted', detail: { scope: 'provider' } };
      if (m.exhausted) return { allowed: false, reason: 'quota_exhausted', detail: { scope: 'model' } };
      const provHit = overLimit(p, cfg?.dailyLimits?.provider, pct);
      if (provHit) return { allowed: false, reason: 'budget', detail: { scope: 'provider', ...provHit } };
      const modelHit = overLimit(m, cfg?.dailyLimits?.perModel, pct);
      if (modelHit) return { allowed: false, reason: 'budget', detail: { scope: 'model', ...modelHit } };
      return { allowed: true };
    },

    async record(provider, model, { requests = 1, inputTokens = 0, outputTokens = 0, neurons } = {}) {
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
      await persist();
      return n;
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
