# P2-11 - Facts Schema Alignment

## Amac

`facts` tablosundaki gercek Supabase alanlari ile mobil feed ekraninin kullandigi UI varsayimlarini ayirmak.
Boylece generated schema tipleri saf kalir, UI tarafindaki `likes` ve gradient gibi sunum alanlari normalize katmaninda uretilir.

## Alt Gorevler

- [x] `FactRow` tipini generated Supabase `facts` row'u olarak saf hale getir
- [x] Feed normalize katmaninda UI varsayimlarini (`likes`, `gradientStart`, `gradientEnd`) runtime default olarak uret
- [x] Feed fetch sonucunu generated `FactRow` uzerinden map et
- [x] Roadmap ve changelog kayitlarini guncelle

## Notlar

- Bu gorev icin yeni bir DB migration gerekli degildi; mevcut `facts` semasi zaten `content`, `source_url`, `source_label`, `media_url` ve `published_at` alanlariyla uygulamanin cekirdek veri ihtiyacini karsiliyor.
- Drift riski, DB row tipine UI-only alanlar eklenmesinden geliyordu. Bu gorev o ayrimi temizledi.
