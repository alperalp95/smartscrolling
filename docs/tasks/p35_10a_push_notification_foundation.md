# P35-10a - Push Notification Foundation

## Goal

Expo push notification altyapisinin mobil uygulamada guvenli ilk temelini kurmak.

## Scope

- `expo-notifications` ve `expo-device` paketlerini Expo uyumlu surumle ekle.
- `app.json` icine `expo-notifications` config plugin'ini ekle.
- Android icin varsayilan notification channel'i olusturan helper ekle.
- Kullanici bilincli olarak bildirim tercihini actiginda permission iste ve Expo push token almayi dene.
- Token'i bu ilk slice'ta remote DB'ye yazma; sonraki scheduling/persistence tasklarina birak.

## User Steps

- Gercek push token testi icin fiziksel cihaz gerekir.
- Android SDK 53+ tarafinda Expo Go yerine development build gerekir.
- Kod foundation tamamlandiktan sonra dev build/cihaz smoke adimlari ayrica uygulanacak.
- 2026-05-10 planina gore ana smoke ortami Android development build + fiziksel Android cihazdir.

## Out of Scope

- Bildirim saati secimi.
- Streak reminder scheduling.
- Yeni icerik bildirimi.
- Push token persistence veya Supabase migration.
- FCM/APNs credential kurulumu.

## Checklist

- [x] Backlog task dosyasi acildi.
- [x] Notification dependency ve app config eklendi.
- [x] Permission/token helper foundation'i eklendi.
- [x] Profilde bildirim opt-in akisi helper'a baglandi.
- [x] Roadmap ve changelog guncellendi.
- [x] Typecheck ve hedefli Biome check calistirildi.
- [x] Degisiklikler commitlendi.

## Acceptance

- Bildirim tercihi acilirken OS permission/token hazirligi tetiklenir.
- Emulator veya Expo Go sinirlari kullaniciya net hata/mesaj olarak doner.
- DB semasi ve scheduling davranisi bu taskta degismez.

## Hotfix Notes

- [x] Native notification/device modulleri top-level import edilmedigi icin build icinde modul yoksa profil route'u crash etmez.
- [x] Native modul eksikligi bildirim opt-in sirasinda kontrollu unsupported mesajina doner.
- [x] Root layout app acilisinda `expo-notifications` yuklemez; native module eksikligi profil route'unu etkilemez.
- [x] `expo-notifications` require edilmeden once gerekli native moduller preflight edilir; `ExpoPushTokenManager` eksikligi kirmizi stack'e donmez.

## Smoke Checklist

- [ ] Android development build fiziksel cihazda acildi.
- [ ] Bildirim toggle kapaliyken OS permission prompt cikmadi.
- [ ] Bildirim toggle acilirken permission prompt bilincli kullanici aksiyonuyla cikti.
- [ ] Permission granted durumunda local schedule sonucu kontrollu gorundu.
- [ ] Permission denied durumunda preference acik kaydedilmedi.
- [ ] Expo push token persistence bu sprintte yapilmadi; remote push sonraki task olarak kaldi.
