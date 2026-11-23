/**
 * @typedef {'duplicate' | 'gray' | 'unique'} SimilarityClass
 */

/**
 * @typedef {object} SimilarityThresholds
 * @property {number} [duplicateThreshold=0.92] Bu değer ve üstü → duplicate.
 * @property {number} [grayZoneLow=0.85] Bu değer ile duplicateThreshold arası → gray.
 */

export const DEFAULT_THRESHOLDS = Object.freeze({
  duplicateThreshold: 0.92,
  grayZoneLow: 0.85,
});

/**
 * İki vektörün cosine benzerliği. Uzunluklar farklıysa hata atar.
 * Sıfır normlu bir vektör varsa 0 döner.
 *
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (a == null || b == null || typeof a.length !== 'number' || typeof b.length !== 'number') {
    throw new TypeError('cosineSimilarity: vectors must be array-like');
  }
  if (a.length !== b.length) {
    throw new RangeError(
      `cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  if (a.length === 0) {
    throw new RangeError('cosineSimilarity: vectors must not be empty');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Benzerlik skorunu sınıflar.
 * score >= duplicateThreshold → 'duplicate'; grayZoneLow <= score < duplicateThreshold → 'gray';
 * aksi halde 'unique'.
 *
 * @param {number} score
 * @param {SimilarityThresholds} [thresholds]
 * @returns {SimilarityClass}
 */
export function classifySimilarity(score, thresholds = {}) {
  const {
    duplicateThreshold = DEFAULT_THRESHOLDS.duplicateThreshold,
    grayZoneLow = DEFAULT_THRESHOLDS.grayZoneLow,
  } = thresholds ?? {};

  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new TypeError('classifySimilarity: score must be a number');
  }
  if (grayZoneLow > duplicateThreshold) {
    throw new RangeError('classifySimilarity: grayZoneLow must be <= duplicateThreshold');
  }

  if (score >= duplicateThreshold) return 'duplicate';
  if (score >= grayZoneLow) return 'gray';
  return 'unique';
}
