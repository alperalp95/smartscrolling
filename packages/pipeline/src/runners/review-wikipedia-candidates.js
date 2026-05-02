#!/usr/bin/env node
import 'dotenv/config';
import { evaluateFactMedia } from '../lib/fact-media-policy.js';
import { resolveWikipediaEntity } from '../lib/wiki-entity-resolver.js';
import { enrichWikipediaEntity } from '../lib/wiki-enrichment.js';
import { evaluateWikipediaTaxonomyDecision } from '../lib/wiki-quality-guard.js';
import {
  isLowValueWikipediaArticle,
  scoreWikipediaCuriositySignals,
} from '../lib/wiki-source-policy.js';
import { normalizeWikipediaEnrichmentToTaxonomy } from '../lib/wiki-taxonomy-normalizer.js';
import { WIKI_THEME_SEQUENCE } from '../lib/wiki-taxonomy-types.js';

const lang = process.argv[2] ?? 'tr';
const attempts = Number.parseInt(process.argv[3] ?? '8', 10);
const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';

console.log(`[Wikipedia Candidate Review] lang=${lang} attempts=${attempts}`);

async function main() {
  const auditCounts = {};

  for (let index = 0; index < attempts; index += 1) {
    const targetCategory = WIKI_THEME_SEQUENCE[index % WIKI_THEME_SEQUENCE.length];
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      auditCounts.fetch_not_ok = (auditCounts.fetch_not_ok ?? 0) + 1;
      continue;
    }

    const data = await res.json();
    const entity = resolveWikipediaEntity({
      lang,
      summaryData: data,
      fallbackUrl: data.content_urls?.desktop?.page,
    });
    const enrichment = await enrichWikipediaEntity({ lang, entity, summaryData: data });
    const taxonomy = normalizeWikipediaEnrichmentToTaxonomy({ entity, enrichment });
    const imageUrl = data.thumbnail?.source ?? data.originalimage?.source ?? null;
    const mediaPolicy = evaluateFactMedia({
      sourceLabel: 'Wikipedia',
      mediaUrl: imageUrl,
    });
    const sourceLowValue = isLowValueWikipediaArticle(
      data.title,
      data.extract,
      data.description,
    );
    const curiosityScore = scoreWikipediaCuriositySignals(data.title, data.extract);
    const decision = evaluateWikipediaTaxonomyDecision({
      preferredData: data,
      entity,
      enrichment,
      taxonomy,
      targetCategory,
      relaxedCategoryTarget: false,
      curiosityScore,
    });
    const auditReasons = sourceLowValue
      ? ['source_policy_low_value', ...decision.reasons]
      : decision.reasons;
    const auditKey = decision.accepted && !sourceLowValue ? 'accepted' : auditReasons[0] ?? 'rejected';
    auditCounts[auditKey] = (auditCounts[auditKey] ?? 0) + 1;

    console.log(JSON.stringify({
      title: data.title,
      targetCategory,
      inferredCategory: taxonomy.category ?? 'unknown',
      confidence: Number((taxonomy.confidence ?? 0).toFixed(2)),
      accepted: decision.accepted && !sourceLowValue,
      reasons: auditReasons,
      curiosityScore,
      taxonomySignals: taxonomy.signals ?? [],
      imageUrl,
      mediaPolicy,
      wikiContext: {
        canonicalTitle: entity.canonicalTitle,
        normalizedCategory: taxonomy.category ?? null,
        categorySignals: enrichment.categories.slice(0, 6),
        cacheStatus: enrichment.cacheStatus,
      },
      description: data.description ?? '',
      extractPreview: String(data.extract ?? '').slice(0, 180),
    }, null, 2));
  }

  console.log('[Wikipedia Candidate Review] audit_counts', JSON.stringify(auditCounts, null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Wikipedia Candidate Review] failed:', err);
    process.exit(1);
  });
