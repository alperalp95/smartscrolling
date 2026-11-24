-- K-09a: Kitap özelliği tamamen kaldırıldı. Kitap tabloları ve kitaba bağlı kolonlar silinir.
-- Idempotent. Storage (book-files) burada yok; Storage API ile ayrıca silinir.
-- user_activity.pages_read kalır.

alter table public.bookmarks drop column if exists book_id;

-- Tek eski kitap raporu (fact_id yok) silinir; kolonlar kaldırılır.
-- Kolon zaten yoksa (ikinci çalıştırma) silme adımı atlanır.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_content_reports' and column_name = 'book_id'
  ) then
    delete from public.ai_content_reports where fact_id is null;
  end if;
end $$;

alter table public.ai_content_reports
  drop column if exists book_id,
  drop column if exists book_title;

drop table if exists
  public.book_highlights,
  public.book_sections,
  public.reading_progress,
  public.chat_sessions,
  public.books
cascade;
