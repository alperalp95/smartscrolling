#!/usr/bin/env node
import 'dotenv/config';
import { resolveWikipediaEntity } from '../lib/wiki-entity-resolver.js';
import { enrichWikipediaEntity } from '../lib/wiki-enrichment.js';
import { normalizeWikipediaEnrichmentToTaxonomy } from '../lib/wiki-taxonomy-normalizer.js';

const lang = process.argv[2] ?? 'tr';
const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';
const titles = [
  'Türkiye',
  'Albert Einstein',
  'Kuantum mekaniği',
  'Yapay zekâ',
  'Fotosentez',
  'Osmanlı İmparatorluğu',
  'Sokrates',
  'DNA',
  'Kara delik',
  'Yanardağ',
  'Satranç',
  'Pablo Picasso',
];

async function classify(title) {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    return { title, category: null, confidence: 0 };
  }

  const data = await res.json();
  const entity = resolveWikipediaEntity({ lang, summaryData: data, fallbackUrl: data.content_urls?.desktop?.page });
  const enrichment = await enrichWikipediaEntity({ lang, entity, summaryData: data });
  const taxonomy = normalizeWikipediaEnrichmentToTaxonomy({ entity, enrichment });
  return {
    title,
    category: taxonomy.category ?? 'unknown',
    confidence: Number((taxonomy.confidence ?? 0).toFixed(2)),
    cacheStatus: enrichment.cacheStatus,
  };
}

console.log(`[Wikipedia Shadow Test] lang=${lang}`);
const firstPass = [];

for (const title of titles) {
  const result = await classify(title);
  firstPass.push(result);
  console.log(JSON.stringify(result));
}

const classifiedCount = firstPass.filter((result) => result.category !== 'unknown').length;
console.log('[Wikipedia Shadow Test] summary', JSON.stringify({
  total: firstPass.length,
  classifiedCount,
  classifiedRate: Number((classifiedCount / firstPass.length).toFixed(2)),
}, null, 2));
