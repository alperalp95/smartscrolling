import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_LABEL = 'Luzumsuz Bilgiler Ansiklopedisi';
const PDF_EXTRACT_MAX_CHARS = 1800;
const DEFAULT_SAMPLE_PATH = path.resolve(
  process.cwd(),
  'data',
  'pdf-curated',
  'luzumsuz-bilgiler-1.sample.json',
);

function cleanPdfExtract(text, sourceTitle) {
  const raw = (text ?? '').trim();

  // Step 1: Merge OCR-split characters line by line FIRST
  // (title itself is also OCR-broken, so merge before title check)
  const lines = raw.split('\n');
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

  let full = merged.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Step 2: Remove title repetition at start
  // OCR splits the title itself across lines, so compare ignoring all whitespace.
  if (sourceTitle) {
    const titleNoWS = sourceTitle.trim().replace(/\s+/g, '');
    const headNoWS = full.replace(/\s+/g, '').slice(0, titleNoWS.length + 5);
    if (headNoWS.startsWith(titleNoWS)) {
      // Walk full char-by-char, skip whitespace, count non-whitespace until title is consumed
      let pos = 0;
      let matched = 0;
      while (pos < full.length && matched < titleNoWS.length) {
        if (!/\s/.test(full[pos])) matched += 1;
        pos += 1;
      }
      full = full.slice(pos).trimStart();
    }
  }

  if (full.length <= PDF_EXTRACT_MAX_CHARS) {
    return full;
  }

  // Cut at last sentence boundary within the limit
  const candidate = full.slice(0, PDF_EXTRACT_MAX_CHARS);
  const lastSentenceEnd = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('! '),
    candidate.lastIndexOf('? '),
    candidate.lastIndexOf('.\n'),
    candidate.lastIndexOf('!\n'),
    candidate.lastIndexOf('?\n'),
  );

  if (lastSentenceEnd > PDF_EXTRACT_MAX_CHARS * 0.6) {
    return candidate.slice(0, lastSentenceEnd + 1).trim();
  }

  return candidate.trim();
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
