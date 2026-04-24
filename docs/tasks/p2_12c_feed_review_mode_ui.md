# P2-12c - Feed Review Mode UI

## Amaç
- Feed icindeki fact'leri hizli editor gozuyle degerlendirmek.
- Normal kullanici deneyimini bozmadan, sadece debug/internal kullanim icin hafif bir review modu saglamak.

## Kapsam
- Production'a acik bir ozellik degil.
- Sadece ic kalite kontrolu ve prompt/pipeline tuning amacli.
- Normal feed davranisini bozmamali.

## Onerilen UX

### Giris
- Review mode ayri bir debug flag ile acilir.
- Varsayilan olarak kapali olur.
- Acikken fact kartinda kucuk bir `Review` aksiyonu veya long-press ile mini panel acilir.

### Review Paneli
- 3 ana karar:
  - `Good`
  - `Bad`
  - `Unsure`
- `Bad` secildiginde:
  - kisa comment zorunlu
  - istege bagli 1-2 issue tag secimi
- `Good` ve `Unsure` icin:
  - comment opsiyonel

### Hizli Tag Secenekleri
- `not_snackable`
- `not_interesting`
- `too_generic`
- `title_weak`
- `content_weak`
- `category_mismatch`
- `image_irrelevant`
- `image_low_value`
- `language_awkward`
- `duplicate_feeling`

## Neler Gorunur Olmali
- Fact id
- Baslik
- Kategori
- Gorsel var/yok bilgisi
- Review sonucu secimi
- Comment alani
- Kaydet aksiyonu

## Neler Gerekli Degil
- Ayrintili moderator dashboard
- Cok adimli form
- Sayisal rating sistemi
- Son kullaniciya acik report yuzeyi

## Basari Kriteri
- Tek bir fact'i 5-10 saniyede isaretlemek mumkun olmali.
- Review mode acikken bile feed hissi bozulmamali.
- Ayni oturumda ardisik 20-30 fact review etmek yorucu olmamali.

## Teknik Not
- Bu ilk dilimde persistence local ya da Supabase olabilir; karar sonraki task'ta netlesecek.
- Oncelik once UX akisini hafiflestirmek.
