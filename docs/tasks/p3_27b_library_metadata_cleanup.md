# P3-27b Library Metadata Cleanup

Bu gorev, aktif 10 kitaplik ogrenme kutuphanesinin metadata kalitesini release oncesi tek bir checklist altinda toplamak icin acildi.

## Mevcut Durum Ozeti

- Katalog 10 kitapla sinirli ve `books` tablosu ile mobil fallback katalog ayni listeyi kullaniyor.
- `description` alanlari Turkce ve urun tonu ile uyumlu.
- `title` alanlari karmali:
  - anchor kitap `Kendime Dusunceler` Turkce
  - diger eserlerin buyuk cogu Ingilizce canonical baslikla duruyor
- `language` alanlari su anda `en`; bu, ham kaynak dili ile uyumlu.
- `cover_url` alanlari bos; kutuphane branded fallback cover ile bunu guvenli sekilde kapatiyor.
- `source_storage_bucket`, `source_storage_path`, `source_format` alanlari shortlist kitaplarinda henuz sistematik backfill edilmedi.

## Temizlenmesi Gereken Kararlar

- [ ] Baslik politikasi: UI'da canonical EN baslik mi kullanilacak, yoksa TR display baslik mi?
- [ ] Kitap detay dili: `description` alanlari son bir kez ton ve uzunluk acisindan standardize edilecek.
- [ ] Kategori tutarliligi: `Felsefe / Bilim / Tarih / Siyaset / Toplum` dagilimi son kez gozden gecirilecek.
- [ ] Access tier dogrulamasi: `free_anchor` ve `premium` dagilimi shortlist karariyla birebir hizali kalacak.
- [ ] Source metadata cleanup: TR reader edition apply olduktan sonra `source_storage_*` alanlari secili kitaplar icin backfill edilecek.

## Bugun Tespit Edilen Bosluklar

- UI Turkce iken katalog basliklari henuz kismen Ingilizce.
- `language=en` alani ham kaynak dili icin dogru, ancak ileride okuyucu metni Turkce oldugunda bunun "source language" mi "reader language" mi temsil ettigi dokumante edilmeli.
- `cover_url` eksigi bir bug degil; branded fallback stratejisi su an yeterli.
- Katalog kartinda kullanilmayan ama ileride gerekli olacak detail-page metadata standardi henuz tanimli degil.

## Onerilen Temizleme Sirasi

1. Baslik politikasi kararini ver (`canonical EN` vs `TR display title`)
2. Shortlist aciklamalarini tek tonda standardize et
3. Access tier ve kategori dagilimini son kez dogrula
4. TR reader edition apply sonrasi `source_storage_*` alanlarini shortlist kitaplarda doldur

## Not

Bu gorev bilerek "veri silme" ile baslamiyor. Once metadata politikasi netlestirilecek, sonra gerekiyorsa migration/backfill ile veri guncellenecek.
