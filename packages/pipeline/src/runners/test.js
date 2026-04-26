#!/usr/bin/env node
// Hizli test: 3 Wikipedia makalesi cek, Groq ile isle, Supabase'e kaydet.
import 'dotenv/config';
import { convertToFact } from '../lib/groq.js';
import { insertFact } from '../lib/supabase.js';
import { fetchMedlinePlusArticles } from '../sources/medlineplus.js';
import { fetchStanfordPhilosophy } from '../sources/stanford.js';
import { fetchWikipediaArticles } from '../sources/wikipedia.js';

console.log('Pipeline test baslatildi.\n');

const missing = ['GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (key) => !process.env[key] || process.env[key].startsWith('BURAYA'),
);

if (missing.length > 0) {
  console.error('Eksik key:', missing.join(', '));
  process.exit(1);
}

console.log("Key'ler dogrulandi");
console.log('Wikipedia + Stanford + MedlinePlus probe baslatiliyor...\n');

const articles = [
  ...(await fetchWikipediaArticles('en', 1)).map((article) => ({
    ...article,
    sourceLabel: 'Wikipedia',
  })),
  ...(await fetchStanfordPhilosophy(1)),
  ...(await fetchMedlinePlusArticles(1)),
];
console.log(`${articles.length} makale alindi:\n`);

for (const article of articles) {
  console.log(`  -> "${article.title}" [${article.category}]`);
  const fact = await convertToFact(
    article.extract,
    article.sourceLabel ?? 'Wikipedia',
    article.url,
    article.category,
    article.imageUrl,
    article.title,
    { wikiContext: article.wikiContext ?? null },
  );

  if (!fact) {
    console.log('    Groq donusturemedi, atlandi.\n');
    continue;
  }

  console.log(`    Groq: "${fact.title}"`);
  console.log(`    Kategori: ${fact.category} | Etiketler: ${fact.tags.join(', ')}`);

  const result = await insertFact(fact);
  console.log(
    result.ok
      ? `    Supabase'e kaydedildi! verified=${result.verified}\n`
      : `    Atlandi. status=${result.status}\n`,
  );

  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log('Test tamamlandi!');
