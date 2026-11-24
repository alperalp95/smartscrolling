-- K-00b: Telifli kitap metni artık istemciden (anon/authenticated) okunamaz.
-- RLS açık kalır; okuma politikaları kaldırılınca erişim reddedilir. Tablolar Faz 3'te tamamen silinecek.
drop policy if exists "Anyone can read books" on public.books;
drop policy if exists "Anyone can read book sections" on public.book_sections;
drop policy if exists "Anyone can read book highlights" on public.book_highlights;
revoke select on public.books, public.book_sections, public.book_highlights from anon, authenticated;
