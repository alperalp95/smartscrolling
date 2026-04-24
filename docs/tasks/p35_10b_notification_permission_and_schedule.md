# P35-10b Notification Permission And Schedule

## Amac

- Bildirim tercihi olusan kullanicilar icin gercek sistem izin akisi ve hatirlatma scheduling katmanini kurmak.

## Kapsam

- OS permission isteme
- bildirim saati secimi
- local veya remote reminder scheduling

## Yapilacaklar

- [ ] Expo push / local notification mimarisi kararini netlestir
- [ ] Permission isteme anini belirle
- [ ] Saat secim UI'i ekle
- [ ] `notification_hour` / `notification_minute` preference alanlarini kullan
- [ ] Hatirlatma scheduling davranisini uygulama

## Not

- Bu is, `P1-11e_notification_preference` tamamlandiktan sonra ele alinmali.
- Burada artik "preference capture" degil, gercek reminder davranisi hedeflenir.
- Baslangic noktasi, kullanicinin profilden bilinclli sekilde bildirim tercihine opt-in olmasidir.
