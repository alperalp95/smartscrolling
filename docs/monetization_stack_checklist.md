# Monetization Stack Checklist

Bu dosya, reklam ve premium satin alma tarafinda dis sistemlere baglanirken hangi hesaplara ve hangi siraya ihtiyac oldugunu pratik sekilde takip etmek icin tutulur.

## 1. Premium / Subscription Tarafi

### Gerekli Hesaplar

- RevenueCat
- Google Play Console
- App Store Connect

### Yapilacaklar

1. RevenueCat projesi ac
2. Android ve iOS app kayitlarini RevenueCat'e ekle
3. Google Play Console'da subscription urun(ler)ini olustur
4. App Store Connect'te subscription urun(ler)ini olustur
5. Bu store urunlerini RevenueCat dashboard'a bagla
6. `premium` entitlement tanimla
7. `apps/mobile/app.json` icindeki RevenueCat API key alanlarini doldur
8. Entitlement id'yi `SmartScroll Pro`, offering id'yi `default` ile hizala
9. Mobil uygulamada `react-native-purchases` ile entitlement'i oku

### Kullaniciya Haber Verilecek An

- RevenueCat hesabi acilacaksa
- Google Play / App Store subscription urunleri olusturulacaksa
- Store product id'leri kesinlestirilecekse

## 2. Reklam Tarafi

### Gerekli Hesaplar

- Google AdMob
- Google Play Console
- Apple Developer Program (iOS release oncesi)

### Yapilacaklar

1. AdMob publisher hesabi ac
2. Uygulamayi AdMob'a ekle
3. Test ad unit'lerini olustur
4. Android icin Play Console'da uygulama `contains ads` olarak beyan edilsin
5. Uygulamaya `react-native-google-mobile-ads` bagla
6. Once test reklamlar, sonra production ad unit'leri ile dogrulama yap

### SmartScrolling App Kimlikleri

- Android package: `com.smartscrolling.mobile`
- iOS bundle identifier: `com.smartscrolling.mobile`

### Release Oncesi Ertelenen Hesap Isleri

- Google Play Console developer account odemesi henuz yapilmadi; Android release asamasinda tamamlanacak.
- Apple Developer Program / iOS AdMob backoffice henuz yapilmadi; iOS release asamasinda tamamlanacak.
- Kod entegrasyonu su an Google demo/test reklam degerleriyle ilerleyebilir.

### P3-24b-b Backoffice Degerleri

Kod entegrasyonuna gecmeden once su degerler hazir olmali:

- `ANDROID_ADMOB_APP_ID`
- `IOS_ADMOB_APP_ID`
- `ANDROID_FEED_STATIC_AD_UNIT_ID`
- `ANDROID_FEED_VIDEO_AD_UNIT_ID`
- `IOS_FEED_STATIC_AD_UNIT_ID`
- `IOS_FEED_VIDEO_AD_UNIT_ID`

### Notlar

- Ilk entegrasyonda gercek production reklam yerine test ad unit'leri kullanilmali.
- EEA / GDPR kapsamindaki consent akisi ayrica degerlendirilmelidir.
- Guest kullanici free kullaniciya gore daha agresif reklam gorebilir; premium kullanici reklam gormez.
- MVP reklam modeli feed icinde ad card mantigiyla ilerler; reader, AI chat, auth ve satin alma akislarina reklam konmaz.
- Fullscreen/interstitial reklamlar MVP kapsaminda yoktur; video reklam varsa feed icinde inline/native ad slot olarak ele alinir.
- Ilk cadence karari:
  - Guest: ilk reklam 5. karttan sonra, sonra her 6 kartta 1; static/banner ve inline video sirayla doner.
  - Free: ilk reklam 9. karttan sonra, sonra her 10 kartta 1; iki static/banner slotundan sonra bir inline video slotu gelir.
  - Premium: reklam kapali.
- Placeholder cadence smoke guest/free/premium icin dogrulandi; gercek AdMob banner render'i ayri adimda acilacak.

## 3. Implementasyon Sirasi

1. Paywall / monetization policy UI
2. RevenueCat entitlement hydration
3. Premium gate'lerin runtime'a baglanmasi
4. Reklam business policy ve backoffice checklist
5. Reklam SDK test entegrasyonu
6. Reklam cadence ve upsell davranisinin feed'e baglanmasi (placeholder smoke tamam)
7. Consent ve release smoke testi

## 4. Bu Asamada Kodda Hazir Olanlar

- Book access policy runtime var
- Auth prompting var
- AI chat ve chat history altyapisi var
- Guest / free / premium policy karar dosyasi var

Bu nedenle sonraki mantikli adim, once paywall giris noktalarini uygulama icinde tek tek sabitlemek; harici hesap baglama isi hemen oncesinde kullaniciya net checklist ile hatirlatilmaktir.

## 5. P3-24b Task Parcalari

- `docs/tasks/p3_24b_a_ads_business_policy.md`
- `docs/tasks/p3_24b_b_admob_backoffice_checklist.md`
- `docs/tasks/p3_24b_c_ads_sdk_test_setup.md`
- `docs/tasks/p3_24b_d_feed_ad_cadence.md`
- `docs/tasks/p3_24b_e_consent_release_smoke.md`
