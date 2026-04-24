# P1-19b Gutenberg Catalog Ingest Strategy

Bu gorev gercek kitap bilgisini ve tam metin kaynagini manuel seed yerine daha sistematik bir sekilde edinmek icin acildi.

- [ ] Project Gutenberg kaynak stratejisini netlestir: `RDF catalog + plain text/EPUB mirrors`.
- [ ] Yalnizca public-domain ve ingestion'a uygun kitaplari sececek filtreleri tanimla.
- [ ] `books` tablosu icin gerekli metadata alanlarini netlestir: baslik, yazar, dil, konu, cover/source url, source id, rights/source label.
- [x] Gutenberg metadata ingest akisini belirle: `catalog -> shortlist -> normalize -> books insert/update`.
- [x] Tam metin alma akisini belirle: `plain text` oncele, `EPUB` fallback olarak kullan.
- [x] Chapter/section ayirma kuralini belirle: dogal bolum basliklari varsa koru, yoksa mantiksal section chunk'lari uret.
- [ ] Roadmap/changelog notlarini ekle ve uygulama dilimini ayri goreve bagla.

Karar:
- Ilk tercih `Project Gutenberg RDF catalog` uzerinden guvenilir metadata almak.
- Tam metin icin once `utf-8 plain text` dosyasi alinacak; yoksa `EPUB` parse edilecek.
- Cover zorunlu olmayacak; yoksa mevcut branded fallback / `visual_key` mantigi korunacak.
- Her kitap tek seferde tum paragraph olarak degil, `book_sections` icin chapter/section bazli normalize edilecek.
- Ilk uygulama dilimi icin storage-backed `txt -> book_sections` runner'i eklendi; metadata shortlist ve yeni kitap importu sonraki adimdir.
- Reader edition stratejisi netlesti: `Storage` ham EN kaynagi saklayacak, `book_sections` ise kontrollu TR okuyucu metni uretecek.
- Bu nedenle `ingest-book-sections` runner'i `--translate-tr` bayragi ile section bazli Turkce edition uretebilir hale getirildi.
- Ilk pilot `P3-10g` altinda izleniyor; bootstrap basarili, ancak ilk apply Groq kota limitine takildigi icin henuz tamamlanmadi.
