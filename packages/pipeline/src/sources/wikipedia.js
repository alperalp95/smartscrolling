// src/sources/wikipedia.js
// Wikipedia summary endpoint'inden kalite filtreli makale ozeti ceker.
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import {
  buildWikipediaSeedQueue,
  isLowValueWikipediaArticle as isLowValueWikipediaArticlePolicy,
  scoreWikipediaCuriositySignals,
} from '../lib/wiki-source-policy.js';
import { resolveWikipediaEntity } from '../lib/wiki-entity-resolver.js';
import { enrichWikipediaEntity } from '../lib/wiki-enrichment.js';
import { evaluateWikipediaTaxonomyDecision } from '../lib/wiki-quality-guard.js';
import { normalizeWikipediaEnrichmentToTaxonomy } from '../lib/wiki-taxonomy-normalizer.js';
import { WIKI_THEME_SEQUENCE } from '../lib/wiki-taxonomy-types.js';

const MIN_EXTRACT_LENGTH = 420;

function scoreWikipediaDiscoveryCandidate({
  title,
  extract,
  targetCategory,
  taxonomy,
  relaxedCategoryTarget,
  isRelaxedPass,
}) {
  const normalizedTitle = (title ?? '').trim();
  const normalizedExtract = (extract ?? '').trim();
  let score = 28;

  if (taxonomy?.category === targetCategory) {
    score += 10;
  } else if (relaxedCategoryTarget) {
    score += 2;
  } else {
    score -= 6;
  }

  score += Math.min(Math.floor(normalizedExtract.length / 80), 8);
  score += Math.round(Math.min(taxonomy?.confidence ?? 0, 1) * 12);
  score += scoreWikipediaCuriositySignals(normalizedTitle, normalizedExtract);

  if ((taxonomy?.signals?.length ?? 0) >= 4) {
    score += 4;
  }

  if (/(system|process|concept|field|movement|history of|importance of)/i.test(normalizedTitle)) {
    score -= 5;
  }

  if (/(^|\s)(is|was|bir)\s/.test(normalizedExtract) && normalizedExtract.length < 320) {
    score -= 4;
  }

  if (isRelaxedPass) {
    score -= 3;
  }

  return score;
}

/**
 * Wikipedia'nin random summary havuzundan filtrelenmis makaleler ceker.
 * @param {string} lang
 * @param {number} count
 * @returns {Promise<Array<{title, extract, url, imageUrl, category}>>}
 */
export async function fetchWikipediaArticles(lang = 'en', count = 20, options = {}) {
  const seededArticles = await fetchSeededWikipediaArticles(lang, count, options);

  if (seededArticles.length >= count) {
    return seededArticles.slice(0, count);
  }

  if (lang === 'tr' && seededArticles.length > 0) {
    return seededArticles;
  }

  const fallbackArticles = await fetchWikipediaArticlesInternal(
    lang,
    count - seededArticles.length,
    false,
    new Set(seededArticles.map((article) => article.url)),
    options,
  );

  return [...seededArticles, ...fallbackArticles].slice(0, count);
}

function normalizeSeedTitle(title) {
  return (title ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSeededWikipediaArticles(lang, count, options = {}) {
  const articles = [];
  const seenUrls = new Set();
  const excludedTitles = new Set(
    [...(options.excludeTitles ?? [])].map((title) => normalizeSeedTitle(title)),
  );
  const seedQueue = buildWikipediaSeedQueue(Math.max(count * 4, 30), lang);

  for (const seed of seedQueue) {
    if (articles.length >= count) {
      break;
    }

    if (excludedTitles.has(normalizeSeedTitle(seed.title))) {
      continue;
    }

    const article = await fetchWikipediaArticleByTitle(
      lang,
      seed.title,
      seed.category,
      seenUrls,
      options,
    );
    await sleep(150);

    if (!article) {
      continue;
    }

    articles.push(article);
  }

  return articles;
}

async function fetchWikipediaArticlesInternal(
  lang,
  count,
  relaxedCategoryTarget,
  inheritedSeenUrls,
  options = {},
) {
  const acceptedArticles = [];
  const candidatePool = [];
  const seenUrls = new Set(inheritedSeenUrls ?? []);
  let attempts = 0;
  const maxAttempts = count * 40;

  while (candidatePool.length < count * 4 && attempts < maxAttempts) {
    attempts += 1;
    const targetCategory = WIKI_THEME_SEQUENCE[attempts % WIKI_THEME_SEQUENCE.length];
    const isRelaxedPass = attempts > maxAttempts / 2;

    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const article = await parseWikipediaSummary(data, lang, seenUrls, targetCategory, {
        relaxedCategoryTarget,
        isRelaxedPass,
        excludedTitles: options.excludeTitles,
      });

      if (!article) {
        continue;
      }

      candidatePool.push(article);

      await sleep(300);
    } catch (err) {
      console.error('[Wikipedia] Fetch hatasi:', err.message);
    }
  }

  if (candidatePool.length === 0 && !relaxedCategoryTarget) {
    return fetchWikipediaArticlesInternal(lang, count, true, seenUrls, options);
  }

  candidatePool.sort((left, right) => right.discoveryScore - left.discoveryScore);

  const perCategoryLimit = Math.max(2, Math.ceil(count / WIKI_THEME_SEQUENCE.length) + 1);
  const categoryCounts = Object.fromEntries(WIKI_THEME_SEQUENCE.map((category) => [category, 0]));

  for (const article of candidatePool) {
    if (acceptedArticles.length >= count) {
      break;
    }

    if ((categoryCounts[article.category] ?? 0) >= perCategoryLimit) {
      continue;
    }

    acceptedArticles.push(article);
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1;
  }

  for (const article of candidatePool) {
    if (acceptedArticles.length >= count) {
      break;
    }

    if (acceptedArticles.some((accepted) => accepted.url === article.url)) {
      continue;
    }

    acceptedArticles.push(article);
  }

  return acceptedArticles.slice(0, count);
}

async function fetchWikipediaArticleByTitle(lang, title, targetCategory, seenUrls, options = {}) {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const article = await parseWikipediaSummary(data, lang, seenUrls, targetCategory, {
      relaxedCategoryTarget: false,
      isRelaxedPass: false,
      excludedTitles: options.excludeTitles,
    });

    if (!article) {
      return null;
    }

    await sleep(200);
    return article;
  } catch (err) {
    console.error('[Wikipedia] Seed fetch hatasi:', err.message);
    return null;
  }
}

async function parseWikipediaSummary(
  data,
  lang,
  seenUrls,
  targetCategory,
  { relaxedCategoryTarget, isRelaxedPass, excludedTitles },
) {
  const preferredData = await resolvePreferredWikipediaSummary(data, lang);
  const pageUrl =
    preferredData.content_urls?.desktop?.page ??
    `https://${preferredData._preferred_lang ?? lang}.wikipedia.org/wiki/${preferredData.title}`;
  const normalizedExcludedTitles = new Set(
    [...(excludedTitles ?? [])].map((title) => normalizeSeedTitle(title)),
  );

  if (seenUrls.has(pageUrl)) {
    return null;
  }

  if (normalizedExcludedTitles.has(normalizeSeedTitle(preferredData.title))) {
    return null;
  }

  if (preferredData.type && preferredData.type !== 'standard') {
    return null;
  }

  if (!preferredData.extract || preferredData.extract.length < MIN_EXTRACT_LENGTH) {
    return null;
  }

  if (isLowValueWikipediaArticlePolicy(preferredData.title, preferredData.extract, preferredData.description)) {
    return null;
  }

  const entity = resolveWikipediaEntity({
    lang: preferredData._preferred_lang ?? lang,
    summaryData: preferredData,
    fallbackUrl: pageUrl,
  });
  const enrichment = await enrichWikipediaEntity({
    lang: preferredData._preferred_lang ?? lang,
    entity,
    summaryData: preferredData,
  });
  const taxonomy = normalizeWikipediaEnrichmentToTaxonomy({
    entity,
    enrichment,
  });
  const curiosityScore = scoreWikipediaCuriositySignals(preferredData.title, preferredData.extract);
  const decision = evaluateWikipediaTaxonomyDecision({
    preferredData,
    entity,
    enrichment,
    taxonomy,
    targetCategory,
    relaxedCategoryTarget,
    curiosityScore,
  });

  if (!decision.accepted) {
    return null;
  }

  const category = taxonomy.category;
  const discoveryScore = scoreWikipediaDiscoveryCandidate({
    title: preferredData.title,
    extract: preferredData.extract,
    targetCategory,
    taxonomy,
    relaxedCategoryTarget,
    isRelaxedPass,
  });
  const minimumScore = isRelaxedPass ? 36 : 44;

  if (discoveryScore < minimumScore) {
    return null;
  }

  const wikipediaImageUrl =
    preferredData.thumbnail?.source ??
    preferredData.originalimage?.source ??
    null;
  const mediaPolicy = evaluateFactMedia({
    sourceLabel: 'Wikipedia',
    mediaUrl: wikipediaImageUrl,
  });
  const imageUrl = mediaPolicy.ok && wikipediaImageUrl
    ? wikipediaImageUrl
    : buildUnsplashUrl(preferredData.title, category);

  seenUrls.add(pageUrl);
  return {
    title: preferredData.title,
    extract: preferredData.extract,
    url: pageUrl,
    category,
    imageUrl,
    discoveryScore,
    wikiContext: {
      canonicalTitle: entity.canonicalTitle,
      normalizedCategory: taxonomy.category,
      summary: enrichment.summary,
      description: enrichment.infoboxLikeFields?.description ?? '',
      categories: enrichment.categories.slice(0, 6),
    },
  };
}

async function resolvePreferredWikipediaSummary(data, lang) {
  if (lang !== 'en' || !data?.title) {
    return { ...data, _preferred_lang: lang };
  }

  const turkishTitle = await fetchWikipediaLangTitle(data.title, 'tr');

  if (!turkishTitle) {
    return { ...data, _preferred_lang: lang };
  }

  const turkishSummary = await fetchWikipediaSummaryByTitle('tr', turkishTitle);

  if (!turkishSummary?.extract || turkishSummary.extract.length < 180) {
    return { ...data, _preferred_lang: lang };
  }

  return { ...turkishSummary, _preferred_lang: 'tr' };
}

async function fetchWikipediaLangTitle(sourceTitle, targetLang) {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=${encodeURIComponent(sourceTitle)}` +
      `&lllang=${targetLang}&format=json&redirects=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const page = Object.values(data?.query?.pages ?? {})[0];
    const langLink = page?.langlinks?.[0];
    return typeof langLink?.['*'] === 'string' ? langLink['*'] : null;
  } catch (err) {
    console.error('[Wikipedia] Langlink fetch hatasi:', err.message);
    return null;
  }
}

async function fetchWikipediaSummaryByTitle(lang, title) {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Wikipedia] Localized summary fetch hatasi:', err.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUnsplashUrl(title, category) {
  const prompt = `${title}, ${category}, high quality cinematic photography, dark atmospheric lighting, 4k resolution`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&nologo=true`;
}
