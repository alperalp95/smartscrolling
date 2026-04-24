function parseGutenbergBookId(epubUrl) {
  const match = epubUrl?.match(/\/ebooks\/(\d+)/i);
  return match?.[1] ?? null;
}

function normalizeTextResponse(text) {
  return text.replace(/^\uFEFF/, '').trim();
}

export function buildGutenbergTextCandidates(epubUrl) {
  const bookId = parseGutenbergBookId(epubUrl);

  if (!bookId) {
    return [];
  }

  return [
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`,
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt.utf8`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}-8.txt`,
  ];
}

export async function downloadFirstAvailableGutenbergText(epubUrl) {
  const candidates = buildGutenbergTextCandidates(epubUrl);

  if (candidates.length === 0) {
    throw new Error('Unsupported Gutenberg url');
  }

  const failures = [];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          'User-Agent': 'SmartScrolling Books Pipeline/1.0',
        },
      });

      if (!response.ok) {
        failures.push(`${candidate} -> ${response.status}`);
        continue;
      }

      const text = normalizeTextResponse(await response.text());

      if (!text) {
        failures.push(`${candidate} -> empty body`);
        continue;
      }

      return {
        url: candidate,
        text,
      };
    } catch (error) {
      failures.push(`${candidate} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`No downloadable Gutenberg text found. ${failures.join(' | ')}`);
}
