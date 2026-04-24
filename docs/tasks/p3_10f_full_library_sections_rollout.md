# P3-10f Full Library Sections Rollout

Bu gorev mevcut section-bazli reader altyapisini 2 demo/seed kitapla sinirli kalmaktan cikarip kutuphanedeki tum secili kitaplara yaymak icin acildi.

- [x] Kutuphanedeki mevcut aktif kitaplari listele ve `book_sections` kapsamini olc.
- [ ] Tam section'i olmayan kitaplari backlog listesine ayir.
- [x] Her kitap icin minumum okunabilir hedefi belirle: tum kitap ya da en azindan tum chapter seti.
- [x] `book_sections` insert/backfill akisini toplu calisacak sekilde planla.
- [ ] `book_highlights` ve AI context uyumunu section bazli tam metinle hizala.
- [ ] Reader tarafinda section sayisi yuksek kitaplar icin performans kontrol listesi cikart.
- [ ] Ilk rollout dilimini `learning library shortlist` icindeki kitaplara uygula.
- [ ] Sonucu roadmap/changelog ile belgeleyip kalan kitaplari ikinci dalga backlog'una tasi.
- [ ] `P3-10g` altindaki TR reader edition pilotunu ilk kitapta apply edip rollout oncesi kaliteyi onayla.

Notlar:
- Hedef sadece "daha fazla kitap eklemek" degil, mevcut secili katalogdaki kitaplarin tam okunabilir hale gelmesi.
- `book_sections` tek buyuk blob yerine chapter/section bazli kalacak; AI ve progress sistemi bunun ustune kuruldu.
- Bu is, metadata acquisition gorevinden bagimsiz degil; yeni kitaplar once guvenilir metadata ve temiz source ile sisteme girmeli.
- Ilk calisan dilim olarak `packages/pipeline/src/runners/ingest-book-sections.js` eklendi. Bu runner `source_storage_bucket + source_storage_path` uzerinden ham metni indirir, section'lara ayirir ve `book_sections` tablosuna yazabilir.
- Guncel karar: ham metin `Storage`ta EN olarak kalacak; kullanicinin okuyacagi `book_sections` metni ise section bazli Turkce reader edition olacak.
- Guncel durum: `--translate-tr` pilotu kod seviyesinde hazir; ilk dry-run'lar Groq rate limit yuzunden apply asamasina gecemedi.
- Reader tarafinda highlight render ve AI context olusturma mantigi, section reader modeline hizalanacak sekilde bolum-scoped hale getirildi.
- Reader tarafinda cok section'li kitaplar icin performans/gozlem checklist'i `P3-10h` altinda toplandi.
