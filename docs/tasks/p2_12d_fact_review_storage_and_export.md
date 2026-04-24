# P2-12d - Fact Review Storage and Export

## Amaç
- Review mode ile toplanan editor sinyallerini sonradan analiz edilebilir hale getirmek.
- Her review'u kalici urun verisi gibi degil, pipeline tuning dataseti gibi ele almak.

## Ana Karar
- Bu veri son kullanici urun verisi degil.
- Production analytics yerine kalite tuning girdisi olarak tutulacak.
- Ilk dilimde basitlik oncelikli.

## Onerilen Veri Alani
- `fact_id`
- `verdict` (`good | bad | unsure`)
- `issue_tags`
- `comment`
- `reviewed_at`
- `reviewer_label` (opsiyonel, tek editor bile olsa faydali olabilir)

## Onerilen Ilk Saklama Yontemi

### Secenek A - Supabase Review Tablosu
Avantaj:
- Kolay filtreleme
- Sonradan export kolay
- Prompt tuning oncesi SQL ile pattern analizi kolay

Risk:
- Kucuk de olsa tablo/migration maliyeti var

### Secenek B - JSON/CSV Export
Avantaj:
- Cok hizli
- Uygulamayi etkilemez
- Kisa omurlu review turleri icin yeterli

Risk:
- Sonradan toplu analiz biraz daha manuel olur

## Onerilen Baslangic
- Ilk iteration icin amac hizli sinyal toplamak oldugu icin:
  - ya kucuk bir Supabase tablo
  - ya da JSON export
- Karar, UI slice'ina baslarken verilecek.

## Analiz Sorulari
- `bad` verdict en cok hangi issue tag'lerle geliyor?
- En cok hangi kategori `not_snackable` hissi uretiyor?
- Gorsel problemi ile icerik problemi birlikte mi geliyor?
- "Merak uyandirmiyor" yorumlari belirli source/prompt tiplerinde mi birikiyor?

## Sonraki Adim
- 50-100 review toplandiginda:
  - prompt degisiklikleri
  - source filtreleri
  - kategori stratejisi
  - gorsel policy
yeniden ayarlanacak.
