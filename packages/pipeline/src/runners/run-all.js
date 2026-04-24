#!/usr/bin/env node
// src/runners/run-all.js
// Tum kaynaklari sirayla calistirir ve Supabase'e toplu olarak yukler.
// Kullanim: node src/runners/run-all.js

import 'dotenv/config';
import { convertToFact } from '../lib/groq.js';
import { findRecentTopicPreflight, getExistingSourceUrls, insertFact } from '../lib/supabase.js';
import { fetchMedlinePlusArticles } from '../sources/medlineplus.js';
import { fetchNasaApod } from '../sources/nasa.js';
import { fetchPdfCuratedArticles } from '../sources/pdf-curated.js';
import { fetchStanfordPhilosophy } from '../sources/stanford.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

const DEFAULT_CONFIG = {
  wikipedia: { count: 30, lang: 'en' },
  stanford: { count: 4 },
  medlineplus: { count: 4 },
  nasa: { count: 30 },
  pdfCurated: { count: 0, filePath: null },
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const overrides = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      continue;
    }

    const parsed = Number.parseInt(nextValue, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      continue;
    }

    if (arg === '--wikipedia-count') {
      overrides.wikipedia = { ...(overrides.wikipedia ?? {}), count: parsed };
    }

    if (arg === '--stanford-count') {
      overrides.stanford = { ...(overrides.stanford ?? {}), count: parsed };
    }

    if (arg === '--medlineplus-count') {
      overrides.medlineplus = { ...(overrides.medlineplus ?? {}), count: parsed };
    }

    if (arg === '--nasa-count') {
      overrides.nasa = { ...(overrides.nasa ?? {}), count: parsed };
    }

    if (arg === '--pdf-curated-count') {
      overrides.pdfCurated = { ...(overrides.pdfCurated ?? {}), count: parsed };
    }

    if (arg === '--pdf-curated-file') {
      overrides.pdfCurated = { ...(overrides.pdfCurated ?? {}), filePath: nextValue };
    }
  }

  return {
    wikipedia: { ...DEFAULT_CONFIG.wikipedia, ...(overrides.wikipedia ?? {}) },
    stanford: { ...DEFAULT_CONFIG.stanford, ...(overrides.stanford ?? {}) },
    medlineplus: { ...DEFAULT_CONFIG.medlineplus, ...(overrides.medlineplus ?? {}) },
    nasa: { ...DEFAULT_CONFIG.nasa, ...(overrides.nasa ?? {}) },
    pdfCurated: { ...DEFAULT_CONFIG.pdfCurated, ...(overrides.pdfCurated ?? {}) },
  };
}

function createRunStats() {
  return {
    processed: 0,
    saved: 0,
    duplicate_source_url: 0,
    duplicate_title: 0,
    duplicate_recent_topic: 0,
    quality_rejected: 0,
    consistency_rejected: 0,
    insert_error: 0,
    groq_failed: 0,
    verified_true: 0,
  };
}

function applyInsertResult(stats, result) {
  stats.processed += 1;

  if (result.verified) {
    stats.verified_true += 1;
  }

  if (result.status in stats) {
    stats[result.status] += 1;
    return;
  }

  if (result.status.startsWith('quality_rejected:')) {
    stats.quality_rejected += 1;
    return;
  }

  if (result.status.startsWith('consistency_rejected:')) {
    stats.consistency_rejected += 1;
  }
}

function logSourceSummary(label, stats) {
  console.log(`\n--- ${label} ozeti ---`);
  console.log(`   processed: ${stats.processed}`);
  console.log(`   saved: ${stats.saved}`);
  console.log(`   duplicate_source_url: ${stats.duplicate_source_url}`);
  console.log(`   duplicate_title: ${stats.duplicate_title}`);
  console.log(`   duplicate_recent_topic: ${stats.duplicate_recent_topic}`);
  console.log(`   quality_rejected: ${stats.quality_rejected}`);
  console.log(`   consistency_rejected: ${stats.consistency_rejected}`);
  console.log(`   insert_error: ${stats.insert_error}`);
  console.log(`   groq_failed: ${stats.groq_failed}`);
  console.log(`   verified_true: ${stats.verified_true}`);
}

function mergeStats(total, partial) {
  for (const key of Object.keys(total)) {
    total[key] += partial[key] ?? 0;
  }
}

async function main() {
  console.log('SmartScrolling AI data pipeline baslatildi.\n');

  validateEnv();
  const CONFIG = parseArgs(process.argv);

  const totalStats = createRunStats();
  const wikipediaStats = createRunStats();
  const stanfordStats = createRunStats();
  const medlinePlusStats = createRunStats();
  const nasaStats = createRunStats();
  const pdfCuratedStats = createRunStats();

  console.log(`\nWikipedia'dan ${CONFIG.wikipedia.count} makale cekiliyor...`);
  const wikiArticles = await fetchWikipediaArticles(CONFIG.wikipedia.lang, CONFIG.wikipedia.count);
  console.log(`   ${wikiArticles.length} makale alindi, Groq ile isleniyor...`);
  const existingWikiUrls = await getExistingSourceUrls(wikiArticles.map((article) => article.url));

  for (const article of wikiArticles) {
    if (existingWikiUrls.has(article.url)) {
      console.log(`[Preflight] skipped existing Wikipedia source_url: "${article.title}"`);
      wikipediaStats.duplicate_source_url += 1;
      continue;
    }

    const recentTopicDuplicate = await findRecentTopicPreflight({
      title: article.title,
      category: article.category,
    });

    if (recentTopicDuplicate) {
      console.log(
        `[Preflight] skipped recent Wikipedia topic: "${article.title}" -> recent="${recentTopicDuplicate.title}"`,
      );
      wikipediaStats.duplicate_recent_topic += 1;
      continue;
    }

    const fact = await convertToFact(
      article.extract,
      'Wikipedia',
      article.url,
      article.category,
      article.imageUrl,
      article.title,
    );

    if (!fact) {
      wikipediaStats.groq_failed += 1;
      continue;
    }

    const result = await insertFact(fact);
    applyInsertResult(wikipediaStats, result);
    await sleep(200);
  }

  logSourceSummary('Wikipedia', wikipediaStats);
  mergeStats(totalStats, wikipediaStats);

  console.log(`\nStanford Encyclopedia'dan ${CONFIG.stanford.count} makale cekiliyor...`);
  const stanfordArticles = await fetchStanfordPhilosophy(CONFIG.stanford.count);
  console.log(`   ${stanfordArticles.length} felsefe verisi alindi, Groq ile isleniyor...`);
  const existingStanfordUrls = await getExistingSourceUrls(
    stanfordArticles.map((article) => article.url),
  );

  for (const article of stanfordArticles) {
    if (existingStanfordUrls.has(article.url)) {
      console.log(`[Preflight] skipped existing Stanford source_url: "${article.title}"`);
      stanfordStats.duplicate_source_url += 1;
      continue;
    }

    const recentTopicDuplicate = await findRecentTopicPreflight({
      title: article.title,
      category: article.category,
    });

    if (recentTopicDuplicate) {
      console.log(
        `[Preflight] skipped recent Stanford topic: "${article.title}" -> recent="${recentTopicDuplicate.title}"`,
      );
      stanfordStats.duplicate_recent_topic += 1;
      continue;
    }

    const fact = await convertToFact(
      article.extract,
      article.sourceLabel,
      article.url,
      article.category,
      article.imageUrl,
      article.title,
    );

    if (!fact) {
      stanfordStats.groq_failed += 1;
      continue;
    }

    const result = await insertFact(fact);
    applyInsertResult(stanfordStats, result);
    await sleep(200);
  }

  logSourceSummary('Stanford Encyclopedia', stanfordStats);
  mergeStats(totalStats, stanfordStats);

  console.log(`\nMedlinePlus'tan ${CONFIG.medlineplus.count} makale cekiliyor...`);
  const medlinePlusArticles = await fetchMedlinePlusArticles(CONFIG.medlineplus.count);
  console.log(`   ${medlinePlusArticles.length} saglik verisi alindi, Groq ile isleniyor...`);
  const existingMedlineUrls = await getExistingSourceUrls(
    medlinePlusArticles.map((article) => article.url),
  );

  for (const article of medlinePlusArticles) {
    if (existingMedlineUrls.has(article.url)) {
      console.log(`[Preflight] skipped existing MedlinePlus source_url: "${article.title}"`);
      medlinePlusStats.duplicate_source_url += 1;
      continue;
    }

    const recentTopicDuplicate = await findRecentTopicPreflight({
      title: article.title,
      category: article.category,
    });

    if (recentTopicDuplicate) {
      console.log(
        `[Preflight] skipped recent MedlinePlus topic: "${article.title}" -> recent="${recentTopicDuplicate.title}"`,
      );
      medlinePlusStats.duplicate_recent_topic += 1;
      continue;
    }

    const fact = await convertToFact(
      article.extract,
      article.sourceLabel,
      article.url,
      article.category,
      article.imageUrl,
      article.title,
    );

    if (!fact) {
      medlinePlusStats.groq_failed += 1;
      continue;
    }

    const result = await insertFact(fact);
    applyInsertResult(medlinePlusStats, result);
    await sleep(200);
  }

  logSourceSummary('MedlinePlus', medlinePlusStats);
  mergeStats(totalStats, medlinePlusStats);

  console.log(`\nNASA APOD'dan son ${CONFIG.nasa.count} gun cekiliyor...`);
  const nasaItems = await fetchNasaApod(CONFIG.nasa.count);
  console.log(`   ${nasaItems.length} astronomi verisi alindi, Groq ile isleniyor...`);
  const existingNasaUrls = await getExistingSourceUrls(nasaItems.map((item) => item.url));

  for (const item of nasaItems) {
    if (existingNasaUrls.has(item.url)) {
      console.log(`[Preflight] skipped existing NASA source_url: "${item.title}"`);
      nasaStats.duplicate_source_url += 1;
      continue;
    }

    const recentTopicDuplicate = await findRecentTopicPreflight({
      title: item.title,
      category: item.category,
    });

    if (recentTopicDuplicate) {
      console.log(
        `[Preflight] skipped recent NASA topic: "${item.title}" -> recent="${recentTopicDuplicate.title}"`,
      );
      nasaStats.duplicate_recent_topic += 1;
      continue;
    }

    const fact = await convertToFact(
      item.extract,
      item.sourceLabel ?? 'NASA APOD',
      item.url,
      item.category,
      item.imageUrl,
      item.title,
    );

    if (!fact) {
      nasaStats.groq_failed += 1;
      continue;
    }

    const result = await insertFact(fact);
    applyInsertResult(nasaStats, result);
    await sleep(200);
  }

  logSourceSummary('NASA APOD', nasaStats);
  mergeStats(totalStats, nasaStats);

  if (CONFIG.pdfCurated.count > 0) {
    console.log(`\nPDF curated kaynaktan ${CONFIG.pdfCurated.count} madde cekiliyor...`);
    const pdfCuratedItems = await fetchPdfCuratedArticles({
      count: CONFIG.pdfCurated.count,
      filePath: CONFIG.pdfCurated.filePath ?? undefined,
    });
    console.log(`   ${pdfCuratedItems.length} madde alindi, Groq ile isleniyor...`);
    const existingPdfCuratedUrls = await getExistingSourceUrls(
      pdfCuratedItems.map((item) => item.url),
    );

    for (const item of pdfCuratedItems) {
      if (existingPdfCuratedUrls.has(item.url)) {
        console.log(`[Preflight] skipped existing PDF curated source_url: "${item.title}"`);
        pdfCuratedStats.duplicate_source_url += 1;
        continue;
      }

      const recentTopicDuplicate = await findRecentTopicPreflight({
        title: item.title,
        category: item.category,
      });

      if (recentTopicDuplicate) {
        console.log(
          `[Preflight] skipped recent PDF curated topic: "${item.title}" -> recent="${recentTopicDuplicate.title}"`,
        );
        pdfCuratedStats.duplicate_recent_topic += 1;
        continue;
      }

      const fact = await convertToFact(
        item.extract,
        item.sourceLabel,
        item.url,
        item.category,
        item.imageUrl,
        item.title,
      );

      if (!fact) {
        pdfCuratedStats.groq_failed += 1;
        continue;
      }

      const result = await insertFact(fact);
      applyInsertResult(pdfCuratedStats, result);
      await sleep(200);
    }

    logSourceSummary('PDF Curated', pdfCuratedStats);
    mergeStats(totalStats, pdfCuratedStats);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('Pipeline tamamlandi');
  console.log(`   processed: ${totalStats.processed}`);
  console.log(`   saved: ${totalStats.saved}`);
  console.log(`   duplicate_source_url: ${totalStats.duplicate_source_url}`);
  console.log(`   duplicate_title: ${totalStats.duplicate_title}`);
  console.log(`   duplicate_recent_topic: ${totalStats.duplicate_recent_topic}`);
  console.log(`   quality_rejected: ${totalStats.quality_rejected}`);
  console.log(`   consistency_rejected: ${totalStats.consistency_rejected}`);
  console.log(`   insert_error: ${totalStats.insert_error}`);
  console.log(`   groq_failed: ${totalStats.groq_failed}`);
  console.log(`   verified_true: ${totalStats.verified_true}`);
  console.log('='.repeat(50));
}

function validateEnv() {
  const required = ['GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].startsWith('your_'),
  );

  if (missing.length > 0) {
    console.error('Eksik ortam degiskenleri:', missing.join(', '));
    console.error("packages/pipeline/.env dosyasini .env.example'dan kopyalayip doldurun.");
    process.exit(1);
  }

  console.log('Ortam degiskenleri dogrulandi.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Pipeline kritik hata:', err);
  process.exit(1);
});
