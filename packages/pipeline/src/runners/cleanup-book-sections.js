#!/usr/bin/env node
import 'dotenv/config';
import {
  clearBookSections,
  deleteBookSourceObject,
  fetchBooksForSectionIngest,
} from '../lib/supabase.js';

function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
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
    bookId: null,
    deleteStorage: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    if (token === '--delete-storage') {
      args.deleteStorage = true;
      continue;
    }

    if (token === '--book-id') {
      args.bookId = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

async function main() {
  validateEnv();

  const args = parseArgs(process.argv.slice(2));

  if (!args.bookId) {
    throw new Error('--book-id zorunlu');
  }

  const books = await fetchBooksForSectionIngest({ bookId: args.bookId });
  const book = books[0];

  if (!book) {
    throw new Error(`Kitap bulunamadi: ${args.bookId}`);
  }

  console.log(
    `[BookSectionsCleanup] "${book.title}" apply=${args.apply} deleteStorage=${args.deleteStorage}`,
  );
  console.log(
    `   current source: ${book.source_storage_bucket ?? 'null'}/${book.source_storage_path ?? 'null'}`,
  );
  console.log(`   current total_sections: ${book.total_sections ?? 0}`);

  if (!args.apply) {
    return;
  }

  if (args.deleteStorage && book.source_storage_bucket && book.source_storage_path) {
    await deleteBookSourceObject(book.source_storage_bucket, book.source_storage_path);
    console.log('   storage object deleted');
  }

  await clearBookSections(book.id);
  console.log('   book_sections cleared and source metadata reset');
}

main().catch((error) => {
  console.error('[BookSectionsCleanup] runner failed:', error);
  process.exit(1);
});
