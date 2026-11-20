// src/v2/steps/dedup-hook.js
// Tekrar-1: `new` adayların kancasını embedding'e çevirir, mevcut kartlar + adaylarla
// karşılaştırır (match_similar), gri bölgede hakeme sorar (decideDuplicate).
// Tekrar → rejected:duplicate_<reason>. Embedding adaya kaydedilir.
// Embedding servisi çökerse aday `new` kalır (puanlamaya geçmez; scores.dedup_hook yok).
import { buildJudgePrompt, decideDuplicate } from '../../dedup/index.js';
import {
  STATUS,
  createJudge,
  dedupThresholds,
  forEachCandidate,
  grayZoneLow,
  isExhausted,
  isFatal,
  markDeferred,
  newStats,
  nowIso,
  recordFailure,
  reject,
} from './common.js';

export const DEDUP_HOOK_MATCH_LIMIT = 5;

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runDedupHook(deps, { limit = 50 } = {}) {
  const stats = newStats('dedup-hook');
  const cands = await deps.repo.listByStatus(STATUS.NEW, limit, { scoresLacks: 'dedup_hook' });
  if (cands.length === 0) return stats;

  // Tek embed çağrısı (LLM katmanı batchSize'a böler).
  let vectors;
  try {
    ({ vectors } = await deps.llm.embed(cands.map((c) => c.hook_text)));
    if (!Array.isArray(vectors) || vectors.length !== cands.length) {
      throw new Error(`embedding sayısı uyuşmuyor (${vectors?.length} != ${cands.length})`);
    }
  } catch (err) {
    if (isFatal(err)) throw err;
    if (isExhausted(err)) {
      markDeferred(deps, stats, err, cands.length);
      return stats;
    }
    // Embedding servisi hatası: hepsi `new` kalır, attempts++.
    for (const c of cands) {
      stats.seen += 1;
      await recordFailure(deps, c, err, stats);
    }
    return stats;
  }

  const thresholds = dedupThresholds(deps.config);
  const low = grayZoneLow(deps.config);

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const embedding = vectors[cands.indexOf(cand)];
    const raw = await deps.repo.matchSimilar(embedding, low, DEDUP_HOOK_MATCH_LIMIT);
    const matches = (raw ?? []).filter((m) => m.id !== cand.id && !(m.kind === 'candidate' && m.status === STATUS.REJECTED));

    const { judge, state } = createJudge(deps.llm, buildJudgePrompt);
    const decision = await decideDuplicate({
      candidate: { sourceKey: cand.source_key, text: cand.hook_text, embedding },
      matches,
      thresholds,
      judge,
    });
    if (state.exhausted) throw state.exhausted; // hakem zinciri tükendi → tekrar sayma, ertele

    const scores = { ...(cand.scores ?? {}), dedup_hook: { ...decision, at: nowIso(deps.now) } };
    if (decision.verdict === 'duplicate') {
      await reject(deps, cand, `duplicate_${decision.reason}`, stats, { embedding, scores });
      return;
    }
    await deps.repo.updateCandidate(cand.id, { embedding, scores });
    stats.advanced += 1;
  });

  return stats;
}
