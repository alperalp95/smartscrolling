import {
  buildWikipediaEnrichmentCacheKey,
  getWikipediaEnrichmentCache,
  setWikipediaEnrichmentCache,
} from './wiki-enrichment-cache.js';

const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';

async function fetchWikipediaCategories(lang, title) {
  if (!title) {
    return [];
  }

  const params = new URLSearchParams({
    action: 'query',
    prop: 'categories',
    titles: title,
    cllimit: '20',
    format: 'json',
    redirects: '1',
  });
  const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const page = Object.values(data?.query?.pages ?? {})[0];
    return (page?.categories ?? [])
      .map((category) => String(category.title ?? '').replace(/^Kategori:/i, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function enrichWikipediaEntity({ lang = 'tr', entity, summaryData }) {
  const cacheKey = buildWikipediaEnrichmentCacheKey({ lang, entity });
  const cached = getWikipediaEnrichmentCache(cacheKey);

  if (cached) {
    return { ...cached, cacheStatus: 'hit' };
  }

  const categories = await fetchWikipediaCategories(lang, entity?.canonicalTitle);
  const payload = {
    canonicalTitle: entity?.canonicalTitle ?? summaryData?.title ?? '',
    summary: summaryData?.extract ?? '',
    categories,
    relatedTitles: [],
    infoboxLikeFields: {
      description: summaryData?.description ?? entity?.description ?? '',
    },
    cacheStatus: 'miss',
  };

  setWikipediaEnrichmentCache(cacheKey, payload);
  return payload;
}
