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
- [x] Backend content freshness trigger'i `P35-10c Remote Push Token Foundation` sonrasina baglandi.
- [x] Remote push sender smoke `P35-10d` olarak acildi.
- [x] Content freshness trigger task'i P35-10d Android dev build sender smoke sonucundan sonra acilacak.
- [x] Android development build smoke sonucu kaydedildi: P35-10d physical Android token + sender receipt smoke `status: ok`.
- [x] Gercek backend content freshness trigger `P35-13b` olarak planlandi ve broadcast MVP seklinde eklendi.
- [ ] Interest-based token hedefleme broadcast MVP smoke sonrasina birakildi.

## Acceptance

- Kullanici gunde tek local retention notification alir.
- Notification copy'si streak/daily-goal durumuna gore sade sekilde secilir.
- Gercek yeni content geldi aninda remote push gonderimi bu MVP'nin parcasi degildir.
- Remote content trigger icin P35-10c token persistence ve P35-10d server-side sender smoke tamamlandi; backend freshness push P35-13b ile daily ingest sonrasina baglandi.
- Interest-based hedefleme bu MVP'nin parcasi degildir; broadcast smoke sonrasinda ayri task olarak ele alinacak.
