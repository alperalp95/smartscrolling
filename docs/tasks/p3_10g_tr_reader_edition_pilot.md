# P3-10g TR Reader Edition Pilot

Bu gorev, kitaplar icin `Storage = raw EN source` ve `book_sections = TR reader edition` modelini ilk kez calistirmak icin acildi.

- [x] `ingest-book-sections` runner'ina `--translate-tr` bayragi eklendi.
- [x] Section bazli Turkce reader edition ureten ayri helper (`book-translation.js`) eklendi.
- [x] Pilot icin hizli kalite kontrolu amaciyla `--section-limit` bayragi eklendi.
- [ ] Ilk kitapta (`Kendime Dusunceler`) 3 section'lik dry-run basariyla tamamlanacak.
- [ ] Ceviri tonu ve kavram tutarliligi kontrol edilip prompt/model ayari netlestirilecek.
- [ ] Ilk `--apply` turu ile secili pilot kitap `book_sections` tablosuna Turkce olarak yazilacak.
- [ ] Basarili olursa shortlist kitaplari icin rollout plani `P3-10f` altina tasinacak.

Durum Notu:
- Pilot iki kez calistirildi.
- Gutenberg bootstrap basarili.
- Groq ceviri akisi basarili sekilde tetikleniyor.
- Mevcut blokaj kod degil, Groq `TPD` / `TPM` limitleri.
- Son gorulen hata: `rate_limit_exceeded` (`llama-3.3-70b-versatile`), bu nedenle ilk apply henuz yapilmadi.
- Maliyet optimizasyonu icin translate modunda varsayilan section chunk boyutu dusuruldu; detaylar `P3-10i` altinda izleniyor.

Beklerken Bloksuz Devam Edilebilecek Isler:
- `book_highlights` ve AI context katmanini section bazli tam metinle hizalama (`P3-10f` baglantisi)
- Kutuphane / kitap metadata cleanup ve shortlist dogrulama
- Reader performans checklist'i ve yuksek section sayili kitaplar icin UI kontrolleri
- Gerekirse ceviri maliyetini dusurmek icin section chunk boyutu / model secimi stratejisini netlestirme
