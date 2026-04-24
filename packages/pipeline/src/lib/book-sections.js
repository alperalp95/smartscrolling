function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\uFEFF/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function stripGutenbergBoilerplate(rawText) {
  const text = normalizeWhitespace(rawText);
  const startMatch = text.match(
    /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i,
  );
  const endMatch = text.match(
    /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i,
  );

  let startIndex = 0;
  let endIndex = text.length;

  if (startMatch?.index !== undefined) {
    startIndex = startMatch.index + startMatch[0].length;
  }

  if (endMatch?.index !== undefined) {
    endIndex = endMatch.index;
  }

  return text.slice(startIndex, endIndex).trim();
}

function isRomanNumeral(value) {
  return /^[IVXLCDM]+$/i.test(value.trim());
}

function isLikelyHeading(paragraph) {
  const compact = paragraph.replace(/\s+/g, ' ').trim();

  if (!compact || compact.length > 90) {
    return false;
  }

  const words = compact.split(/\s+/);

  if (words.length > 10) {
    return false;
  }

  if (/^(chapter|book|part|section)\b/i.test(compact)) {
    return true;
  }

  if (isRomanNumeral(compact)) {
    return true;
  }

  const lettersOnly = compact.replace(/[^A-Za-z]/g, '');

  if (lettersOnly.length >= 3 && compact === compact.toUpperCase()) {
    return true;
  }

  return /^[A-Z][A-Za-z'":,\- ]+$/.test(compact) && !/[.!?]$/.test(compact);
}

export function summarizeSectionText(plainText) {
  const sentence = plainText
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)[0]
    ?.trim();

  if (!sentence) {
    return null;
  }

  return sentence.length <= 180 ? sentence : `${sentence.slice(0, 177).trimEnd()}...`;
}

export function estimateSectionPages(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 280));
}

function flushSection(sections, current) {
  if (!current.paragraphs.length) {
    return;
  }

  const plainText = current.paragraphs.join('\n\n').trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;

  sections.push({
    title: current.title ?? null,
    plainText,
    wordCount,
    summary: summarizeSectionText(plainText),
    estimatedPages: estimateSectionPages(wordCount),
  });
}

function buildDraftSections(text) {
  const paragraphs = stripGutenbergBoilerplate(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

  const sections = [];
  let current = {
    title: null,
    paragraphs: [],
  };

  for (const paragraph of paragraphs) {
    if (isLikelyHeading(paragraph)) {
      flushSection(sections, current);
      current = {
        title: paragraph,
        paragraphs: [],
      };
      continue;
    }

    current.paragraphs.push(paragraph);
  }

  flushSection(sections, current);
  return sections;
}

function chunkSection(section, maxWords = 900) {
  if (section.wordCount <= maxWords) {
    return [section];
  }

  const paragraphs = section.plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks = [];
  let currentParagraphs = [];
  let currentWords = 0;
  let chunkIndex = 1;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(/\s+/).filter(Boolean).length;

    if (currentParagraphs.length > 0 && currentWords + paragraphWords > maxWords) {
      const plainText = currentParagraphs.join('\n\n');
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;
      chunks.push({
        title: section.title ? `${section.title} (${chunkIndex})` : null,
        plainText,
        wordCount,
        summary: summarizeSectionText(plainText),
        estimatedPages: estimateSectionPages(wordCount),
      });
      chunkIndex += 1;
      currentParagraphs = [];
      currentWords = 0;
    }

    currentParagraphs.push(paragraph);
    currentWords += paragraphWords;
  }

  if (currentParagraphs.length > 0) {
    const plainText = currentParagraphs.join('\n\n');
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    chunks.push({
      title: section.title ? `${section.title} (${chunkIndex})` : null,
      plainText,
      wordCount,
      summary: summarizeSectionText(plainText),
      estimatedPages: estimateSectionPages(wordCount),
    });
  }

  return chunks;
}

export function parseBookSectionsFromText(text, options = {}) {
  const maxWordsPerSection =
    typeof options.maxWordsPerSection === 'number' && options.maxWordsPerSection > 0
      ? options.maxWordsPerSection
      : 900;
  const draftSections = buildDraftSections(text);
  const expanded = draftSections.flatMap((section) => chunkSection(section, maxWordsPerSection));

  return expanded.map((section, index) => ({
    sectionOrder: index + 1,
    title: section.title,
    summary: section.summary,
    plainText: section.plainText,
    wordCount: section.wordCount,
    estimatedPages: section.estimatedPages,
  }));
}
