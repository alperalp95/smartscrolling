// src/v2/steps/index.js
// Adım kaydı ve sıralı çalıştırıcı.
//   new ─dedup-hook→ new(+embedding) ─score→ scored ─support→ scored(+paragraf) ─write→ written
//       ─dedup-card→ written(+hash/embedding) ─verify→ verified ─enqueue→ queued
// "dedup" adı iki tekrar kontrolünü birden açar (dedup-hook + dedup-card); adımlar her zaman
// bu sırayla çalışır, --steps sırası önemsizdir.
import { runDedupCard } from './dedup-card.js';
import { runDedupHook } from './dedup-hook.js';
import { runEnqueue } from './enqueue.js';
import { runScore } from './score.js';
import { runSupport } from './support.js';
import { runVerify } from './verify.js';
import { runWrite } from './write.js';

export { STATUS, CATEGORIES, MAX_ATTEMPTS, normalizeCategory } from './common.js';

export const STEPS = Object.freeze({
  'dedup-hook': runDedupHook,
  score: runScore,
  support: runSupport,
  write: runWrite,
  'dedup-card': runDedupCard,
  verify: runVerify,
  enqueue: runEnqueue,
});

export const STEP_ORDER = Object.freeze(Object.keys(STEPS));
export const DEFAULT_STEP_NAMES = Object.freeze([
  'dedup',
  'score',
  'support',
  'write',
  'verify',
  'enqueue',
]);

/**
 * Run başında önce eldeki yazılmış taslaklar bitirilir (dedup-card → verify → enqueue), sonra
 * yeni iş üretilir (dedup-hook → score → support → write). write'tan sonra yeni taslaklar için
 * boşaltma adımları (varsa kota kalmışsa) bir kez daha çalışır. Amaç: yazar kotası azken önce
 * sıraya girecek kart üretmek; verify onarımı da `writer` rolünü kullanır.
 */
export const DRAIN_ORDER = Object.freeze(['dedup-card', 'verify', 'enqueue']);
export const FILL_ORDER = Object.freeze(['dedup-hook', 'score', 'support', 'write']);

/** Seçili adımlar için gerçek çalışma sırası (aynı ad iki kez geçebilir: boşaltma + son tur). */
export function executionOrder(steps) {
  const has = new Set(steps);
  const drain = DRAIN_ORDER.filter((n) => has.has(n));
  const fill = FILL_ORDER.filter((n) => has.has(n));
  return { drain, fill, tail: has.has('write') ? drain : [] };
}

function mergeStats(a, b) {
  const rejected = { ...a.rejected };
  for (const [k, v] of Object.entries(b.rejected ?? {})) rejected[k] = (rejected[k] ?? 0) + v;
  return {
    ...a,
    seen: a.seen + b.seen,
    advanced: a.advanced + b.advanced,
    rejected,
    failed: a.failed + b.failed,
    deferred: a.deferred + b.deferred,
    exhaustedRole: b.exhaustedRole ?? a.exhaustedRole,
    exhaustedReason: b.exhaustedReason ?? a.exhaustedReason,
    errors: [...(a.errors ?? []), ...(b.errors ?? [])],
  };
}

const ALIASES = { dedup: ['dedup-hook', 'dedup-card'] };

/** "dedup,score" → ['dedup-hook','score','dedup-card'] değil, STEP_ORDER sırasıyla. */
export function resolveSteps(names = DEFAULT_STEP_NAMES) {
  const list = typeof names === 'string' ? names.split(',') : names;
  const wanted = new Set();
  for (const raw of list) {
    const name = String(raw).trim();
    if (!name) continue;
    if (ALIASES[name]) {
      for (const n of ALIASES[name]) wanted.add(n);
    } else if (STEPS[name]) wanted.add(name);
    else throw new Error(`bilinmeyen adım '${name}' (geçerli: dedup, ${STEP_ORDER.join(', ')})`);
  }
  return STEP_ORDER.filter((n) => wanted.has(n));
}

/**
 * Seçili adımları sırayla çalıştırır. Bir adımın LLM zinciri tükenirse o adım durur
 * (stats.deferred), sonraki adımlar (başka rol/sağlayıcı) çalışmaya devam eder.
 * @param {string[]|string} names
 * @param {{ llm, repo, config, now?, log?, fetch? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runSteps(names, deps, opts = {}) {
  const steps = resolveSteps(names);
  const stats = {};
  // Run başına bellek içi liste: dedup-card aynı run'da geçen taslakları birbirine karşı da kontrol eder.
  const runDeps = { ...deps, runDrafts: Array.isArray(deps.runDrafts) ? deps.runDrafts : [] };
  const llmEvents = Array.isArray(deps.llm?.events) ? deps.llm.events : null;
  const firstEvent = llmEvents ? llmEvents.length : 0;
  const { drain, fill, tail } = executionOrder(steps);
  const exec = async (name) => {
    const s = await STEPS[name](runDeps, opts);
    stats[name] = stats[name] ? mergeStats(stats[name], s) : s;
    return s;
  };
  for (const name of drain) await exec(name);
  let wrote = false;
  for (const name of fill) {
    const s = await exec(name);
    if (name === 'write') wrote = s.advanced > 0;
  }
  if (wrote) {
    for (const name of tail) {
      if (stats[name]?.exhaustedRole) continue; // zincir zaten tükendi, boşuna çağrılmaz
      await exec(name);
    }
  }
  // Run sonunda kapanan/bulunamayan modeller (404/410 → model_unavailable). V2-08'de alarm Issue'su olur.
  const runEvents = llmEvents ? llmEvents.slice(firstEvent) : [];
  stats.modelEvents = summarizeModelEvents(runEvents);
  // Dakikalık sınır özeti (Groq TPM/OTPM): job süresini ve bölmeleri dry-run çıktısında görmek için.
  stats.rateEvents = summarizeRateEvents(runEvents);
  if (stats.rateEvents.waits || stats.rateEvents.tooLarge || stats.rateEvents.learned.length) {
    const r = stats.rateEvents;
    deps.log?.(
      `[v2-process] dakikalık sınır: bekleme=${r.waits} (toplam ${Math.round(r.waitMs / 1000)} sn) çok-büyük-istek=${r.tooLarge}` +
        `${r.learned.length ? ` öğrenilen=${r.learned.map((l) => `${l.provider}/${l.model} ${l.metric}=${l.limit}`).join(', ')}` : ''}`,
    );
  }
  for (const e of stats.modelEvents) {
    deps.log?.(
      `[v2-process] model olayı: ${e.type} ${e.provider}/${e.model}${e.status ? ` (HTTP ${e.status})` : ''} roller=${e.roles.join(',')} ×${e.count} :: ${e.error}`,
    );
  }
  return { steps, stats };
}

/**
 * rate_wait / request_too_large / rate_limit_learned olaylarının özeti.
 * @returns {{ waits: number, waitMs: number, tooLarge: number, learned: Array<{ provider, model, metric, limit }> }}
 */
export function summarizeRateEvents(events) {
  const out = { waits: 0, waitMs: 0, tooLarge: 0, learned: [] };
  for (const e of events ?? []) {
    if (e?.type === 'rate_wait') {
      out.waits += 1;
      out.waitMs += Number(e.delayMs) || 0;
    } else if (e?.type === 'request_too_large') {
      out.tooLarge += 1;
    } else if (e?.type === 'rate_limit_learned') {
      out.learned.push({ provider: e.provider, model: e.model, metric: e.metric, limit: e.limit });
    }
  }
  return out;
}

/** Model olayları (şimdilik model_unavailable), sağlayıcı/model başına tek satır. */
export const MODEL_EVENT_TYPES = Object.freeze(['model_unavailable']);

/**
 * @param {Array<object>} events  llm.events dilimi
 * @returns {Array<{ type, provider, model, roles: string[], status?: number, error: string, count: number, first_at: string, last_at: string }>}
 */
export function summarizeModelEvents(events) {
  const byKey = new Map();
  for (const e of events ?? []) {
    if (!MODEL_EVENT_TYPES.includes(e?.type)) continue;
    const key = `${e.type}|${e.provider}|${e.model}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
      if (e.role && !cur.roles.includes(e.role)) cur.roles.push(e.role);
      cur.last_at = e.at ?? cur.last_at;
      continue;
    }
    byKey.set(key, {
      type: e.type,
      provider: e.provider,
      model: e.model,
      roles: e.role ? [e.role] : [],
      ...(e.status ? { status: e.status } : {}),
      error: String(e.error ?? '').slice(0, 200),
      count: 1,
      first_at: e.at ?? null,
      last_at: e.at ?? null,
    });
  }
  return [...byKey.values()];
}
