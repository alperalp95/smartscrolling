import { normalizeForHash, contentHash } from './normalize.js';
import { classifySimilarity } from './similarity.js';

/** Gri bölgede hakeme sorulacak en fazla eşleşme sayısı. */
export const MAX_JUDGE_CALLS = 3;

/**
 * @typedef {object} DedupCandidate
 * @property {string} sourceKey
 * @property {string} text
 * @property {number[]} [embedding]
 */

/**
 * DB RPC `match_similar` sonucu satırı.
 * @typedef {object} SimilarMatch
 * @property {string} kind Ör. 'fact' | 'candidate'
 * @property {string | number} id
 * @property {string} text
 * @property {number} similarity Cosine benzerliği (0..1)
 */

/**
 * @typedef {object} JudgeResult
 * @property {boolean} sameFact
 * @property {string} [reason]
 */

/**
 * @callback Judge
 * @param {{ a: string, b: string }} pair
 * @returns {Promise<JudgeResult>}
 */

/**
 * @typedef {'exact_hash' | 'semantic' | 'judge_same_fact' | 'judge_different_fact' | 'judge_error' | 'no_match'} DedupReason
 */

/**
 * @typedef {object} DedupDecision
 * @property {'unique' | 'duplicate'} verdict
 * @property {DedupReason} reason
 * @property {string | number} [matchId]
 * @property {number} [similarity]
 */

/**
 * Bir adayın mevcut kartların/adayların tekrarı olup olmadığına karar verir.
 *
 * Sıra: (1) normalize-hash birebir eşleşme → duplicate/exact_hash;
 * (2) en yüksek benzerlik duplicate eşiğindeyse → duplicate/semantic (hakem çağrılmaz);
 * (3) gri bölgede en fazla 3 eşleşme benzerliği yüksekten düşüğe hakeme sorulur,
 *     biri sameFact derse duplicate/judge_same_fact, hiçbiri demezse unique/judge_different_fact;
 *     hakem hata atarsa güvenli taraf: duplicate/judge_error;
 * (4) aksi halde unique/no_match.
 *
 * @param {object} input
 * @param {DedupCandidate} input.candidate
 * @param {SimilarMatch[]} [input.matches]
 * @param {import('./similarity.js').SimilarityThresholds} [input.thresholds]
 * @param {Judge} [input.judge]
 * @returns {Promise<DedupDecision>}
 */
export async function decideDuplicate({ candidate, matches = [], thresholds, judge }) {
  const valid = (matches ?? []).filter(
    (m) => m != null && typeof m.similarity === 'number' && Number.isFinite(m.similarity),
  );

  // Katman 2: metin parmak izi.
  if (normalizeForHash(candidate?.text) !== '') {
    const candidateHash = contentHash(candidate.text);
    const exact = (matches ?? []).find(
      (m) => m != null && normalizeForHash(m.text) !== '' && contentHash(m.text) === candidateHash,
    );
    if (exact) {
      return withMatch({ verdict: 'duplicate', reason: 'exact_hash' }, exact);
    }
  }

  if (valid.length === 0) {
    return { verdict: 'unique', reason: 'no_match' };
  }

  const sorted = [...valid].sort((x, y) => y.similarity - x.similarity);
  const top = sorted[0];
  const topClass = classifySimilarity(top.similarity, thresholds);

  // Katman 3: anlam benzerliği.
  if (topClass === 'duplicate') {
    return withMatch({ verdict: 'duplicate', reason: 'semantic' }, top);
  }
  if (topClass === 'unique') {
    return { verdict: 'unique', reason: 'no_match' };
  }

  // Katman 4: hakem (gri bölge).
  if (typeof judge !== 'function') {
    throw new TypeError('decideDuplicate: judge function is required for gray-zone matches');
  }

  const grayMatches = sorted
    .filter((m) => classifySimilarity(m.similarity, thresholds) === 'gray')
    .slice(0, MAX_JUDGE_CALLS);

  for (const match of grayMatches) {
    let result;
    try {
      result = await judge({ a: candidate.text, b: match.text });
    } catch {
      return withMatch({ verdict: 'duplicate', reason: 'judge_error' }, match);
    }
    if (result?.sameFact === true) {
      return withMatch({ verdict: 'duplicate', reason: 'judge_same_fact' }, match);
    }
  }

  return withMatch({ verdict: 'unique', reason: 'judge_different_fact' }, top);
}

/**
 * @param {DedupDecision} decision
 * @param {SimilarMatch} match
 * @returns {DedupDecision}
 */
function withMatch(decision, match) {
  const out = { ...decision, matchId: match.id };
  if (typeof match.similarity === 'number' && Number.isFinite(match.similarity)) {
    out.similarity = match.similarity;
  }
  return out;
}
