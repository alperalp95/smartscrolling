export function stripHtml(html) {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMeaningfulParagraphs(html, { minLength = 180, maxParagraphs = 4 } = {}) {
  const paragraphMatches = [...(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paragraphs = [];

  for (const match of paragraphMatches) {
    const cleaned = stripHtml(match[1]);

    if (cleaned.length < minLength) {
      continue;
    }

    paragraphs.push(cleaned);

    if (paragraphs.length >= maxParagraphs) {
      break;
    }
  }

  return paragraphs;
}
