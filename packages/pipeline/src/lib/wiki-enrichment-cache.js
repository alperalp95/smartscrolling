const enrichmentCache = new Map();

export function buildWikipediaEnrichmentCacheKey({ lang, entity }) {
  const title = entity?.canonicalTitle || entity?.displayTitle || '';
  return `${lang || entity?.lang || 'tr'}:${title.toLocaleLowerCase('tr-TR')}`;
}

export function getWikipediaEnrichmentCache(key) {
  return enrichmentCache.get(key) ?? null;
}

export function setWikipediaEnrichmentCache(key, value) {
  enrichmentCache.set(key, value);
}

export function getWikipediaEnrichmentCacheStats() {
  return { size: enrichmentCache.size };
}
