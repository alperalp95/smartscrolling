#!/usr/bin/env node
import 'dotenv/config';
import { evaluateFactConsistency } from '../lib/consistency-policy.js';
import { convertToFact } from '../lib/groq.js';
import { getAllowedFactLlmModels, resolveFactLlmModel } from '../lib/llm-model-policy.js';
import { evaluateFactQuality } from '../lib/quality-policy.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    lang: 'tr',
    count: 2,
    models: ['groq:llama-3.1-8b-instant', 'groq:qwen/qwen3-32b'],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === '--lang' && nextValue) {
      config.lang = nextValue;
      index += 1;
      continue;
    }

    if ((arg === '--count' || arg === '--limit') && nextValue) {
      config.count = Number.parseInt(nextValue, 10);
      index += 1;
      continue;
    }

    if (arg === '--models' && nextValue) {
      config.models = nextValue
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  if (!Number.isFinite(config.count) || config.count < 1) {
    config.count = 1;
  }

  return config;
}

function wordCount(text) {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function createModelStats(providerModel) {
  return {
    providerModel,
    totalCandidates: 0,
    generated: 0,
    groqFailed: 0,
    rateLimited: 0,
    conversionFailedByReason: {},
    qualityRejected: 0,
    consistencyRejected: 0,
    approved: 0,
    totalLatencyMs: 0,
    qualityRejectedByReason: {},
    consistencyRejectedByReason: {},
  };
}

function incrementReason(bucket, reason) {
  bucket[reason] = (bucket[reason] ?? 0) + 1;
}

function summarizeStats(stats) {
  return {
    providerModel: stats.providerModel,
    totalCandidates: stats.totalCandidates,
    generated: stats.generated,
    groqFailed: stats.groqFailed,
    rateLimited: stats.rateLimited,
    conversionFailedByReason: stats.conversionFailedByReason,
    qualityRejected: stats.qualityRejected,
    consistencyRejected: stats.consistencyRejected,
    approved: stats.approved,
    avgLatencyMs:
      stats.totalCandidates > 0 ? Math.round(stats.totalLatencyMs / stats.totalCandidates) : 0,
    qualityRejectedByReason: stats.qualityRejectedByReason,
    consistencyRejectedByReason: stats.consistencyRejectedByReason,
  };
}

const config = parseArgs(process.argv);
const resolvedModels = config.models.map((model) => resolveFactLlmModel(model));

if (!process.env.GROQ_API_KEY) {
  console.error('[Fact LLM Shadow] GROQ_API_KEY missing');
  process.exit(1);
}

console.log(
  `[Fact LLM Shadow] lang=${config.lang} count=${config.count} models=${resolvedModels
    .map((model) => model.providerModel)
    .join(',')}`,
);
console.log(`[Fact LLM Shadow] allowed_models=${getAllowedFactLlmModels().join(',')}`);

const articles = await fetchWikipediaArticles(config.lang, config.count);
const statsByModel = new Map(
  resolvedModels.map((model) => [model.providerModel, createModelStats(model.providerModel)]),
);

for (const article of articles) {
  console.log(
    JSON.stringify(
      {
        event: 'candidate',
        sourceTitle: article.title,
        sourceCategory: article.category,
        discoveryScore: article.discoveryScore,
        wikiCategory: article.wikiContext?.normalizedCategory ?? null,
      },
      null,
      2,
    ),
  );

  for (const llmModel of resolvedModels) {
    const stats = statsByModel.get(llmModel.providerModel);
    stats.totalCandidates += 1;
    const startedAt = Date.now();
    const fact = await convertToFact(
      article.extract,
      'Wikipedia',
      article.url,
      article.category,
      article.imageUrl,
      article.title,
      {
        wikiContext: article.wikiContext ?? null,
        llmModel: llmModel.providerModel,
        returnFailureReason: true,
      },
    );
    const latencyMs = Date.now() - startedAt;
    stats.totalLatencyMs += latencyMs;

    if (fact?._conversion_failed) {
      const conversionReason = fact._conversion_reason ?? 'conversion_error';

      if (conversionReason === 'rate_limit') {
        stats.rateLimited += 1;
      } else {
        stats.groqFailed += 1;
      }

      incrementReason(stats.conversionFailedByReason, conversionReason);
      console.log(
        JSON.stringify(
          {
            event: 'model_result',
            providerModel: llmModel.providerModel,
            sourceTitle: article.title,
            accepted: false,
            reason: conversionReason,
            latencyMs,
          },
          null,
          2,
        ),
      );
      continue;
    }

    stats.generated += 1;
    const quality = evaluateFactQuality(fact);
    const consistency = quality.ok
      ? evaluateFactConsistency(fact)
      : { ok: true, reason: 'skipped' };

    if (!quality.ok) {
      stats.qualityRejected += 1;
      incrementReason(stats.qualityRejectedByReason, quality.reason);
    } else if (!consistency.ok) {
      stats.consistencyRejected += 1;
      incrementReason(stats.consistencyRejectedByReason, consistency.reason);
    } else {
      stats.approved += 1;
    }

    console.log(
      JSON.stringify(
        {
          event: 'model_result',
          providerModel: llmModel.providerModel,
          sourceTitle: article.title,
          accepted: quality.ok && consistency.ok,
          qualityReason: quality.reason,
          consistencyReason: consistency.reason,
          latencyMs,
          title: fact.title,
          category: fact.category,
          visualKey: fact.visual_key,
          wordCount: wordCount(fact.content),
          contentPreview: fact.content?.slice(0, 220) ?? null,
        },
        null,
        2,
      ),
    );
  }
}

console.log(
  '[Fact LLM Shadow] summary',
  JSON.stringify(
    [...statsByModel.values()].map((stats) => summarizeStats(stats)),
    null,
    2,
  ),
);
