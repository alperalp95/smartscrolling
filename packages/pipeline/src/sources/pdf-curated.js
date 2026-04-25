import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_LABEL = 'Luzumsuz Bilgiler Ansiklopedisi';
const PDF_EXTRACT_MAX_CHARS = 1500;
const DEFAULT_SAMPLE_PATH = path.resolve(
  process.cwd(),
  'data',
  'pdf-curated',
  'luzumsuz-bilgiler-1.sample.json',
);

function cleanPdfExtract(text, sourceTitle) {
  let cleaned = (text ?? '').trim();

  // Remove title repetition at start of extract
  if (sourceTitle) {
    const firstLine = cleaned.split('\n')[0].trim();
    if (firstLine === sourceTitle.trim()) {
      cleaned = cleaned.slice(cleaned.indexOf('\n') + 1).trim();
    }
  }

  // Merge OCR-split characters line by line
  const lines = cleaned.split('\n');
  const merged = [];

  for (const line of lines) {
    const t = line.trim();

    // Skip isolated page numbers
    if (/^\d{1,3}$/.test(t)) {
      continue;
    }

    // Single-char line: OCR artifact (Turkish special char or letter fragment)
    if (t.length === 1 && merged.length > 0) {
      merged[merged.length - 1] += t;
      continue;
    }

    // Short fragment (2-4 chars, no spaces) continuing a word
    if (
      t.length >= 2 &&
      t.length <= 4 &&
      !/\s/.test(t) &&
      merged.length > 0 &&
      !/[.!?:]\s*$/.test(merged[merged.length - 1])
    ) {
      merged[merged.length - 1] += t;
      continue;
    }

    // Empty line: preserve as paragraph break (de-duplicate)
    if (t.length === 0) {
      if (merged.length > 0 && merged[merged.length - 1] !== '') {
        merged.push('');
      }
      continue;
    }

    merged.push(t);
  }

  return merged
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, PDF_EXTRACT_MAX_CHARS);
}

function normalizeCategory(category) {
  const normalized = typeof category === 'string' ? category.trim().toLowerCase() : '';

  if (['science', 'history', 'philosophy', 'technology', 'health'].includes(normalized)) {
    return normalized;
  }

  return 'history';
}

function buildSourceUrl(sourceSlug, entryId) {
  return `pdf-curated://${sourceSlug}/${encodeURIComponent(entryId)}`;
}

function buildSourceSlug(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  return baseName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export async function fetchPdfCuratedArticles({
  filePath = DEFAULT_SAMPLE_PATH,
  count = 10,
  offset = 0,
  sourceLabel = DEFAULT_SOURCE_LABEL,
} = {}) {
  const raw = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/u, '');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('[PDFCurated] source file must be a JSON array');
  }

  const sourceSlug = buildSourceSlug(filePath);

  return parsed
    .filter(
      (entry) =>
        entry &&
        typeof entry.title === 'string' &&
        typeof entry.extract === 'string' &&
        entry.title.trim() &&
        entry.extract.trim(),
    )
    .slice(offset, offset + count)
    .map((entry, index) => ({
      title: entry.title.trim(),
      extract: cleanPdfExtract(entry.extract, entry.title),
      url: buildSourceUrl(sourceSlug, entry.id ?? `${offset + index + 1}`),
      sourceLabel,
      category: normalizeCategory(entry.category),
      imageUrl: null,
      pageRef: typeof entry.pages === 'string' ? entry.pages.trim() : null,
      sourceMeta: {
        sourceKind: 'pdf_curated',
        pageRef: typeof entry.pages === 'string' ? entry.pages.trim() : null,
      },
    }));
}
