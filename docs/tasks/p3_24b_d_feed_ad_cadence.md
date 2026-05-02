# P3-24b-d - Feed Ad Cadence

## Amac

Feed icinde guest/free segmentlerine gore reklam slotlarini kontrollu sekilde yerlestirmek.

## Kapsam

- Feed item listesine UI-only ad slot ekleme.
- Guest/free/premium cadence.
- Static/banner ve inline video siralama.

## Yapilacaklar

- [x] Feed item modeline UI-only ad slot ekle.
- [x] Guest icin ilk reklam 5. karttan sonra, sonra her 6 kartta 1 olacak sekilde yerlestir.
- [x] Free icin ilk reklam 9. karttan sonra, sonra her 10 kartta 1 olacak sekilde yerlestir.
- [x] Premium kullanicida ad slot uretme.
- [x] Guest icin her 2. ad slotu inline video destekli olarak isaretle.
- [x] Free icin her 3. ad slotu inline video destekli olarak isaretle.
- [x] Reader, AI chat ve paywall akislarina reklam koyma.

## Kabul Kriteri

- Reklamlar feed akisini bozmaz.
- Premium kullanici reklam gormez.
- Guest reklam yogunlugu free'den yuksektir.
- Fullscreen/interstitial reklam tetiklenmez.

## Notlar

- Video, feed icinde native/inline ad slot olarak ele alinir.
- Ani popup/fullscreen video MVP kapsaminda yoktur.

## Uygulama Notlari

- `insertFeedAdSlots()` helper'i `apps/mobile/src/lib/ads.ts` icine eklendi.
- Feed listesi artik `FactType | FeedAdSlot` union'i ile render ediliyor.
- Static slotlarda simdilik native AdMob render kapali tutulur ve crash-safe placeholder gosterilir.
- Inline native/video slotlar simdilik slot karti olarak ayriliyor; gercek native ad render'i consent/release smoke oncesi ayri dogrulanacak.
- Premium kullanicida ad slot uretilmez.
- Native AdMob module binary icinde olmadiginda `react-native-google-mobile-ads` import'u crash ettigi icin runtime import kapatildi.
- Cadence smoke icin gercek AdMob render'i bilerek kapali tutulur; bu asamada beklenen goruntu placeholder slotlaridir.

## Verification

- [x] `npm run typecheck`
- [x] `npx biome check apps/mobile/src/lib/ads.ts 'apps/mobile/app/(tabs)/index.tsx' --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=30`
- [x] Development build ile guest/free/premium placeholder cadence smoke test
  - Kullanici dogrulamasi: guest, free ve premium segmentlerinde reklam slot davranisi dogru calisiyor.
  - Cadence hesap kontrolu: guest `5, 11, 17, 23...`; free `9, 19, 29, 39...`; premium slot uretmez.
- [ ] Development build ile Android gercek AdMob test reklam smoke test
  - Mevcut build'de `RNGoogleMobileAdsModule could not be found` goruldu; fallback eklendi. Gercek banner icin AdMob SDK'yi iceren yeni native development build gerekir.
  - Runtime import gecici olarak kapatildi; gercek AdMob banner render'i ayri adimda tekrar acilacak.
