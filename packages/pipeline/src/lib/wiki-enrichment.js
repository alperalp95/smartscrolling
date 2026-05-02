import {
  buildWikipediaEnrichmentCacheKey,
  getWikipediaEnrichmentCache,
  setWikipediaEnrichmentCache,
} from './wiki-enrichment-cache.js';

const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';

const MAINTENANCE_CATEGORY_PATTERNS = [
  /\bvikipedi maddeleri\b/i,
  /\btanımlayıcısı olan\b/i,
  /\btanimlayicisi olan\b/i,
  /\bkaynak şablonu\b/i,
  /\bkaynak sablonu\b/i,
  /\bkaynak gösterme\b/i,
  /\bkaynak gosterme\b/i,
  /\bek kaynaklar gereken\b/i,
  /\bkaynaksız\b/i,
  /\bkaynaksiz\b/i,
  /\bdesteklenmeyen parametre\b/i,
  /\botomatik boyutlandırılan\b/i,
  /\botomatik boyutlandirilan\b/i,
  /\banlam ayrımı gereken bağlantı\b/i,
  /\banlam ayrimi gereken baglanti\b/i,
  /\bpasaj içeren\b/i,
  /\bpasaj iceren\b/i,
  /\bcommons kategori bağlantısı\b/i,
  /\bcommons kategori baglantisi\b/i,
  /\bvikiveri\b/i,
  /\btüm taslak\b/i,
  /\btum taslak\b/i,
  /\btaslak maddeler\b/i,
  /\bwebarşiv\b/i,
  /\bwebarsiv\b/i,
  /\bölü dış bağlantı\b/i,
  /\bolu dis baglanti\b/i,
  /\bhatalı\b/i,
  /\bhatali\b/i,
  /\bkırmızı bağlantı\b/i,
  /\bkirmizi baglanti\b/i,
  /^KB1\b/i,
];

function isUsefulWikipediaCategory(category) {
  return !MAINTENANCE_CATEGORY_PATTERNS.some((pattern) => pattern.test(category));
}

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
      .filter(Boolean)
      .filter(isUsefulWikipediaCategory);
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
