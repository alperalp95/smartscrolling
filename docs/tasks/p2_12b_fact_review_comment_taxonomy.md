# P2-12b - Fact Review Comment Taxonomy

## Amaç
- Review verirken serbest yorumu tamamen kaotik bir not havuzuna cevirmemek.
- Kotu fact'lerdeki yorumlari sonradan prompt/pipeline iyilestirmesine cevirmek.

## Ana Karar
- `good` ve `unsure` icin yorum opsiyonel.
- `bad` icin yorum zorunlu.
- Yorumlar kisa ama sebep odakli olmali.

## Yorum Yazim Kurali
- Tek cumle veya en fazla 2 kisa cumle.
- "Neden kotu?" sorusuna cevap vermeli.
- "Duzenlenmeli" gibi genel cumleler yerine somut sebep icermeli.

## Yorum Kaliplari

### 1. Ilgi / Merak Problemi
- "Bu bilgi merak uyandirmiyor."
- "Okuyunca yeni bir sey ogrendigimi hissettirmiyor."
- "Bu bir hap bilgi degil, fazla duz."

### 2. Paketleme Problemi
- "Baslik iyi degil, icerik acmiyor."
- "Baslik daha ilgi cekici ama hala dogru olmali."
- "Kartin girisi zayif."

### 3. Icerik Problemi
- "Icerik fazla genel."
- "Icerik tekrar hissi veriyor."
- "Detay vermeden buyuk iddia kuruyor."

### 4. Kategori / Konumlama Problemi
- "Kategori yanlis secilmis."
- "Bu teknoloji degil daha cok tarih."
- "Bu feed'de bu kategoriye ait hissettirmiyor."

### 5. Gorsel Problemi
- "Gorsel konuya hizmet etmiyor."
- "Gorsel dikkat dagitiyor."
- "Gorsel karti ucuz hissettiriyor."

### 6. Dil Problemi
- "Dil yapay duruyor."
- "Cumle akisi Turkce degil gibi."
- "Anlatim ansiklopedi dili gibi."

## Sonradan Analiz Ederken
- Yorumlar tag'lerle birlikte gruplanacak.
- Tek tek fact duzeltmekten cok pattern avlanacak.
- Ozellikle su iki soruya cevap aranacak:
  - En cok hangi sebeple `bad` verildi?
  - "Hap bilgi degil" hissi en cok hangi prompt/source kombinasyonunda olustu?

## Kapsam Disi
- Production moderator paneli
- Son kullanici report sistemi
- Uzun form editorial workflow

## Sonraki Uygulama Slice'i
- Feed debug/review mode
- `good / bad / unsure`
- `bad` icin zorunlu comment
- istege bagli 1-2 tag secimi
