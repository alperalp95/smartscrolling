import type { BookSectionRow } from '../types';
import { type ReaderDefinition, getReaderSlice } from './bookContent';
import { getSectionScopedDefinitions } from './bookHighlights';
import { supabase } from './supabase';

export type ReaderSectionPart = {
  text: string;
  type: 'normal' | 'keyword' | 'reference';
  word?: string;
};

export type ReaderTextSection = {
  id: string;
  plainText: string;
  parts?: ReaderSectionPart[];
  sectionOrder: number;
  estimated_pages?: number | null;
  summary?: string | null;
  title?: string | null;
};

function getPartType(definitionType?: string) {
  return definitionType?.toLowerCase().includes('referans') ? 'reference' : 'keyword';
}

export function buildHighlightedSectionParts(
  plainText: string,
  definitions: Record<string, ReaderDefinition>,
): ReaderSectionPart[] {
  const terms = Object.keys(definitions).sort((left, right) => right.length - left.length);

  if (!terms.length) {
    return [{ text: plainText, type: 'normal' }];
  }

  const parts: ReaderSectionPart[] = [];
  const lowerText = plainText.toLowerCase();
  let cursor = 0;

  while (cursor < plainText.length) {
    let nextTerm: string | null = null;
    let nextIndex = -1;

    for (const term of terms) {
      const foundIndex = lowerText.indexOf(term.toLowerCase(), cursor);

      if (foundIndex === -1) {
        continue;
      }

      if (nextIndex === -1 || foundIndex < nextIndex) {
        nextIndex = foundIndex;
        nextTerm = term;
      }
    }

    if (nextTerm === null || nextIndex === -1) {
      parts.push({ text: plainText.slice(cursor), type: 'normal' });
      break;
    }

    if (nextIndex > cursor) {
      parts.push({
        text: plainText.slice(cursor, nextIndex),
        type: 'normal',
      });
    }

    const endIndex = nextIndex + nextTerm.length;
    parts.push({
      text: plainText.slice(nextIndex, endIndex),
      type: getPartType(definitions[nextTerm]?.type),
      word: nextTerm,
    });
    cursor = endIndex;
  }

  return parts.filter((part) => part.text.length > 0);
}

export async function fetchBookSections(
  bookId: string,
  definitions = getReaderSlice(bookId).definitions,
): Promise<ReaderTextSection[]> {
  const { data, error } = await supabase
    .from('book_sections')
    .select('id,section_order,title,plain_text,summary,estimated_pages')
    .eq('book_id', bookId)
    .order('section_order', { ascending: true });

  if (error) {
    console.error('[BookSections] fetchBookSections failed:', error.message);
  }

  if (!data?.length) {
    console.warn(
      '[BookSections] no db sections found, using local fallback slice for book:',
      bookId,
    );
    return getReaderSlice(bookId).paragraphs.map((paragraph, index) => ({
      id: paragraph.id,
      plainText: paragraph.parts.map((part) => part.text).join(''),
      parts: paragraph.parts,
      estimated_pages: 1,
      sectionOrder: index + 1,
      title: null,
      summary: null,
    }));
  }

  return (
    data as Pick<
      BookSectionRow,
      'id' | 'estimated_pages' | 'plain_text' | 'section_order' | 'summary' | 'title'
    >[]
  ).map((section) => ({
    id: section.id,
    estimated_pages: section.estimated_pages,
    plainText: section.plain_text,
    parts: buildHighlightedSectionParts(
      section.plain_text,
      getSectionScopedDefinitions(definitions, section.section_order),
    ),
    sectionOrder: section.section_order,
    summary: section.summary,
    title: section.title,
  }));
}
