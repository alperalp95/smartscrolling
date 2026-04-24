import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_LABEL = 'Luzumsuz Bilgiler Ansiklopedisi';
const DEFAULT_SAMPLE_PATH = path.resolve(
  process.cwd(),
  'data',
  'pdf-curated',
  'luzumsuz-bilgiler-1.sample.json',
);

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
    .slice(0, count)
    .map((entry, index) => ({
      title: entry.title.trim(),
      extract: entry.extract.trim(),
      url: buildSourceUrl(sourceSlug, entry.id ?? `${index + 1}`),
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
