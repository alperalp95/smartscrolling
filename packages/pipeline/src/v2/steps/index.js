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
export const DEFAULT_STEP_NAMES = Object.freeze(['dedup', 'score', 'support', 'write', 'verify', 'enqueue']);

const ALIASES = { dedup: ['dedup-hook', 'dedup-card'] };

/** "dedup,score" → ['dedup-hook','score','dedup-card'] değil, STEP_ORDER sırasıyla. */
export function resolveSteps(names = DEFAULT_STEP_NAMES) {
  const list = typeof names === 'string' ? names.split(',') : names;
  const wanted = new Set();
  for (const raw of list) {
    const name = String(raw).trim();
    if (!name) continue;
    if (ALIASES[name]) ALIASES[name].forEach((n) => wanted.add(n));
    else if (STEPS[name]) wanted.add(name);
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
  for (const name of steps) {
    stats[name] = await STEPS[name](runDeps, opts);
  }
  return { steps, stats };
}
