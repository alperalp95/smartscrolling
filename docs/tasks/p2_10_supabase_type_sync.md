# P2-10 - Supabase Type Sync

## Amac

Supabase schema'daki alan adlari ile mobil taraftaki TypeScript tipleri zamanla birbirinden kopmamali.
Bu gorev, generated schema tiplerini repo icine alip uygulamanin temel veri yuzeylerine baglamayi hedefler.

## Alt Gorevler

- [x] `npx supabase gen types --linked --lang typescript --schema public` ciktisini `apps/mobile/src/types/supabase.ts` altina al
- [x] `src/types/index.ts` icinde generated `Database` ve temel row alias'larini export et
- [x] Feed ve books tarafindaki manuel row tiplerini generated schema tiplerine bagla
- [x] `book_sections` ve `book_highlights` fetch katmanlarini generated row alanlariyla hizala

## Notlar

- Bu gorev remote linked Supabase projesinden generate edilen current schema tiplerine dayanir.
- Sonraki schema degisikliklerinde ayni komut yeniden calistirilmalidir.
