#!/usr/bin/env node
import 'dotenv/config';
import { parseBookSectionsFromText } from '../lib/book-sections.js';
import { translateBookSectionsToTurkish } from '../lib/book-translation.js';
import { downloadFirstAvailableGutenbergText } from '../lib/gutenberg-books.js';
import {
  downloadBookSourceText,
  ensureStorageBucket,
  fetchBooksForSectionIngest,
  replaceBookSections,
  updateBookSourceMetadata,
  uploadBookSourceText,
} from '../lib/supabase.js';

function validateEnv(args) {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

  if (args.translateTr) {
    required.push('GROQ_API_KEY');
  }

  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].startsWith('your_'),
  );

  if (missing.length > 0) {
    console.error('Eksik ortam degiskenleri:', missing.join(', '));
    console.error("packages/pipeline/.env dosyasini .env.example'dan kopyalayip doldurun.");
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = {
    apply: false,
    bootstrap: false,
    bookId: null,
    sectionLimit: null,
    translationMaxWords: null,
    translateTr: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    if (token === '--bootstrap') {
      args.bootstrap = true;
      continue;
    }

    if (token === '--translate-tr') {
      args.translateTr = true;
      continue;
    }

    if (token === '--book-id') {
      args.bookId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === '--section-limit') {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10);
      args.sectionLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
      continue;
    }

    if (token === '--translation-max-words') {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10);
      args.translationMaxWords = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    }
  }

  return args;
}

function logSectionPreview(book, sections) {
  console.log(`\n[BookSections] "${book.title}"`);
  console.log(`   source: ${book.source_storage_bucket}/${book.source_storage_path}`);
  console.log(`   parsed sections: ${sections.length}`);
  console.log(
    `   first titles: ${sections
      .slice(0, 3)
      .map((section) => section.title ?? `Section ${section.sectionOrder}`)
      .join(' | ')}`,
  );
}

async function buildSections(rawText, book, args) {
  const parsedSections = parseBookSectionsFromText(rawText, {
    maxWordsPerSection: args.translateTr
      ? (args.translationMaxWords ??
        Number.parseInt(process.env.GROQ_TRANSLATION_MAX_WORDS ?? '420', 10))
      : 900,
  });
  const limitedSections =
    typeof args.sectionLimit === 'number'
      ? parsedSections.slice(0, args.sectionLimit).map((section, index) => ({
          ...section,
          sectionOrder: index + 1,
        }))
      : parsedSections;

  if (!args.translateTr) {
    return limitedSections;
  }

  console.log('   translating sections to TR reader edition via Groq...');
  return await translateBookSectionsToTurkish(limitedSections, {
    bookTitle: book.title,
    author: book.author,
  });
}

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateEnv(args);
  const books = await fetchBooksForSectionIngest({ bookId: args.bookId });

  if (books.length === 0) {
    console.log('[BookSections] ingest edilecek kitap bulunamadi.');
    return;
  }

  console.log(
    `[BookSections] ${books.length} kitap icin storage -> book_sections ingest baslatildi. apply=${args.apply} bootstrap=${args.bootstrap} translate_tr=${args.translateTr} section_limit=${args.sectionLimit ?? 'all'} translation_max_words=${args.translationMaxWords ?? process.env.GROQ_TRANSLATION_MAX_WORDS ?? '420'}`,
  );

  for (const book of books) {
    let bucket = book.source_storage_bucket;
    let path = book.source_storage_path;

    const bootstrapFromGutenberg = async () => {
      if (!book.epub_url) {
        throw new Error(`epub_url is missing for "${book.title}"`);
      }

      bucket = 'book-files';
      path = `public-domain/${slugifyTitle(book.title)}.txt`;
      const source = await downloadFirstAvailableGutenbergText(book.epub_url);

      await ensureStorageBucket(bucket);
      await uploadBookSourceText(bucket, path, source.text);

      if (args.apply) {
        await updateBookSourceMetadata(book.id, {
          source_storage_bucket: bucket,
          source_storage_path: path,
          source_format: 'gutenberg_text',
        });
      }

      console.log(`\n[BookSections] bootstrapped "${book.title}" from ${source.url}`);
      return source.text;
    };

    if ((!bucket || !path) && args.bootstrap) {
      try {
        const rawText = await bootstrapFromGutenberg();
        const sections = await buildSections(rawText, book, args);

        logSectionPreview(
          {
            ...book,
            source_storage_bucket: bucket,
            source_storage_path: path,
          },
          sections,
        );

        if (args.apply) {
          const result = await replaceBookSections(book.id, sections);
          console.log(`   synced sections: ${result.totalSections}`);
        }
      } catch (error) {
        console.log(`[BookSections] skipped "${book.title}" because ${error.message}`);
      }
      continue;
    }

    if (!bucket || !path) {
      console.log(`[BookSections] skipped "${book.title}" because storage metadata is missing.`);
      continue;
    }

    let rawText;

    try {
      rawText = await downloadBookSourceText(bucket, path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!args.bootstrap) {
        throw error;
      }

      console.log(
        `[BookSections] storage read failed for "${book.title}", bootstrap deneniyor: ${message}`,
      );
      rawText = await bootstrapFromGutenberg();
    }

    const sections = await buildSections(rawText, book, args);

    logSectionPreview(
      {
        ...book,
        source_storage_bucket: bucket,
        source_storage_path: path,
      },
      sections,
    );

    if (!args.apply) {
      continue;
    }

    const result = await replaceBookSections(book.id, sections);
    console.log(`   synced sections: ${result.totalSections}`);
  }
}

main().catch((error) => {
  console.error('[BookSections] runner failed:', error);
  process.exit(1);
});
