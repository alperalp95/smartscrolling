# P2-12 - Fact Quality Review Loop

## Amaç
- Feed kalitesini teknik olarak degil, editor gozuyle olcmek.
- Production'a cikacak bir moderation sistemi kurmak degil.
- Kisa omurlu bir "review loop" ile Groq prompt'larini, kategori mantigini, gorsel secimini ve source/pipeline filtrelerini iyilestirmek.

## Neden Gerekli
- Bazi fact'ler teknik olarak geciyor ama "hap bilgi" hissi vermiyor.
- Kullanici merak uyandirmayan, fazla genel, fazla duz veya zayif konu secimli kartlar uretiliyor.
- Mevcut quality gate daha cok yapisal kaliteyi olcuyor; editorluk kalitesini olcmuyor.

## Temel Karar
- Bu sistem production UX'in parcasi olmayacak.
- Sadece ic kalite degerlendirmesi ve pipeline tuning icin kullanilacak.
- Amaac her fact'e tek tek kalici moderation yapmak degil; tekrar eden pattern'leri yakalamak.

## Onerilen Hafif Review Akisi
1. Fact icin hizli sonuc secilir:
   - `good`
   - `bad`
   - `unsure`
2. `bad` secildiyse kisa yorum zorunlu olur.
3. Gerekirse 1-2 issue etiketi secilir.
4. Bu sinyaller topluca analiz edilerek prompt/pipeline degisikliklerine donusturulur.

## En Degerli Sinyal
- Sayisal puan degil, `neden kotu oldugu`.
- Ozellikle serbest yorum alani, "bu kart neden insanin okumak isteyecegi bir bilgi degil?" sorusunu cevaplamali.

## "Bad" Icin Beklenen Yorum Tipleri
- "Bu bilgi fazla genel, yeni bir sey soylemiyor."
- "Merak uyandirmiyor."
- "Baslik clickbait ama icerik zayif."
- "Kategori uyumsuz."
- "Gorsel alakasiz."
- "Dil dogal degil."
- "Bu bir hap bilgi degil, ansiklopedi cumlesi gibi."

## Onerilen Issue Tag Seti
- `not_snackable`
- `not_interesting`
- `too_generic`
- `title_weak`
- `content_weak`
- `category_mismatch`
- `image_irrelevant`
- `image_low_value`
- `language_awkward`
- `source_doubt`
- `duplicate_feeling`

## Review Sonrasinda Cikacak Isler
- Prompt revizyonu
- Source whitelist / blacklist ayari
- Kategori mapping duzeltmesi
- Gorsel policy revizyonu
- Quality gate'e yeni kural eklenmesi

## Basari Kriteri
- 50-100 fact review'den sonra tekrar eden pattern'ler netlesmeli.
- "Kotulerin en buyuk 3 nedeni" somutlasmali.
- Sonraki pipeline denemesinde editorluk kalitesi gozle gorulur sekilde artmali.
