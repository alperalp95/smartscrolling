# P3-24b-c - Ads SDK Test Setup

## Amac

Mobil uygulamaya reklam SDK'sini test reklamlarla ve minimum riskle baglamak.

## Kapsam

- `react-native-google-mobile-ads` kurulumu.
- Expo config plugin ayarlari.
- Test app id / ad unit id kullanimi.
- Dev build gereksinimi.

## Yapilacaklar

- [x] `react-native-google-mobile-ads` paketini mobile workspace'e ekle.
- [x] `apps/mobile/app.json` icinde AdMob app id config'ini test degerleriyle ekle.
- [x] Reklam ID'lerini tek helper/config dosyasindan okut.
- [x] Premium kullanicida reklam disabled olacak temel guard'i ekle.
- [x] Expo Go yerine dev build gerektigini dokumante et.

## Kabul Kriteri

- Typecheck gecer.
- Test ad unit ile SDK initialize edilebilir.
- Production ad unit kullanilmadan test build alinabilir.

## Notlar

- Bu task feed'e reklam yerlestirme task'i degildir.
- Sadece SDK ve test setup katmani hedeflenir.

## Uygulama Notlari

- `react-native-google-mobile-ads` mobile workspace'e eklendi.
- Expo config plugin `apps/mobile/app.json` icine Android icin gercek AdMob App ID, iOS icin Google demo App ID ile baglandi.
- Gercek production Ad Unit ID degerleri henuz reklam cagrilarinda kullanilmiyor.
- `apps/mobile/src/lib/ads.ts` icinde guest/free/premium audience, cadence ve demo ad unit config'i toplandi.
- Static/banner demo unit ID'leri banner test unit'lerine hizalandi.
- Premium kullanicida `shouldShowAds()` false doner.
- Expo Go bu native module'u calistirmaz; reklam testleri icin development build gerekir.
- Expo SDK 54 monorepo native module duplicate riskine karsi `experiments.autolinkingModuleResolution` aktif edildi.
- `apps/mobile/.easignore` eklendi; local `node_modules` ve build/cache dosyalari EAS arsivinden dislandi.
- Native crash'in asil nedeni `expo-auth-session@55.0.15` ile Expo SDK 55 modullerinin SDK 54 projesine gelmesiydi.
- `npx expo install expo-auth-session` ile paket `expo-auth-session@~7.0.11` surumune indirildi; transitive `expo-crypto` artik SDK 54 uyumlu `15.0.9`.
- `apps/mobile/package-lock.json` stale kaldigi icin `expo-auth-session` ve `react-native-google-mobile-ads` entry'leri senkronlandi; EAS native build'in AdMob dependency'sini kacirmamasi icin bu lockfile artik package.json ile uyumlu.

## Verification

- [x] `npm run typecheck`
- [x] `npx biome check apps/mobile/src/lib/ads.ts apps/mobile/app.json --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=20`
- [x] `npx biome check apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/ads.ts 'apps/mobile/app/(tabs)/index.tsx' --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=30`
- [x] `npx biome check apps/mobile/package-lock.json apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/ads.ts 'apps/mobile/app/(tabs)/index.tsx' --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=30`
- [ ] Development build ile test reklam smoke test
  - Ilk build native Expo module duplicate crash verdi: `NoSuchMethodError ... ClassComponentBuilder`.
  - Duzeltme olarak `autolinkingModuleResolution`, mobile `.easignore`, SDK 54 uyumlu `expo-auth-session` surumu ve senkron `apps/mobile/package-lock.json` eklendi; gercek native AdMob render'i acilmadan once yeni development build alinacak.

## Kaynaklar

- React Native Google Mobile Ads Expo setup: https://docs.page/invertase/react-native-google-mobile-ads
- Google demo/test ads: https://support.google.com/admob/answer/9388275
