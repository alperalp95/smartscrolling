# P35-13 - New Content Notification

## Goal

MVP'de yeni icerik beklentisini duplicate bildirim yaratmadan gunluk local reminder akisi icinde karsilamak.

## Scope

- Ayrica ikinci bir notification kurulmaz.
- Gunluk hedef yoksa veya bugunku hedef tamamlanmissa generic `Bugunku kartlarin hazir` copy'si kullanilir.
- Gercek backend content freshness trigger'i P35-13b broadcast MVP olarak daily ingest sonrasina baglandi.

## Checklist

- [x] P35-13 MVP davranisi single daily local notification olarak netlestirildi.
- [x] Generic yeni kart copy'si local schedule helper'ina eklendi.
- [x] Ayrica ikinci pending notification kurulmayacak sekilde duplicate riskinden kacinildi.
- [x] Backend content freshness trigger'i `P35-10c Remote Push Token Foundation` sonrasina baglandi.
- [x] Remote push sender smoke `P35-10d` olarak acildi.
- [x] Content freshness trigger task'i P35-10d Android dev build sender smoke sonucundan sonra acilacak.
- [x] Android development build smoke sonucu kaydedildi: P35-10d physical Android token + sender receipt smoke `status: ok`.
- [x] Gercek backend content freshness trigger `P35-13b` olarak planlandi ve broadcast MVP seklinde eklendi.
- [x] P35-13b GitHub Actions daily workflow smoke tamamlandi: `sent: true`, `freshFactCount: 8`, `targetCount: 1`, Expo receipt `status: ok`.
- [x] Interest-based token hedefleme MVP sonrasina birakildi.

## Acceptance

- Kullanici gunde tek local retention notification alir.
- Notification copy'si streak/daily-goal durumuna gore sade sekilde secilir.
- Gercek yeni content geldikten sonra daily ingest basarisi uzerinden broadcast remote push denenir.
- Remote content trigger icin P35-10c token persistence, P35-10d server-side sender smoke ve P35-13b workflow smoke tamamlandi.
- Interest-based hedefleme bu MVP'nin parcasi degildir; MVP sonrasi ayri task olarak ele alinacak.
