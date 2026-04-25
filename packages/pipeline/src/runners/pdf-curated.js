#!/usr/bin/env node
import 'dotenv/config';
import { convertToFact } from '../lib/groq.js';
import { findRecentTopicPreflight, getExistingSourceUrls, insertFact } from '../lib/supabase.js';
import { fetchPdfCuratedArticles } from '../sources/pdf-curated.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    count: 10,
    filePath: undefined,
    offset: 0,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === '--count' && nextValue && !nextValue.startsWith('--')) {
      const parsed = Number.parseInt(nextValue, 10);

      if (!Number.isNaN(parsed) && parsed >= 0) {
        config.count = parsed;
      }
    }

    if (arg === '--file' && nextValue && !nextValue.startsWith('--')) {
      config.filePath = nextValue;
    }

    if (arg === '--offset' && nextValue && !nextValue.startsWith('--')) {
      const parsed = Number.parseInt(nextValue, 10);

      if (!Number.isNaN(parsed) && parsed >= 0) {
        config.offset = parsed;
      }
    }
  }

  return config;
}

async function main() {
  const config = parseArgs(process.argv);
  console.log(`PDF curated source lane baslatildi. count=${config.count}`);

  const items = await fetchPdfCuratedArticles({
    count: config.count,
    filePath: config.filePath,
    offset: config.offset,
  });

  console.log(`${items.length} madde bulundu.`);
  const existingUrls = await getExistingSourceUrls(items.map((item) => item.url));

  for (const item of items) {
    if (existingUrls.has(item.url)) {
      console.log(`[Preflight] skipped existing PDF curated source_url: "${item.title}"`);
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
      console.log(`[PDFCurated] Groq failed: "${item.title}"`);
      continue;
    }

    await insertFact(fact);
  }
}

main().catch((err) => {
  console.error('[PDFCurated] kritik hata:', err);
  process.exit(1);
});
