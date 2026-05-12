# P35-11 - Notification Time Preference

## Goal

Kullaniciya profile icinden sade bir bildirim saati secimi sunmak.

## Scope

- `users.notification_hour` ve `users.notification_minute` alanlari.
- Varsayilan saat `20:00`, dakika `00`.
- Profile settings icinde saat chip'leri: `18:00`, `19:00`, `20:00`, `21:00`, `22:00`.
- Saat degisince preference persist edilir ve local reminder best-effort yeniden kurulur.
- Bildirim row'u acikken saat chip panelini acar/kapatir.
- Secili olmayan saat secilince panel kapanir; secili saate tekrar basmak bildirimleri kapatir.

## Checklist

- [x] Migration dosyasi olusturuldu.
- [x] Mobil Supabase tipleri guncellendi.
- [x] Preference fetch/update helper'i guncellendi.
- [x] Onboarding/profile store hydration guncellendi.
- [x] Profile saat chip UI'i eklendi.
- [x] Remote Supabase migration kullanici onayi sonrasi uygulandi.
- [x] Emulator UX bulgulari sonrasi saat paneli kompakt editor davranisina cekildi.
- [x] Android development build smoke sonucu kaydedildi.

## Acceptance

- Kullanici bildirim acikken profile icinde secili saati gorur.
- Saat degisimi Supabase preference katmanina yazilir.
- App yeniden acilinca secili saat hydrate olur.
- Secili saat chip'ine dokunmak bildirimi kapatir ve pending reminder'i temizler.
- Dakika hassasiyeti bu MVP'de yoktur; dakika `00` olarak sabittir.

## Smoke

- Fiziksel Android development build uzerinde bildirim saati davranisi basarili goruldu.
- Saat degisimi sonrasi local reminder best-effort yeniden kurulum akisi kabul edildi.
