// src/v2/steps/dedup-card.js
// Tekrar-2: `written` kart taslağının (title + content) contentHash'i ve embedding'i
// çıkarılır, yayınlanmış/kuyruktaki kartlara (match_similar, p_kinds=['fact']) VE aynı run'da
// daha önce Tekrar-2'yi geçmiş taslaklara (bellek içi liste, deps.runDrafts) karşı
// decideDuplicate. Tekrar → rejected:duplicate_card_<reason>.
// Neden bellek içi liste: yazılan kartlar enqueue'dan önce facts'te yok; aynı olguyu farklı
// kancayla taşıyan iki aday aynı run'da birbirini göremezdi.
// Geçen kartta scores.dedup_card işaretlenir; hash taslağa, embedding scores.draft_embedding'e
// yazılır (enqueue facts.embedding için kullanır). Embedding hatasında aday `written` kalır.
import {
  buildJudgePrompt,
  contentHash,
  cosineSimilarity,
  decideDuplicate,
} from '../../dedup/index.js';
import {
  STATUS,
  createJudge,
  dedupThresholds,
  forEachCandidate,
  grayZoneLow,
  newStats,
  nowIso,
  reject,
  roleMaxTokens,
} from './common.js';

/** match_similar artık p_kinds=['fact'] ile sadece kart döndürür. */
export const DEDUP_CARD_MATCH_LIMIT = 5;

/**
 * Aynı run'daki taslaklarla benzerlik (match_similar satırı biçiminde, kind='run_draft').
 * @param {Array<{ id, text, embedding }>} runDrafts
 */
export function matchRunDrafts(runDrafts, embedding, threshold, selfId) {
  const out = [];
  for (const d of runDrafts ?? []) {
    if (d.id === selfId || !Array.isArray(d.embedding) || d.embedding.length !== embedding.length)
      continue;
    const similarity = cosineSimilarity(d.embedding, embedding);
    if (similarity >= threshold)
      out.push({ kind: 'run_draft', id: d.id, text: d.text, similarity });
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}

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
  // runSteps run başına bir liste verir; adım tek başına çağrılırsa yerel liste.
  const runDrafts = Array.isArray(deps.runDrafts) ? deps.runDrafts : [];

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const draft = cand.scores?.draft;
    if (!draft?.title || !draft?.content) throw new Error('kart taslağı (scores.draft) yok');
    const text = cardText(draft);
    const hash = contentHash(text);

    const { vectors } = await deps.llm.embed([text]);
    const embedding = vectors?.[0];
    if (!Array.isArray(embedding)) throw new Error('embedding dönmedi');

    const raw = await deps.repo.matchSimilar(embedding, low, DEDUP_CARD_MATCH_LIMIT, {
      kinds: ['fact'],
    });
    const matches = [
      ...(raw ?? []).filter((m) => m.kind === 'fact'),
      ...matchRunDrafts(runDrafts, embedding, low, cand.id),
    ];

    const { judge, state } = createJudge(deps.llm, buildJudgePrompt, {
      maxTokens: roleMaxTokens(deps.config, 'judge', 200),
    });
    const decision = await decideDuplicate({
      candidate: { sourceKey: cand.source_key, text, embedding },
      matches,
      thresholds,
      judge,
    });
    if (state.exhausted) throw state.exhausted;
    if (state.error) throw state.error; // hakem çıktısı bozuk → tekrar sayma, aday hata (attempts++)

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
    runDrafts.push({ id: cand.id, text, embedding });
    stats.advanced += 1;
  });
  return stats;
}
