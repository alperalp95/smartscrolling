import type { ReaderDefinition } from './bookContent';
import type { ReaderTextSection } from './bookSections';

function clampContext(input: string, maxChars = 4000) {
  if (input.length <= maxChars) {
    return input;
  }

  return input.slice(0, maxChars);
}

export function buildSectionScopedContext(params: {
  activeSection?: ReaderTextSection;
  previousSection?: ReaderTextSection;
  nextSection?: ReaderTextSection;
  focusWord?: string;
  focusDefinition?: ReaderDefinition | null;
  sectionDefinitions?: Record<string, ReaderDefinition>;
  maxChars?: number;
}) {
  const parts: string[] = [];
  const activeSection = params.activeSection;

  if (activeSection?.title) {
    parts.push(`Aktif bolum basligi: ${activeSection.title}`);
  }

  if (activeSection?.summary) {
    parts.push(`Aktif bolum ozeti: ${activeSection.summary}`);
  }

  if (activeSection?.plainText) {
    const text = activeSection.plainText;

    if (params.focusWord) {
      const lowerText = text.toLowerCase();
      const lowerWord = params.focusWord.toLowerCase();
      const matchIndex = lowerText.indexOf(lowerWord);

      if (matchIndex >= 0) {
        const snippetStart = Math.max(0, matchIndex - 220);
        const snippetEnd = Math.min(text.length, matchIndex + params.focusWord.length + 220);
        parts.push(`Kelimenin gectigi yakin baglam: ${text.slice(snippetStart, snippetEnd)}`);
      }
    }

    parts.push(`Aktif bolum metni: ${text.slice(0, 1800)}`);
  }

  if (params.focusWord && params.focusDefinition) {
    parts.push(`Odak kelime: ${params.focusWord}`);
    parts.push(`Kelime tanimi: ${params.focusDefinition.def}`);
    parts.push(`Kelime aciklamasi: ${params.focusDefinition.ai}`);
  }

  if (params.sectionDefinitions) {
    const topDefinitions = Object.entries(params.sectionDefinitions)
      .slice(0, 6)
      .map(([word, definition]) => `${word}: ${definition.def}`);

    if (topDefinitions.length > 0) {
      parts.push(`Bu bolumdeki one cikan kavramlar:\n${topDefinitions.join('\n')}`);
    }
  }

  if (params.previousSection?.summary) {
    parts.push(`Bir onceki bolum ozeti: ${params.previousSection.summary}`);
  }

  if (params.nextSection?.summary) {
    parts.push(`Bir sonraki bolum ozeti: ${params.nextSection.summary}`);
  }

  return clampContext(parts.join('\n\n'), params.maxChars);
}

export function getNeighborSections(textSections: ReaderTextSection[], activeSectionIndex: number) {
  const activeSection = textSections[activeSectionIndex];
  const previousSection =
    activeSectionIndex > 0 ? textSections[Math.max(activeSectionIndex - 1, 0)] : undefined;
  const nextSection =
    activeSectionIndex < textSections.length - 1
      ? textSections[Math.min(activeSectionIndex + 1, Math.max(textSections.length - 1, 0))]
      : undefined;

  return {
    activeSection,
    nextSection,
    previousSection,
  };
}
