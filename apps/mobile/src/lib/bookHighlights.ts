import type { BookHighlightRow } from '../types';
import { type ReaderDefinition, getReaderSlice } from './bookContent';
import { supabase } from './supabase';

export type ReaderHighlightDefinition = ReaderDefinition & {
  displayOrder?: number;
  sectionOrder?: number | null;
};

export function getSectionScopedDefinitions(
  definitions: Record<string, ReaderHighlightDefinition>,
  sectionOrder?: number | null,
) {
  if (!sectionOrder) {
    return definitions;
  }

  return Object.fromEntries(
    Object.entries(definitions).filter(([, definition]) => {
      return definition.sectionOrder == null || definition.sectionOrder === sectionOrder;
    }),
  );
}

function mapHighlightRows(
  rows: Array<
    Pick<
      BookHighlightRow,
      'ai_definition' | 'display_order' | 'explanation' | 'section_order' | 'type' | 'word'
    >
  >,
) {
  return rows.reduce<Record<string, ReaderHighlightDefinition>>((accumulator, row) => {
    accumulator[row.word] = {
      ai: row.explanation || row.ai_definition || 'Aciklama su anda alinmiyor.',
      def: row.ai_definition || 'Tanim bulunamadi.',
      displayOrder: row.display_order ?? 0,
      sectionOrder: row.section_order,
      type: row.type,
    };
    return accumulator;
  }, {});
}

export async function fetchBookHighlightDefinitions(bookId: string) {
  const { data, error } = await supabase
    .from('book_highlights')
    .select('word,type,ai_definition,explanation,display_order,section_order')
    .eq('book_id', bookId)
    .order('section_order', { ascending: true })
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[BookHighlights] fetchBookHighlightDefinitions failed:', error.message);
  }

  if (!data?.length) {
    return getReaderSlice(bookId).definitions;
  }

  return mapHighlightRows(data);
}
