# P3-24b-b - AdMob Backoffice Checklist

## Amac

Kod entegrasyonuna gecmeden once AdMob ve store tarafindaki zorunlu operasyon adimlarini netlestirmek.

## Kapsam

- AdMob app kaydi.
- Test ve production ad unit planlamasi.
- Play Console `contains ads` beyanı.
- Privacy/Data safety notlari.

## Dokumantasyon Yapilacaklari

- [x] AdMob publisher hesabi kontrol adimini yaz.
- [x] Android app kaydi icin `com.smartscrolling.mobile` package bilgisini yaz.
- [x] iOS app kaydi icin `com.smartscrolling.mobile` bundle id bilgisini yaz.
- [x] Test ad unit ID'lerinin ayri tutulacagini dokumante et.
- [x] Production ad unit ID'lerinin ayri tutulacagini dokumante et.
- [x] Play Console `contains ads` beyan adimini yaz.
- [x] Privacy Policy ve Data safety icin reklam/Advertising ID maddelerini not et.

## External Backoffice Durumu

- [ ] AdMob publisher hesabi hazir.
- [x] Android app kaydi AdMob'da olusturuldu.
- [ ] iOS app kaydi AdMob'da olusturuldu. MVP Android onceligi nedeniyle release oncesi donulecek.
- [x] Android static/banner feed ad unit olusturuldu.
- [x] Android inline native feed ad unit olusturuldu.
- [ ] iOS static/native feed ad unit olusturuldu. MVP Android onceligi nedeniyle release oncesi donulecek.
- [ ] iOS inline video feed ad unit olusturuldu. MVP Android onceligi nedeniyle release oncesi donulecek.
- [ ] Play Console `contains ads` beyanı yapildi.
- [ ] Privacy Policy ve Data safety reklam maddeleri tamamlandi.
- [ ] Google Play Console gelistirici hesabi 25 USD tek seferlik ucret ile tamamlandi. Release oncesi yapilacak.

## Kabul Kriteri

- App ID ve ad unit ID'leri production secret/config akisi icin hazir.
- Test ve production degerleri birbirine karismiyor.
- Play Console reklam beyanı unutulmuyor.

## Notlar

- Bu taskta kod degisikligi yok.
- Production reklamlar ilk test build'lerinde kullanilmayacak.
- Bu dosyanin dokumantasyon kismi tamamlandi; external backoffice adimlari kullanici tarafindan yapilacak.

## Senin Yapman Gerekenler

### 1. AdMob Hesabi ve App Kaydi

1. https://admob.google.com adresine gir.
2. Google hesabinla oturum ac.
3. Sol menuden `Apps` alanina gir.
4. `Add app` sec.
5. App platformu icin once `Android` sec.
6. Uygulama henuz store'da yayinda degilse `No` sec.
7. App name olarak `SmartScrolling` gir.
8. Android package name olarak `com.smartscrolling.mobile` kullan.
9. App kaydini tamamla ve Android `App ID` degerini not al.
10. Ayni islemi iOS icin tekrarla.
11. iOS bundle id olarak `com.smartscrolling.mobile` kullan.
12. iOS `App ID` degerini not al.

### 2. Ad Unit Olusturma

Her platform icin ayri ad unit olustur:

1. AdMob > `Apps` > `SmartScrolling Android` app'ini ac.
2. `Ad units` > `Add ad unit`.
3. Ilk unit icin `Native` veya feed icine uygun format sec.
4. Ad unit name: `feed_static_native_android`.
5. Media type mumkunse static/image agirlikli olacak sekilde ayarla.
6. Ikinci unit icin yine `Native` sec.
7. Ad unit name: `feed_inline_video_android`.
8. Media type mumkunse video destekli olacak sekilde ayarla.
9. Iki `Ad unit ID` degerini not al.
10. Ayni iki ad unit'i iOS app icin de olustur:
    - `feed_static_native_ios`
    - `feed_inline_video_ios`

### 3. Test Reklam Kurali

1. Ilk build'lerde production ad unit ile test yapma.
2. En guvenli ilk asama Google demo/test ad unit degerleriyle SDK entegrasyonu yapmak.
3. Kendi AdMob ad unit'lerini test edeceksen cihazini AdMob'da test device olarak ekle.
4. Production reklama kendi cihazindan tiklama; invalid traffic/policy riski olusturur.

### 4. Play Console Beyani

1. Google Play Console'a gir.
2. SmartScrolling app'ini ac.
3. `Policy and programs` > `App content` alanina git.
4. `Ads` bolumunde uygulamada reklam oldugunu beyan et.
5. `Privacy Policy` URL alaninin dolu oldugunu kontrol et.
6. `Data safety` formunda reklam SDK / Advertising ID / reklam veya pazarlama amacli veri kullanimi maddelerini gercek kullanima gore isaretle.

## Bizim Kodda Kullanacagimiz Degerler

Mevcut bundle/package:

- Android package: `com.smartscrolling.mobile`
- iOS bundle identifier: `com.smartscrolling.mobile`

Gerekli degerler:

- `ANDROID_ADMOB_APP_ID`
- `IOS_ADMOB_APP_ID`
- `ANDROID_FEED_STATIC_AD_UNIT_ID`
- `ANDROID_FEED_VIDEO_AD_UNIT_ID`
- `IOS_FEED_STATIC_AD_UNIT_ID`
- `IOS_FEED_VIDEO_AD_UNIT_ID`

## Alinan Android Degerleri

- Android AdMob App ID: `ca-app-pub-6637567308957272~3442526952`
- Android feed static/banner Ad Unit ID: `ca-app-pub-6637567308957272/6504029909`
- Android feed inline native Ad Unit ID: `ca-app-pub-6637567308957272/4213831924`

## iOS Release Oncesi Donulecek Adim

iOS release hedefi varsa iOS icin de ayni iki reklam birimini olustur:

1. AdMob > SmartScrolling iOS app'ini ac.
2. `Reklam birimi olustur`.
3. Ilk format olarak `Banner` sec.
4. Ad unit name:

```text
feed_static_banner_ios
```

5. Cikan `Ad unit ID` degerini not al.
6. Sonra tekrar reklam birimi olustur.
7. Format olarak `Yerel gelismis` sec.
8. Ad unit name:

```text
feed_inline_native_ios
```

9. Cikan `Ad unit ID` degerini bana gonder.

## Android MVP Siradaki Adim

Not: Kullanici 2026-04-29 tarihinde Google Play Console odemesini henuz yapmamayi secti. Bu adim Android release asamasina gelindiginde tamamlanacak.

1. Google Play Console'a gir.
2. SmartScrolling Android app'ini ac.
3. `Policy and programs` > `App content` alanina git.
4. `Ads` bolumunu bul.
5. Uygulamada reklam oldugunu beyan et: `Yes, my app contains ads`.
6. Kaydet.
7. Sonra `Data safety` formunda Advertising ID / reklam veya pazarlama maddeleri icin mevcut durumu kontrol et.

## Release Oncesi Zorunlu Backoffice

- Google Play Console developer account odemesi ve hesap tamamlanmasi.
- Android `contains ads` beyanı.
- Android Data safety / Advertising ID beyanlari.
- iOS Apple Developer Program hesabi.
- iOS AdMob app ve ad unit kayitlari.
- App Store privacy nutrition label / tracking beyanlari.

## Kaynaklar

- AdMob App ID / Ad Unit ID bulma: https://support.google.com/admob/answer/7356431
- AdMob reklam test etme: https://support.google.com/admob/answer/9388275
- AdMob test device: https://support.google.com/admob/answer/9691433
- Play Console ads beyanı: https://support.google.com/googleplay/android-developer/answer/9859455
