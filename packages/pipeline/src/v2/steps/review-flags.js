// src/v2/steps/review-flags.js
// Hassas kelime taraması (saf). Eşleşen kart reddedilmez; 'review' durumunda bekler.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Metindeki hassas kök/kelimeleri döner (config'deki yazımıyla, tekrarsız, bulunma sırasıyla).
 * Kök: kelime başında eşleşir, arkasına harf gelebilir. Kelime: tam kelime.
 * @returns {string[]}
 */
export function findSensitiveTerms(text, { stems = [], words = [] } = {}) {
  const src = String(text ?? '');
  // 'tr' katlama İ/ı için, varsayılan katlama İngilizce (KILLED) için; ikisi de denenir.
  const haystacks = [src.toLocaleLowerCase('tr'), src.toLowerCase()];
  const specs = [
    ...stems.map((t) => ({ term: t, suffix: '' })),
    ...words.map((t) => ({ term: t, suffix: '(?!\\p{L})' })),
  ];
  const found = [];
  for (const { term, suffix } of specs) {
    if (!term) continue;
    let best = -1;
    for (const h of haystacks) {
      for (const t of new Set([term.toLocaleLowerCase('tr'), term.toLowerCase()])) {
        const m = new RegExp(`(?<!\\p{L})${escapeRe(t)}${suffix}`, 'u').exec(h);
        if (m && (best === -1 || m.index < best)) best = m.index;
      }
    }
    if (best !== -1) found.push({ term, index: best });
  }
  found.sort((a, b) => a.index - b.index);
  return [...new Set(found.map((f) => f.term))];
}

/**
 * Başlık + metin + kanca taranır. Eşleşme yoksa ya da config boşsa null (saf).
 * @returns {{ reasons: string[], terms: string[] } | null}
 */
export function reviewFlags(cand, card, config) {
  const stems = config?.sensitiveStems ?? [];
  const words = config?.sensitiveWords ?? [];
  if (stems.length === 0 && words.length === 0) return null;
  const text = [card?.title, card?.content, cand?.hook_text].filter(Boolean).join('\n');
  const terms = findSensitiveTerms(text, { stems, words });
  return terms.length > 0 ? { reasons: ['sensitive_term'], terms } : null;
}
