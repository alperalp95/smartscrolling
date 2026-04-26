#!/usr/bin/env node
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseBookSectionsFromText } from '../lib/book-sections.js';
import {
  ensureStorageBucket,
  insertBook,
  replaceBookSections,
  updateBookSourceMetadata,
  uploadBookSourceText,
} from '../lib/supabase.js';

const BUCKET = 'book-files';
const FOLDER = 'tr-books';

function parseArgs(argv) {
  const args = {
    apply: false,
    file: null,
    title: null,
    author: null,
    tier: 'premium',
    category: 'Genel',
    description: null,
    cover: null,
    maxWords: 280,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--apply') { args.apply = true; continue; }
    if (token === '--file'        && next) { args.file        = next; i += 1; continue; }
    if (token === '--title'       && next) { args.title       = next; i += 1; continue; }
    if (token === '--author'      && next) { args.author      = next; i += 1; continue; }
    if (token === '--tier'        && next) { args.tier        = next; i += 1; continue; }
    if (token === '--category'    && next) { args.category    = next; i += 1; continue; }
    if (token === '--description' && next) { args.description = next; i += 1; continue; }
    if (token === '--cover'       && next) { args.cover       = next; i += 1; continue; }
    if (token === '--max-words'   && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) args.maxWords = parsed;
      i += 1; continue;
    }
  }

  return args;
}

function isHeadingLine(line) {
  if (!line || line.length > 90) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;

  if (/^\*+\s*\*+/.test(line)) return true;

  const lettersOnly = line.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
  if (lettersOnly.length >= 3 && line === line.toUpperCase()) return true;

  if (/^[IVXLCDM]+$/i.test(line.trim())) return true;

  if (/^(bölüm|bolum|kısım|kisim|giriş|giris|önsöz|onsoz|sonuç|sonuc|fasıl|fasil)\b/i.test(line)) return true;

  return words.length <= 6 && /^[A-ZÇĞİÖŞÜ"']/.test(line) && !/[.!?,;:]$/.test(line);
}

function fixSpacedOcrChars(text) {
  return text.replace(/\b([A-ZÇĞİÖŞÜa-zçğışöşü](\s[A-ZÇĞİÖŞÜa-zçğışöşü]){3,})\b/g, (match) =>
    match.replace(/\s/g, ''),
  );
}

function preprocessBookText(rawText) {
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const cleaned = lines
    .map(fixSpacedOcrChars)
    .filter((line) => !/^(G[\s]?[öo][\s]?rsel|Görsel|Resim|Şekil|Tablo|Figure)\s*\d/i.test(line));

  const paragraphs = [];
  let current = [];

  for (const line of cleaned) {
    if (isHeadingLine(line)) {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      paragraphs.push(line);
      continue;
    }

    const lastLine = current.at(-1) ?? '';
    const prevEndsSentence = /[.!?…»"')\]]$/.test(lastLine);
    const currStartsCap = /^[A-ZÇĞİÖŞÜ"']/.test(line);

    if (current.length > 0 && prevEndsSentence && currStartsCap) {
      paragraphs.push(current.join(' '));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) paragraphs.push(current.join(' '));

  return paragraphs.join('\n\n');
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function estimateTotalPages(sections) {
  const totalWords = sections.reduce((sum, s) => sum + (s.wordCount ?? 0), 0);
  return Math.max(1, Math.ceil(totalWords / 280));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file)   { console.error('--file gerekli'); process.exit(1); }
  if (!args.title)  { console.error('--title gerekli'); process.exit(1); }
  if (!args.author) { console.error('--author gerekli'); process.exit(1); }

  const validTiers = ['free_anchor', 'premium'];
  if (!validTiers.includes(args.tier)) {
    console.error(`--tier ${args.tier} gecersiz. Gecerli: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  const rawText = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  const slug = slugify(args.title);
  const storagePath = `${FOLDER}/${slug}.txt`;

  console.log('Metin on isleme yapiliyor...');
  const processedText = preprocessBookText(rawText);

  const sections = parseBookSectionsFromText(processedText, { maxWordsPerSection: args.maxWords });
  const totalPages = estimateTotalPages(sections);

  console.log('=== ONBOARD-BOOK PREVIEW ===');
  console.log(`  Baslik   : ${args.title}`);
  console.log(`  Yazar    : ${args.author}`);
  console.log(`  Tier     : ${args.tier}`);
  console.log(`  Kategori : ${args.category}`);
  console.log(`  Max kelime/bolum: ${args.maxWords}`);
  console.log(`  Bolumler : ${sections.length}`);
  console.log(`  Sayfa est: ${totalPages}`);
  console.log(`  Storage  : ${BUCKET}/${storagePath}`);
  console.log(`  apply    : ${args.apply}`);

  console.log('\n--- Ilk 5 bolum ---');
  sections.slice(0, 5).forEach((s) => {
    console.log(`  [${s.sectionOrder}] ${s.title ?? '(basliksiz)'} — ${s.wordCount} kelime`);
    console.log(`         ${s.plainText.slice(0, 80).replace(/\n/g, ' ')}...`);
  });

  if (!args.apply) {
    console.log('\nDry-run tamamlandi. Kaydetmek icin --apply ekle.');
    return;
  }

  console.log('\nStorage bucket kontrol ediliyor...');
  await ensureStorageBucket(BUCKET);

  console.log('Metin storage\'a yukleniyor...');
  await uploadBookSourceText(BUCKET, storagePath, rawText);

  console.log('books tablosuna kayit ekleniyor...');
  const bookId = await insertBook({
    title: args.title,
    author: args.author,
    description: args.description,
    category: args.category,
    language: 'tr',
    accessTier: args.tier,
    coverUrl: args.cover,
    totalPages,
  });

  console.log(`book_sections kaydediliyor (${sections.length} bolum)...`);
  await replaceBookSections(bookId, sections);

  await updateBookSourceMetadata(bookId, {
    source_format: 'pdf_text',
    source_storage_bucket: BUCKET,
    source_storage_path: storagePath,
    total_sections: sections.length,
  });

  console.log(`\n[OK] "${args.title}" basariyla eklendi.`);
  console.log(`     book_id  : ${bookId}`);
  console.log(`     bolumler : ${sections.length}`);
  console.log(`     sayfalar : ${totalPages}`);
  console.log(`     storage  : ${BUCKET}/${storagePath}`);
}

main().catch((err) => {
  console.error('[OnboardBook] hata:', err.message);
  process.exit(1);
});
