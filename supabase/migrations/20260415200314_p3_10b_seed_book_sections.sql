-- 2026-11-24: Telif nedeniyle kitap metni bu dosyadan cikarildi. Tablolar drop_book_feature migration'i ile kaldirildi.




DELETE FROM public.book_sections
WHERE book_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

