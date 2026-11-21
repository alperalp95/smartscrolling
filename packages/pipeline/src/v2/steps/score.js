// src/v2/steps/score.js
// Puanla: Tekrar-1'i geçmiş `new` adaylar config.scoring.batchSize'lık (10) gruplarla tek çağrıda.
// Model çıktısı kısa anahtarlı (i, s, r, d, c, w); eski uzun anahtarlar da kabul edilir.
// Sağlayıcı "Request too large" derse (tek istek dakikalık sınırı aşıyor) batch ikiye bölünüp
// tekrar denenir (tek adaya inene kadar; tek aday yine büyükse zincirdeki yedek modele gider).
// wow = 0.6*surprise + 0.4*tr_relevance.
// Eleme sırası: is_definition → definition; surprise < scoring.minSurprise (6) → low_surprise;
// tr_relevance < scoring.minTrRelevance (4) → low_relevance; kategori tanınmazsa → invalid_category.
// maxTokens: config.roles.scorer.maxTokens (yoksa SCORE_MAX_TOKENS).
// Kalanlardan batch başına en iyi passPercent (batch boyutunun %'si, en az 1) → scored;
// diğerleri → below_cut. Tüm puanlar scores jsonb'ye yazılır.
import { SCORE_MAX_TOKENS, buildScorePrompt } from '../prompts/score.js';
import {
  STATUS,
  isExhausted,
  isTooLarge,
  isFatal,
  markDeferred,
  newStats,
  normalizeCategory,
  nowIso,
  recordFailure,
  reject,
  roleMaxTokens,
} from './common.js';

export const MIN_SURPRISE = 6;
export const MIN_TR_RELEVANCE = 4;

/** config.scoring.minSurprise / minTrRelevance (0-10), yoksa varsayılanlar. */
export function scoringThresholds(config) {
  const s = config?.scoring ?? {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 ? v : d);
  return { minSurprise: num(s.minSurprise, MIN_SURPRISE), minTrRelevance: num(s.minTrRelevance, MIN_TR_RELEVANCE) };
}

export function wowScore(surprise, trRelevance) {
  return Math.round((0.6 * surprise + 0.4 * trRelevance) * 100) / 100;
}

/** Batch başına geçecek aday sayısı: batch boyutunun passPercent'i, en az 1. */
export function passCount(batchLength, passPercent) {
  if (batchLength <= 0) return 0;
  return Math.max(1, Math.round((batchLength * passPercent) / 100));
}

function toScore(v) {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, n));
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return null;
}

/** Kısa anahtar (i, s, r, d, c, w) ya da eski uzun anahtar. */
function pick(item, short, long) {
  return item[short] !== undefined ? item[short] : item[long];
}

/**
 * Model çıktısındaki tek bir öğeyi doğrular.
 * @returns {{ ok: true, value } | { ok: false, error: string }}
 */
export function parseScoreItem(item) {
  if (!item || typeof item !== 'object') return { ok: false, error: 'öğe nesne değil' };
  const surprise = toScore(pick(item, 's', 'surprise'));
  const tr = toScore(pick(item, 'r', 'tr_relevance'));
  const isDef = toBool(pick(item, 'd', 'is_definition'));
  if (surprise === null || tr === null || isDef === null) {
    return { ok: false, error: 's/r/d (surprise/tr_relevance/is_definition) eksik ya da geçersiz' };
  }
  const category = pick(item, 'c', 'category');
  const reason = pick(item, 'w', 'reason');
  return {
    ok: true,
    value: {
      surprise,
      tr_relevance: tr,
      is_definition: isDef,
      category_raw: category ?? null,
      category: normalizeCategory(category),
      reason: typeof reason === 'string' ? reason.slice(0, 200) : '',
      wow: wowScore(surprise, tr),
    },
  };
}

function extractItems(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.items)) return json.items;
  if (json && typeof json === 'object') {
    const arr = Object.values(json).find(Array.isArray);
    if (arr) return arr;
  }
  return null;
}

/**
 * Bir batch'in puanlarına göre karar verir (saf).
 * @param {Array<{ cand: object, score: object }>} scored  geçerli puanı olanlar
 * @param {number} batchLength
 * @param {number} passPercent
 * @param {{ minSurprise?: number, minTrRelevance?: number }} [thresholds]
 * @returns {Array<{ cand, score, decision: 'scored' | string }>}  string = reject_reason
 */
export function decideBatch(scored, batchLength, passPercent, thresholds = {}) {
  const minSurprise = thresholds.minSurprise ?? MIN_SURPRISE;
  const minTr = thresholds.minTrRelevance ?? MIN_TR_RELEVANCE;
  const out = [];
  const eligible = [];
  for (const entry of scored) {
    const s = entry.score;
    let reason = null;
    if (s.is_definition) reason = 'definition';
    else if (s.surprise < minSurprise) reason = 'low_surprise';
    else if (s.tr_relevance < minTr) reason = 'low_relevance';
    else if (!s.category) reason = 'invalid_category';
    if (reason) out.push({ ...entry, decision: reason });
    else eligible.push(entry);
  }
  const k = passCount(batchLength, passPercent);
  const ranked = eligible
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score.wow - a.e.score.wow || b.e.score.surprise - a.e.score.surprise || a.i - b.i)
    .map(({ e }) => e);
  ranked.forEach((e, rank) => out.push({ ...e, decision: rank < k ? STATUS.SCORED : 'below_cut' }));
  return out;
}

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runScore(deps, { limit = 50 } = {}) {
  const stats = newStats('score');
  const batchSize = deps.config?.scoring?.batchSize ?? 10;
  const passPercent = deps.config?.scoring?.passPercent ?? 30;
  const thresholds = scoringThresholds(deps.config);
  const maxTokens = roleMaxTokens(deps.config, 'scorer', SCORE_MAX_TOKENS);
  const cands = await deps.repo.listByStatus(STATUS.NEW, limit, { scoresHas: 'dedup_hook' });
  stats.splits = 0;

  const queue = [];
  for (let start = 0; start < cands.length; start += batchSize) queue.push(cands.slice(start, start + batchSize));

  while (queue.length > 0) {
    const batch = queue.shift();
    const items = batch.map((c, i) => ({ id: i + 1, lang: c.lang, hook: c.hook_text }));

    let res;
    try {
      res = await deps.llm.chat('scorer', {
        ...buildScorePrompt(items),
        json: true,
        maxTokens,
        // Tek adaylık batch bölünemez: "çok büyük" derse zincir yedek modele geçer.
        splittable: batch.length > 1,
      });
    } catch (err) {
      if (isFatal(err)) throw err;
      if (isTooLarge(err) && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        queue.unshift(batch.slice(0, mid), batch.slice(mid));
        stats.splits += 1;
        deps.log?.(
          `[score] istek dakikalık sınırdan büyük (${err.provider}/${err.model}${err.metric ? ` ${err.metric}` : ''}${err.limit ? ` limit=${err.limit}` : ''}); batch ${batch.length} → ${mid} + ${batch.length - mid}`,
        );
        continue;
      }
      if (isExhausted(err)) {
        markDeferred(deps, stats, err, batch.length + queue.reduce((n, b) => n + b.length, 0));
        return stats;
      }
      for (const c of batch) {
        stats.seen += 1;
        await recordFailure(deps, c, err, stats);
      }
      continue;
    }

    stats.seen += batch.length;
    const list = extractItems(res?.json);
    const byId = new Map();
    for (const it of list ?? []) {
      const id = Number(it?.i ?? it?.id);
      if (Number.isInteger(id) && !byId.has(id)) byId.set(id, it);
    }

    const valid = [];
    for (let i = 0; i < batch.length; i += 1) {
      const cand = batch[i];
      const parsed = byId.has(i + 1) ? parseScoreItem(byId.get(i + 1)) : { ok: false, error: 'puanlayıcı bu adayı döndürmedi' };
      if (!parsed.ok) {
        await recordFailure(deps, cand, new Error(parsed.error), stats);
        continue;
      }
      valid.push({ cand, score: parsed.value });
    }

    // Kesim, modelin geçerli puan verdiği aday sayısına göre değil batch boyutuna göre.
    for (const { cand, score, decision } of decideBatch(valid, batch.length, passPercent, thresholds)) {
      const scores = {
        ...(cand.scores ?? {}),
        surprise: score.surprise,
        tr_relevance: score.tr_relevance,
        is_definition: score.is_definition,
        category: score.category,
        category_raw: score.category_raw,
        reason: score.reason,
        wow: score.wow,
        scorer_model: res?.model ?? null,
        scored_at: nowIso(deps.now),
      };
      if (decision === STATUS.SCORED) {
        await deps.repo.updateCandidate(cand.id, { status: STATUS.SCORED, scores });
        stats.advanced += 1;
      } else {
        await reject(deps, cand, decision, stats, { scores });
      }
    }
  }
  return stats;
}
