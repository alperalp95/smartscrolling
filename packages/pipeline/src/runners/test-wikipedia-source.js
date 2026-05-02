#!/usr/bin/env node
import 'dotenv/config';
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import { getExistingWikipediaSourceTitles } from '../lib/supabase.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

const lang = process.argv[2] ?? 'tr';
const count = Number.parseInt(process.argv[3] ?? '4', 10);

async function main() {
  const existingTitles = await getExistingWikipediaSourceTitles();
  const fetchCount = Math.max(count, Math.ceil(count * 6));
  const articles = (await fetchWikipediaArticles(lang, fetchCount, {
    excludeTitles: existingTitles,
  })).slice(0, count);
  const categoryCounts = {};

  console.log(
    `[Wikipedia Source Test] lang=${lang} count=${count} fetched=${articles.length} existing_seed_titles=${existingTitles.size}`,
  );

  for (const article of articles) {
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1;
    const mediaPolicy = evaluateFactMedia({
      sourceLabel: 'Wikipedia',
      mediaUrl: article.imageUrl,
    });
    console.log(
      `[Wikipedia Source Test] "${article.title}" -> ${article.category} score=${article.discoveryScore} media=${mediaPolicy.reason}`,
    );
    console.log(JSON.stringify({
      imageUrl: article.imageUrl ?? null,
      mediaOk: mediaPolicy.ok,
      wikiContext: article.wikiContext
        ? {
            canonicalTitle: article.wikiContext.canonicalTitle,
            normalizedCategory: article.wikiContext.normalizedCategory,
            categorySignals: article.wikiContext.categories?.slice(0, 4) ?? [],
          }
        : null,
    }, null, 2));
  }

  console.log('[Wikipedia Source Test] category_counts', JSON.stringify(categoryCounts, null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Wikipedia Source Test] failed:', err);
    process.exit(1);
  });
