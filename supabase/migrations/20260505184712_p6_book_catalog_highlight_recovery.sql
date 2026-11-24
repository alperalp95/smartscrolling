-- 2026-11-24: Telif nedeniyle kitap metni bu dosyadan cikarildi. Tablolar drop_book_feature migration'i ile kaldirildi.
-- P6 book catalog and highlight recovery seed.
-- Generated from Supabase Storage book-files sources.
-- Homo Deus: 502 sections, 10 highlights
-- Evren ve Hiclik: 152 sections, 50 highlights
-- Hizli ve Yavas Dusunme: 601 sections, 50 highlights
-- Kisa Felsefe Tarihi: 379 sections, 50 highlights
-- Neredeyse Her Seyin Kisa Tarihi: 537 sections, 50 highlights
-- Sapiens: Insan Turunun Kisa Tarihi: 445 sections, 50 highlights
-- Silahlar, Mikroplar ve Celik: 539 sections, 50 highlights
-- Turlerin Kokeni: 568 sections, 50 highlights

begin;

delete from public.books where id = '11111111-1111-1111-1111-111111111111'::uuid;



delete from public.book_sections where book_id in ('20000003-0000-4000-8000-000000000003'::uuid, '20000001-0000-4000-8000-000000000001'::uuid, '20000002-0000-4000-8000-000000000002'::uuid, '20000004-0000-4000-8000-000000000004'::uuid, '20000005-0000-4000-8000-000000000005'::uuid, '20000006-0000-4000-8000-000000000006'::uuid, '20000007-0000-4000-8000-000000000007'::uuid, '20000008-0000-4000-8000-000000000008'::uuid);

































































delete from public.book_highlights where book_id in ('20000003-0000-4000-8000-000000000003'::uuid, '20000001-0000-4000-8000-000000000001'::uuid, '20000002-0000-4000-8000-000000000002'::uuid, '20000004-0000-4000-8000-000000000004'::uuid, '20000005-0000-4000-8000-000000000005'::uuid, '20000006-0000-4000-8000-000000000006'::uuid, '20000007-0000-4000-8000-000000000007'::uuid, '20000008-0000-4000-8000-000000000008'::uuid);











commit;