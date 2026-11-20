// src/v2/steps/dedup-card.js
// Tekrar-2: `written` kart taslağının (title + content) contentHash'i ve embedding'i
// çıkarılır, yayınlanmış/kuyruktaki kartlara (match_similar, kind='fact') karşı
// decideDuplicate. Tekrar → rejected:duplicate_card_<reason>.
// Geçen kartta scores.dedup_card işaretlenir; hash taslağa, embedding scores.draft_embedding'e
// yazılır (enqueue facts.embedding için kullanır). Embedding hatasında aday `written` kalır.
import { buildJudgePrompt, contentHash, decideDuplicate } from '../../dedup/index.js';
import {
  STATUS,
  createJudge,
  dedupThresholds,
  forEachCandidate,
  grayZoneLow,
  newStats,
  nowIso,
  reject,
} from './common.js';

/** RPC sonucu kart + aday karışık ve tek limitli; adaylar elendikten sonra yeterli kart kalsın diye geniş. */
export const DEDUP_CARD_MATCH_LIMIT = 10;

/** facts.content_hash ve match_similar ile aynı metin biçimi: title\ncontent */
export function cardText(draft) {
  return `${String(draft?.title ?? '').trim()}\n${String(draft?.content ?? '').trim()}`;
}

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runDedupCard(deps, { limit = 50 } = {}) {
  const stats = newStats('dedup-card');
  const cands = await deps.repo.listByStatus(STATUS.WRITTEN, limit, { scoresLacks: 'dedup_card' });
  const thresholds = dedupThresholds(deps.config);
  const low = grayZoneLow(deps.config);

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const draft = cand.scores?.draft;
    if (!draft?.title || !draft?.content) throw new Error('kart taslağı (scores.draft) yok');
    const text = cardText(draft);
    const hash = contentHash(text);

    const { vectors } = await deps.llm.embed([text]);
    const embedding = vectors?.[0];
    if (!Array.isArray(embedding)) throw new Error('embedding dönmedi');

    const raw = await deps.repo.matchSimilar(embedding, low, DEDUP_CARD_MATCH_LIMIT);
    const matches = (raw ?? []).filter((m) => m.kind === 'fact');

    const { judge, state } = createJudge(deps.llm, buildJudgePrompt);
    const decision = await decideDuplicate({
      candidate: { sourceKey: cand.source_key, text, embedding },
      matches,
      thresholds,
      judge,
    });
    if (state.exhausted) throw state.exhausted;

    const scores = {
      ...cand.scores,
      draft: { ...draft, content_hash: hash },
      dedup_card: { ...decision, at: nowIso(deps.now) },
    };
    if (decision.verdict === 'duplicate') {
      await reject(deps, cand, `duplicate_card_${decision.reason}`, stats, { scores });
      return;
    }
    await deps.repo.updateCandidate(cand.id, { scores: { ...scores, draft_embedding: embedding } });
    stats.advanced += 1;
  });
  return stats;
}
