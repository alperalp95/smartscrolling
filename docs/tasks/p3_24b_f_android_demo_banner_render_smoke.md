# P3-24b-f - Android Demo Banner Render Smoke

## Amac

Android development build icinde Google demo/test `BannerAd` render'ini en kucuk guvenli slice ile dogrulamak.

## Kapsam

- Sadece Android feed static/banner ad slotlari.
- Google demo/test ad unit ID'leri.
- Guarded native AdMob module load ve initialize.
- Guest/free/premium cadence'in korunmasi.
- Physical Android development build smoke runbook'u.
- Smoke basarili olursa Android preview/internal build hazirligi.

## Yapilacaklar

- [x] Native AdMob module yoksa app crash etmeyecek guarded loader ekle.
- [x] App acilisinda Android icin tek seferlik guarded AdMob initialize cagir.
- [x] Static feed ad slotlarinda Google demo banner render et.
- [x] `inline_video` slotlarini bu MVP smoke'ta placeholder olarak tut.
- [x] Production Android ad unit ID'lerini runtime'a alma.
- [ ] Fiziksel Android development build ile guest/free/premium smoke yap.
- [ ] Development smoke basarili olunca Android preview/internal build al.

## Kabul Kriteri

- Expo Go hedef degil; yeni Android development build gerekir.
- Guest feed'de static ad slotta Google demo/test banner gorunur.
- Free feed'de daha seyrek static ad slotta Google demo/test banner gorunur.
- Premium kullanicida ad slot/reklam gorunmez.
- `inline_video` slotu native/video render etmez; placeholder kalir.
- Reader, AI chat, auth ve premium/paywall akislarina reklam eklenmez.
- Production ad unit ID kullanilmaz.

## Uygulama Notlari

- `apps/mobile/src/lib/adMob.ts` Android-only guarded loader ve initialize helper'i olarak eklendi.
- `apps/mobile/app/_layout.tsx` app acilisinda `initializeGoogleMobileAdsForDemoSmoke()` cagirir; native module yoksa fallback korunur.
- `apps/mobile/app/(tabs)/index.tsx` static ad slotlarinda `BannerAd` + `BannerAdSize.BANNER` kullanir.
- `apps/mobile/src/lib/ads.ts` cadence ve `GOOGLE_DEMO_AD_UNITS` sozlesmesi korunur.

## Verification

- [x] `npm run typecheck`
- [x] `npx biome check apps/mobile/src/lib/adMob.ts apps/mobile/src/lib/ads.ts "apps/mobile/app/(tabs)/index.tsx" apps/mobile/app/_layout.tsx apps/mobile/app.json --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=30`
- [x] `npm run lint`
- [x] `npm run check:edge-functions`
- [x] `cd apps/mobile && npx expo config --type public`
- [ ] Fiziksel Android development build smoke:
  - Guest: demo banner gorunur.
  - Free: demo banner daha seyrek gorunur.
  - Premium: ad slot/reklam yok.
  - Native module crash yok.
  - Production ad unit yok.

## Build Runbook

```powershell
cd C:\Users\Administrator\smartscrolling\apps\mobile
npx eas whoami
npx eas build --platform android --profile development
```

Build cihaza kurulduktan sonra:

```powershell
cd C:\Users\Administrator\smartscrolling\apps\mobile
npx expo start --dev-client
```

Development smoke basarili olunca tester preview:

```powershell
cd C:\Users\Administrator\smartscrolling\apps\mobile
npx eas build --platform android --profile preview
```
