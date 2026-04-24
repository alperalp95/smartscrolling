# P3-24 - Paywall ve Monetization Policy

## Amac

Guest, free ve premium kullanici akisini agresif olmayan ama urun degerini net gosteren bir monetization policy ile standardize etmek.

## Alt Gorevler

- [x] Guest / free / premium kullanici tiplerini urun diliyle ayir
- [x] Reklam, kutuphane erisimi ve AI soru sorma kurallarini policy maddelerine dok
- [x] Mobil reklam teknolojisi icin temel stack kararini ver (`react-native-google-mobile-ads` + Google AdMob)
- [x] Satin alma / entitlement teknolojisi icin temel stack kararini ver (RevenueCat)
- [x] Ilk premium upsell yuzeyini tek modal/store cizgisi olarak ekle; library ve reader icindeki premium kitap niyeti ayni prompt'a baglansin
- [x] Reader AI chat'te hazir sorulari acik birak, serbest soru yazmayi premium prompt'a bagla
- [x] Reusable premium upsell kartini cikar; profile ve library icinde hafif premium hatirlatma yuzeyi olarak kullan
- [x] Feed icinde reklamdan bagimsiz, gelecekte reklam sonrasi da kullanilabilecek dismiss edilebilir hafif premium upsell katmani ekle
- [ ] RevenueCat entitlement modelini runtime'a bagla (`premium`, gerekirse ileride `trial` / `grace_period`)
- [ ] Ad gosterim cadence'ini feed event'lerine bagla
- [ ] Reklam sonrasi inline premium upsell kartini tasarla
- [ ] Serbest AI soru sorma girislerini premium paywall akisina bagla
- [ ] Chat history ve full library erisimini entitlement ile bagla

## Policy

### Guest User

- Feed acik kalir; urunun ana degeri ilk anda hissedilir.
- Library'de `free_anchor` ve vitrin niteliginde kilitli premium kitaplar gorunur.
- Save / sync aksiyonlari login ister.
- AI'da sadece hazir sorular veya kisitli demo deneyim acik tutulur.
- Premium kitap, save veya serbest AI niyeti aninda auth istenir; ilk anda sert paywall acilmaz.
- Ilk session'da reklam baskisi dusuk tutulur; guest kullaniciyi erken kacirmayacak sekilde davranilir.

### Free User

- Feed aciktir.
- Library'de `free_anchor` ve kilitli premium katalog gorunur.
- AI'da hazir sorular acik kalir.
- Reader chat'te hazir soru chip'leri acik, serbest metinle soru sorma premium ozellik olarak konumlanir.
- Reklam ilk grace period'dan sonra gosterilir.
- Reklam cadence'i ilk surum icin `ilk 15-20 kart reklamsiz`, sonra yaklasik `12-15 kartta bir` olarak hedeflenir; bu deger hard-code edilmeden config'e acik tutulur.
- Reklam sonrasinda zorlayici fullscreen paywall yerine once hafif bir inline upsell / sheet davranisi tercih edilir.

### Premium User

- Reklamsiz deneyim
- Library'nin tamamina erisim
- Serbest AI soru sorma
- AI sohbet gecmisi / sync
- Ileride daha yuksek AI limiti ve ek premium retention ozellikleri ayni entitlement cizgisinde buyutulebilir

## Teknoloji Kararlari

- Satin alma ve entitlement katmani: `react-native-purchases` (RevenueCat)
- Reklam katmani: `react-native-google-mobile-ads` + Google AdMob
- Feed icindeki reklam deneyimi:
  - ilk dilimde interstitial yerine daha kontrollu formatlar tercih edilmeli
  - fullscreen reklam kullanilacaksa uzun swipe araliklarinda ve kullaniciyi kesmeyecek anlarda tetiklenmeli
  - reklam sonrasi premium CTA agresif modal yerine daha yumusak upsell olarak gelmeli

## Operasyon Notlari

- AdMob icin gercek reklam gostermek uzere Google AdMob hesabi gerekir.
- Google Play Console tarafinda uygulama icin `contains ads` beyaninin yapilmasi gerekir.
- EEA / GDPR kapsami icin reklam oncesi consent akisi degerlendirilmelidir.
- RevenueCat tarafinda App Store Connect ve Google Play urunlerinin dashboard'a baglanmasi gerekir.
- Ilk implementasyonda test ad unit'leri ve sandbox subscription urunleri ile ilerlenmelidir.

## MVP Karari

- Monetization omurgasi release oncesi netlestirilecek.
- Ilk release'te kullaniciyi kacirmayacak kadar hafif ama premium degerini gosterecek kadar net bir freemium akisi hedeflenir.
- Hedef `agresif conversion` degil, `deger gostererek donusturme`dir.
- Ilk implementasyon diliminde tam screen paywall route'u yerine merkezi bir premium modal tercih edildi; boylece mevcut akislari bozmadan premium niyet anlari tek noktada toplanmis oldu.
- Sonraki dilimde ayni dil reusable `premium upsell card` bilesenine de tasindi; profile ve library icinde yumusak premium anlatimi icin temel UI omurgasi olustu.
- Feed'te bu kartin ilk kontrollu kullanim alani da eklendi; belirli sayida benzersiz kart goren free kullaniciya dismiss edilebilir bir premium hatirlatmasi gosteriliyor. Bu, henuz reklam tetikleyicisi degil; gelecekte reklam sonrasi da ayni yere oturacak hafif upsell omurgasidir.
