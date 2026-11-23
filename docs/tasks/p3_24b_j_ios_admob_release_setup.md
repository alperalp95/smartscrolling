# P3-24b-j - iOS AdMob Release Setup

## Amac

iOS AdMob backoffice, ATT/privacy ve iOS smoke islerini Android MVP smoke kapsamindan ayri release-oncesi task olarak takip etmek.

## Kapsam

- iOS AdMob app ve ad unit olusturma.
- iOS App ID ve ad unit ID'lerini Expo config ile hizalama.
- App Tracking Transparency ve App Store privacy nutrition label kararlarini netlestirme.
- iOS fiziksel cihaz veya TestFlight smoke.

## Yapilacaklar

- [ ] Apple Developer Program ve App Store Connect release hazirligini dogrula.
- [ ] AdMob icinde SmartScrolling iOS app kaydini olustur.
- [ ] iOS static/banner ad unit olustur.
- [ ] iOS native/inline video ad unit olustur veya MVP disi birakildigini netlestir.
- [ ] `app.json` iOS AdMob App ID demo degerinden gercek iOS App ID'ye ayri onayla tasinsin.
- [ ] ATT mesajini ve `userTrackingUsageDescription` metnini release diliyle kontrol et.
- [ ] App Store privacy nutrition label ve Data Used to Track You kararlarini gercek SDK davranisina gore doldur.
- [ ] iOS device/TestFlight smoke yap.

## Notlar

- Bu task Android P3-24b-f demo banner smoke kapsaminda degildir.
- iOS production ad unit switch ayri onay gerektirir.
- Consent/UMP karari kapanmadan personalized production ads release-ready sayilmaz.

