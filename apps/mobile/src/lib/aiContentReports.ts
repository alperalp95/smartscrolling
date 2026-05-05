import { supabase } from './supabase';

export type AiContentReportReason =
  | 'wrong_information'
  | 'harmful_or_uncomfortable'
  | 'out_of_book_context'
  | 'other';

export type SubmitAiContentReportInput = {
  assistantMessage: string;
  bookId?: string | null;
  bookTitle?: string | null;
  note?: string;
  reason: AiContentReportReason;
};

export type SubmitAiContentReportResult =
  | {
      reported: true;
    }
  | {
      message: string;
      reported: false;
    };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function getOptionalUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

export async function submitAiContentReport(
  input: SubmitAiContentReportInput,
): Promise<SubmitAiContentReportResult> {
  const assistantMessage = input.assistantMessage.trim();

  if (!assistantMessage) {
    return { message: 'Raporlanacak AI cevabi bulunamadi.', reported: false };
  }

  const userId = await getOptionalUserId();
  const bookId = input.bookId && isUuid(input.bookId) ? input.bookId : null;
  const bookTitle = input.bookTitle?.trim() || null;
  const note = input.note?.trim() || null;

  const { error } = await supabase.from('ai_content_reports').insert({
    assistant_message: assistantMessage,
    book_id: bookId,
    book_title: bookTitle,
    note,
    reason: input.reason,
    user_id: userId,
  });

  if (error) {
    console.error('[Dev] ai content report submit failed:', error.message);
    return { message: error.message, reported: false };
  }

  return { reported: true };
}
