#!/usr/bin/env node
import 'dotenv/config';
import { convertToFact } from '../lib/groq.js';
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

const lang = process.argv[2] ?? 'tr';
const count = Number.parseInt(process.argv[3] ?? '1', 10);

if (!process.env.GROQ_API_KEY) {
  console.error('[Wikipedia Groq Dry Run] GROQ_API_KEY missing');
  process.exit(1);
}

console.log(`[Wikipedia Groq Dry Run] lang=${lang} count=${count}`);

const articles = await fetchWikipediaArticles(lang, count);

for (const article of articles) {
  const mediaPolicy = evaluateFactMedia({
    sourceLabel: 'Wikipedia',
    mediaUrl: article.imageUrl,
  });

  console.log(JSON.stringify({
    sourceTitle: article.title,
    sourceCategory: article.category,
    discoveryScore: article.discoveryScore,
    imageUrl: article.imageUrl ?? null,
    mediaPolicy,
    wikiContext: article.wikiContext
      ? {
          canonicalTitle: article.wikiContext.canonicalTitle,
          normalizedCategory: article.wikiContext.normalizedCategory,
          categorySignals: article.wikiContext.categories?.slice(0, 4) ?? [],
        }
      : null,
  }, null, 2));

  const fact = await convertToFact(
    article.extract,
    'Wikipedia',
    article.url,
    article.category,
    article.imageUrl,
    article.title,
    { wikiContext: article.wikiContext ?? null },
  );

  console.log(JSON.stringify({
    generated: Boolean(fact),
    title: fact?.title ?? null,
    category: fact?.category ?? null,
    tags: fact?.tags ?? [],
    media_url: fact?.media_url ?? null,
    media_policy_reason: fact?._media_policy_reason ?? null,
    visual_key: fact?.visual_key ?? null,
    contentPreview: fact?.content?.slice(0, 280) ?? null,
  }, null, 2));
}
