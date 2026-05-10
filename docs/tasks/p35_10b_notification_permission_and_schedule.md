# P35-10b Notification Permission And Schedule

## Amac

- Bildirim tercihi olusan kullanicilar icin gercek sistem izin akisi ve hatirlatma scheduling katmanini kurmak.

## Kapsam

- OS permission isteme
- bildirim saati secimi
- local reminder scheduling
- remote push/token persistence kararini ayri taska birakma

## Yapilacaklar

- [x] Expo push / local notification mimarisi kararini netlestir
- [x] Permission isteme anini belirle
- [x] Saat secim UI'i ekle
- [x] `notification_hour` / `notification_minute` preference alanlarini kullan
- [x] Hatirlatma scheduling davranisini uygulama
- [x] Emulator UX bulgulari sonrasi Profile permission sync davranisini duzelt
- [ ] Android development build fiziksel cihaz smoke sonucunu kaydet

## Karar

- Bu sprintte local notifications kullanilir.
- Expo push token persistence, FCM/APNs credential kurulumu ve backend remote push trigger'i kapsam disidir.
- OS permission yalnizca kullanici profilde `Bildirimler` ayarini bilinclli actiginda istenir.
- Toggle kapatilinca SmartScrolling pending local notification kayitlari temizlenir.
- Android App Info > Notifications kapatilirsa Profile focus sync app preference'i kapatir ve pending reminder'lari temizler.
- App Info kapali durumdan sonra Profile yeniden acmaya calisirsa fake selected state gosterilmez; sistem ayarlarina yonlendiren mesaj verilir.
- App acilisinda, saat degisiminde ve kart okuma ilerlemesinde best-effort cancel/reschedule yapilir.
- Expo SDK 54 resmi dokumani kontrol edildi: Android SDK 53+ remote push icin Expo Go yeterli kabul edilmez; Android development build hedeflenir. Local notifications Expo Go'da daha genis destekli olsa da P35 smoke hedefi development build'dir.
- Production/preview remote push icin FCM/APNs credential ve Expo Push Service testi sonraki tasktir.

## Smoke Checklist

- [ ] Toggle kapaliyken izin istenmez.
- [ ] Toggle acilinca permission prompt gorunur.
- [ ] Izin reddedilirse UI/DB acik kalmaz.
- [ ] Izin verilirse secili saat icin tek SmartScrolling pending local notification kurulur.
- [ ] Saat degisince eski pending notification iptal edilip yenisi kurulur.
- [ ] Toggle kapatilinca pending notification temizlenir.
- [ ] Android App Info'dan notification kapatilinca Profile UI/DB off'a senkronlanir.
- [ ] Sistemden kapaliyken yeniden acma denemesi fake selected state yaratmaz, ayar yonlendirmesi gosterir.

## Not

- Bu is, `P1-11e_notification_preference` tamamlandiktan sonra ele alinmali.
- Burada artik "preference capture" degil, gercek reminder davranisi hedeflenir.
- Baslangic noktasi, kullanicinin profilden bilinclli sekilde bildirim tercihine opt-in olmasidir.
- Emulator smoke bulgusu: permission request app girisinde degil, yalnizca Profile `Bildirimler` aksiyonunda kalacak.
