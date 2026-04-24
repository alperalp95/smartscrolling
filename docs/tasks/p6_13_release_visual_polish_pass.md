# P6-13 Release Visual Polish Pass

## Amac

- Release oncesi mevcut uygulama davranisini bozmadan gorsel kaliteyi yukselten kontrollu bir polish turu yapmak.
- Bu is bir redesign veya bilgi mimarisi degisikligi degil.
- Yaklasim: mevcut ekranlari, kartlari ve yuzeyleri ayni urun akisi icinde "makyaj" mantigiyla iyilestirmek.

## Temel Kurallar

- Navigation, state, veri akisi ve ekran davranisi korunacak.
- Mevcut feature set degismeyecek.
- Gorunur hiyerarsi, spacing, tipografi, yuzey dili ve kart sunumu iyilestirilecek.
- Eksik gorunen kart/yuzeyler ayni design language ile tamamlanacak.
- Content-heavy yuzeylerde okunabilirlik, decorative glow ve blur'dan daha oncelikli olacak.

## Tasarim Karari

- Shell ekranlari:
  - daha atmosferik olabilir
  - glow / depth / premium hissi daha yuksek olabilir
- Icerik ekranlari:
  - daha sade
  - daha net kontrastli
  - daha okunur
- Kural:
  - `chrome is premium`
  - `content surfaces are calmer`

## Ekran Bazli Oncelik Sirasi

1. Global visual language
2. Tab bar ve ortak shell
3. Profile
4. Feed
5. Library
6. Premium + Auth / onboarding
7. Reader
8. AI popup + AI chat sheet

## 1. Global Visual Language

Hedef:
- Tum uygulamada tek bir premium visual system hissi kurmak.

Yapilacaklar:
- ortak arka plan mantigini netlestir
- card radius, border opacity, glow siddeti ve blur seviyesini standardize et
- tipografi hiyerarsisini belirle
- primary / secondary button dillerini tekillestir
- chip, badge ve section header stillerini ortaklastir
- kartlar icin su varyantlari netlestir:
  - content card
  - settings card
  - premium card
  - glass hero card

## 2. Tab Bar ve Ortak Shell

Hedef:
- Alt navigasyon ve ekran shell'i tum uygulamada ayni urun ailesine ait hissettirsin.

Yapilacaklar:
- tab bar arka plan, aktif ikon, glow ve ayirici cizgi dengesini netlestir
- her ekranda shell margin/padding mantigini hizala
- header spacing ve section spacing ritmini standardize et

## 3. Profile Polish

Hedef:
- Mevcut profile ekranini premium ve daha urunlesmis gostermek.

Yapilacaklar:
- hero alanini polish et
- avatar + email + plan badge dengesini iyilestir
- streak kartini daha temiz sun
- yonetim/settings kartini daha premium kart diliyle guncelle
- auth state / provider badge / logout aksiyonunu daha net gosterecek sekilde polish et
- ilgi alani karti ayni visual system'e oturt

Not:
- davranis degismeyecek
- sadece visual polish

## 4. Feed Polish

Hedef:
- Feed'i daha production-ready, daha okunur ve daha hizli taranabilir hale getirmek.

Yapilacaklar:
- kategori chip'lerini daha net yap
- fact kartlarinda blur/fog etkisini azalt
- kart icinde su hiyerarsiyi netlestir:
  - kategori
  - baslik
  - preview text
  - save action
  - progress / time indicator
- kartlar arasi bosluklari duzenle
- feed kartlarinin dekoratif degil bilgisel his vermesini sagla

Kritik kural:
- feed premium gorunsun ama sisli olmasin
- okunabilirlik her seyden once gelir

## 5. Library Polish

Hedef:
- Kutuphane ekranini daha premium ama daha derli toplu gostermek.

Yapilacaklar:
- search bar shell'ini polish et
- featured ve library book card varyantlarini ayni dilde hizala
- locked / premium state'leri daha rafine goster
- saved facts alanini daha iyi kart listesi gibi sun
- bos / placeholder yuzeyleri ayni visual system ile kapat

## 6. Premium + Auth / Onboarding Polish

Hedef:
- Premium ve auth ekranlarini ayni urun ailesi icinde daha tutarli yapmak.

Yapilacaklar:
- premium ekraninda glow ve pricing hierarchy dengesini koru
- auth/onboarding ekranlarinda value-first kopyayi premium shell ile birlestir
- CTA hiyerarsisini netlestir
- guest / auth / premium durumlari arasinda daha net ton farki olustur

## 7. Reader Polish

Hedef:
- Reader ekraninda premium hissi korurken uzun-form okumayi yormayan daha sade bir yuzey kurmak.

Yapilacaklar:
- reading surface'i sakinlestir
- tipografi, line height ve text width'i rahat okunur hale getir
- top bar ve progress shell'ini sade ama premium tut
- highlighted word ve reference stillerini daha purpose-driven hale getir
- floating AI action'i daha subtil yap

Kritik kural:
- reader bir "concept poster" gibi degil
- uzun sure okunabilecek gercek bir reading surface gibi hissettirmeli

## 8. AI Popup + Chat Sheet Polish

Hedef:
- AI yuzeylerini ayni premium dille daha fonksiyonel hale getirmek.

Yapilacaklar:
- definition popup hierarchy'sini sadeleştir
- suggested prompt chip'lerini ayni system ile hizala
- chat message bubble'lari ve input alanini daha okunur yap
- sheet glow ve blur etkisini mesaj okunurlugunu bozmayacak seviyeye cek

## Uygulama Stratejisi

- Tek seferde tum app degistirilmeyecek.
- Her turda en fazla 1-2 ekran ele alinacak.
- Her ekran turu sonrasinda:
  - davranis degismedi mi
  - spacing bozuldu mu
  - scroll / CTA / state ekranlari saglam mi
  kontrol edilecek.

## Onerilen Uygulama Dilimleri

### Dilim 1
- global visual tokens
- tab bar shell
- profile polish

### Dilim 2
- feed polish
- library polish

### Dilim 3
- premium
- auth / onboarding

### Dilim 4
- reader polish
- AI popup / chat polish

## Release Oncesi Kontrol

- Tasarim birligi saglandi mi
- Feed ve reader okunurlugu korunuyor mu
- Premium / auth / profile ayni urun ailesine ait gorunuyor mu
- Visual polish performans veya scroll davranisini bozuyor mu
- Eksik kalan kart/yuzey var mi

## Son Not

- Bu gorev bir "tam yeniden tasarim" degil.
- Bu gorev mevcut uygulamaya kontrollu, dusuk riskli, release-oncesi bir goruntu ve his polish'i uygulamak icin acildi.
