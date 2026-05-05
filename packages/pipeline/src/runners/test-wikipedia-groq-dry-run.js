#!/usr/bin/env node
import 'dotenv/config';
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import { convertToFact } from '../lib/groq.js';
import { resolveFactLlmModel } from '../lib/llm-model-policy.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const positionals = [];
  const config = {
    lang: 'tr',
    count: 1,
    llmModel: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--lang') {
      config.lang = args[index + 1] ?? config.lang;
      index += 1;
      continue;
    }

    if (arg === '--count') {
      config.count = Number.parseInt(args[index + 1] ?? String(config.count), 10);
      index += 1;
      continue;
    }

    if (arg === '--llm') {
      config.llmModel = args[index + 1];
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      positionals.push(arg);
    }
  }

  if (positionals[0]) {
    config.lang = positionals[0];
  }

  if (positionals[1]) {
    config.count = Number.parseInt(positionals[1], 10);
  }

  if (!Number.isFinite(config.count) || config.count < 1) {
    config.count = 1;
  }

  return config;
}

const { lang, count, llmModel } = parseArgs(process.argv);
const resolvedLlm = resolveFactLlmModel(llmModel);

if (!process.env.GROQ_API_KEY) {
  console.error('[Wikipedia Groq Dry Run] GROQ_API_KEY missing');
  process.exit(1);
}

console.log(`[Wikipedia Groq Dry Run] lang=${lang} count=${count} llm=${resolvedLlm.providerModel}`);

const articles = await fetchWikipediaArticles(lang, count);

for (const article of articles) {
  const mediaPolicy = evaluateFactMedia({
    sourceLabel: 'Wikipedia',
    mediaUrl: article.imageUrl,
  });

  console.log(
    JSON.stringify(
      {
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
      },
      null,
      2,
    ),
  );

  const fact = await convertToFact(
    article.extract,
    'Wikipedia',
    article.url,
    article.category,
    article.imageUrl,
    article.title,
    { wikiContext: article.wikiContext ?? null, llmModel: resolvedLlm.providerModel },
  );

  console.log(
    JSON.stringify(
      {
        generated: Boolean(fact && !fact._conversion_failed),
        conversion_failed: fact?._conversion_failed ?? false,
        conversion_reason: fact?._conversion_reason ?? null,
        title: fact?.title ?? null,
        category: fact?.category ?? null,
        tags: fact?.tags ?? [],
        media_url: fact?.media_url ?? null,
        media_policy_reason: fact?._media_policy_reason ?? null,
        visual_key: fact?.visual_key ?? null,
        contentPreview: fact?.content?.slice(0, 280) ?? null,
      },
      null,
      2,
    ),
  );
}
