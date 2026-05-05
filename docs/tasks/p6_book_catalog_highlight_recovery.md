# P6 Book Catalog ve Highlight Recovery

## Amac

- Free anchor kitabi `Homo Deus` olarak ayarlamak.
- `Kendime Dusunceler` katalogdan kaldirmak.
- Reader section baslik/summary yuzeyini kaldirip sadece kitap sayfasi scroll deneyimini korumak.
- `book_highlights` verisini free kitap icin en az 10, her premium kitap icin en az 50 kayit olacak sekilde geri kurmak.
- Data recovery isini migration seed ile kalici hale getirmek.

## Kurallar

- Over-engineering yok.
- Refactoring yok.
- Task disi dosyalara dokunulmayacak.
- Her alt task kullanici onayi ile ilerleyecek.
- Her alt task sonunda yapilan is ve dogrulama sonucu raporlanacak.
- Git push yalnizca kullanici ayrica onaylarsa yapilacak.

## Alt Tasklar

- [x] Task dosyasini ac ve kapsamı netlestir.
- [x] Reader section baslik/summary render'ini kaldir.
- [x] Highlight matcher'a kelime sonu boundary kontrolu ekle.
- [x] Kalici katalog/section/highlight migration seed'ini olustur.
- [x] Remote Supabase migration apply yap.
- [x] Local ve remote dogrulamalari calistir.
- [x] Roadmap/changelog kapanis notlarini guncelle.
- [x] Library basligini sadeleştir ve free kitabi gridde ilk siraya sabitle.

## Task Log

### 2026-05-05 - Baslangic

- Plan onaylandi ve uygulamaya alindi.
- Reader section sayfa icindeki baslik/summary bloğu kaldirildi.
- Highlight matcher artik kelime baslangici ve kelime sonu sinirini birlikte kontrol ediyor.

### 2026-05-05 - Catalog / Highlight Migration

- `20260505184712_p6_book_catalog_highlight_recovery.sql` migration'i olusturuldu.
- Migration davranisi:
  - `Kendime Dusunceler` katalogdan silinir.
  - `Homo Deus` `free_anchor` ve `is_premium = false` olur.
  - Diger 7 kitap premium kalir.
  - 8 kitap icin 3723 `book_sections` seed edilir.
  - `book_highlights` 360 kayitla seed edilir.
- Highlight dagilimi:
  - `Homo Deus`: 10
  - Her premium kitap: 50
- Remote `npx supabase db push --linked --yes` basarili oldu.
- Remote REST dogrulama:
  - `Kendime Dusunceler` listede yok.
  - `Homo Deus` free gorunuyor.
  - Toplam highlight sayisi 360.
  - Her premium kitapta 50 highlight var.

### 2026-05-05 - Library Polish

- Library kitap grid basligi `Kütüphane` olarak sadeleştirildi.
- Library grid siralamasi gorunum seviyesinde free anchor kitabi en ust sol kartta gosterecek sekilde sabitlendi.
- Final kalite kapilari gecti: `npm run lint`, `npm run typecheck`, `npm run check:edge-functions`.
