# P35-13 - New Content Notification

## Goal

MVP'de yeni icerik beklentisini duplicate bildirim yaratmadan gunluk local reminder akisi icinde karsilamak.

## Scope

- Ayrica ikinci bir notification kurulmaz.
- Gunluk hedef yoksa veya bugunku hedef tamamlanmissa generic `Bugunku kartlarin hazir` copy'si kullanilir.
- Gercek backend content freshness trigger'i sonraki remote push/task kapsaminda kalir.

## Checklist

- [x] P35-13 MVP davranisi single daily local notification olarak netlestirildi.
- [x] Generic yeni kart copy'si local schedule helper'ina eklendi.
- [x] Ayrica ikinci pending notification kurulmayacak sekilde duplicate riskinden kacinildi.
- [ ] Backend content freshness trigger'i ayri task olarak planlanacak.
- [ ] Android development build smoke sonucu kaydedilecek.

## Acceptance

- Kullanici gunde tek local retention notification alir.
- Notification copy'si streak/daily-goal durumuna gore sade sekilde secilir.
- Gercek yeni content geldi aninda remote push gonderimi bu MVP'nin parcasi degildir.
