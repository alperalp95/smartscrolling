# P1-13 Social Auth Gap Audit

## Mevcut Durum

- Email/sifre auth calisiyor.
- `supabase.auth.onAuthStateChange` root layout icinde bagli.
- Profil ekraninda email/sifre login-signup-signout akisi var.
- `app.json` icinde `scheme = "mobile"` tanimli.
- `expo-web-browser` paketi kurulu.

## Google Auth Icin Eksikler

- Profil ekraninda Google login button'u yok.
- Mobil sosyal auth helper'i yok:
  - `supabase.auth.signInWithOAuth({ provider: 'google' })`
  - `redirectTo` uretimi
  - auth browser session acma/kapatma
- OAuth callback handling yok:
  - deep link / redirect route
  - app'e donuste session alma veya code exchange
- Supabase Dashboard `Authentication > Providers > Google` config'i backlog'ta, ama uygulama ile hizali redirect listesi dokumante edilmis degil.
- Google tarafinda `Web Client ID` / consent / callback eslesmesi icin env veya config alani eklenmemis.
- `app.json` icinde `expo-web-browser` plugin config'i yok.

## Apple Auth Icin Eksikler

- Profil ekraninda Apple login button'u yok.
- Apple Sign-In icin native library secimi ve entegrasyonu yok.
- iOS capability / entitlement setup yok.
- Apple icin gerekli config alani yok:
  - Service ID
  - Team ID / Key ID / private key dashboard setup notu
  - redirect URI hizasi
- Android veya web icin Apple davranisi hic tanimlanmamis.

## Kod Seviyesinde Gozlenen Bosluklar

- `apps/mobile/src/lib/supabase.ts`
  - session persistence var, ama social auth flow helper'i yok.
- `apps/mobile/app/_layout.tsx`
  - auth state subscription var, ama deep link callback handling yok.
- `apps/mobile/app/(tabs)/profile.tsx`
  - sadece email/sifre auth aksiyonlari var.
- Repo icinde su kullanimlar yok:
  - `signInWithOAuth`
  - `exchangeCodeForSession`
  - `getSessionFromUrl`
  - `makeRedirectUri`
  - `openAuthSessionAsync`
  - Apple sign-in native package kullanimi

## Guncel Dokuman ve Resmi Beklenti

- Supabase Expo social auth quickstart Google mobil icin `signInWithOAuth` tabanli bir akisi oneriyor.
- Apple tarafinda Supabase dokumani native uygulamalar icin `signInWithIdToken` tabanli bir akisa da isaret ediyor.
- Bu nedenle Google ve Apple ayni teknik yolla cozulmeyecek:
  - Google: Supabase OAuth redirect flow
  - Apple: native Sign in with Apple + Supabase `signInWithIdToken` daha dogru aday

## Onerilen Uygulama Sirasi

1. Google auth'i once tamamla
2. Redirect URI stratejisini netlestir
3. Supabase Dashboard allowlist'i hizala
4. Profile ekranina Google button'unu bagla
5. Callback/session handling'i dogrula
6. Ardindan Apple Sign-In icin native paket ve capability setup'ina gec

## Google Icin Beklenen Sonraki Isler

- [x] `socialAuth.ts` benzeri merkezi helper katmani ekle
- [x] platform bazli callback URI uret
- [x] `signInWithOAuth({ provider: 'google', options: { redirectTo } })` akisini yaz
- [x] auth browser donusunde session finalize et
- [x] profile ekranina `Google ile Devam Et` CTA'si ekle
- dashboard provider config ve allowlist adimlarini task'a not et

## Google First Slice Durumu

- `apps/mobile/src/lib/socialAuth.ts` eklendi.
- `apps/mobile/app/auth/callback.tsx` callback route'u eklendi.
- Profil ekranina Google login CTA'si baglandi.
- `expo-web-browser` plugin config'i `app.json` icine yazildi.

## Google Config Confirmation - 2026-05-06

- Supabase Dashboard > Google provider aktif.
- Supabase Google provider client id girilmis durumda.
- Supabase Google OAuth callback URL'i Google Cloud OAuth client ile hizali:
  - `https://gfbhzvaqngaxucbjljht.supabase.co/auth/v1/callback`
- Supabase Dashboard > Authentication > URL Configuration redirect allowlist icinde mobil callback var:
  - `mobile://auth/callback`
- Google Cloud OAuth client authorized redirect URI listesinde Supabase callback URL'i var:
  - `https://gfbhzvaqngaxucbjljht.supabase.co/auth/v1/callback`
- Mevcut production app identifiers:
  - Expo scheme: `mobile`
  - iOS bundle identifier: `com.smartscrolling.mobile`
  - Android package: `com.smartscrolling.mobile`

## Google Smoke Result - 2026-05-06

- Google login dev build uzerinde fiziksel Android cihazda kullanici tarafindan smoke edildi.
- Beklenen akis dogrulandi:
  - Profil ekraninda `Google ile Devam Et`
  - Google hesap secimi / OAuth akisi
  - uygulamaya `mobile://auth/callback` ile donus
  - Supabase session olusumu
- Google tarafinda kalan release-oncesi kontrol:
  - ayni smoke akisini EAS preview/internal veya production candidate build uzerinde tekrar et
  - release domain'i varsa `Site URL` degerini `http://localhost:3000` yerine gercek web/landing URL ile hizala

## Decision Note

- `expo-auth-session` ilk denemede degerlendirildi.
- Ancak bu yol `ExpoCrypto` native module bagimliligi getirdigi icin mevcut dev build ile ek native rebuild ihtiyaci olusturdu.
- Google login icin mevcut ihtiyac seviyesinde `expo-web-browser + deep link callback` daha sade ve daha dusuk riskli bulundu.
- Bu nedenle ilk dilimde `expo-auth-session` aktif cozum olarak korunmadi.
- Bu bir eksik degil, bilincli teknik tercih olarak kaydedildi.
- Yalnizca ileride:
  - daha karmasik social auth orkestrasyonu,
  - ek provider ihtiyaci,
  - ortak PKCE abstraction gereksinimi
  cikarsa yeniden degerlendirilecek.

## Apple Icin Beklenen Sonraki Isler

- Expo/iOS icin `expo-apple-authentication` kullan.
- Apple native response icindeki `identityToken` degerini Supabase `signInWithIdToken({ provider: 'apple' })` ile session'a cevir.
- Apple butonunu yalnizca iOS ve uygun cihazlarda goster; Android/web tarafinda Apple CTA gosterme.
- Apple full name bilgisinin yalnizca ilk authorization sirasinda gelebilecegini not et; gelirse user metadata'ya kaydet, yoksa akisi bozma.
- Secret, service role key, Apple private key veya generated client secret mobil koda koyma.

## Apple Foundation Task Split - 2026-05-06

1. Native dependency/config foundation
   - [x] `expo-apple-authentication` dependency'sini Expo uyumlu surumle ekle.
   - [x] `apps/mobile/app.json` icinde Apple Sign-In capability icin Expo config'i ekle.
   - Beklenen config: iOS bundle id `com.smartscrolling.mobile`.
2. Mobile helper foundation
   - [x] `socialAuth.ts` icine Apple helper'i ekle.
   - [x] `AppleAuthentication.signInAsync()` sonucu `identityToken` yoksa kontrollu hata don.
   - [x] `supabase.auth.signInWithIdToken({ provider: 'apple', token })` ile session olustur.
3. Profile UI foundation
   - [x] Google CTA'nin altina iOS-only Apple CTA ekle.
   - [x] Android/web'de Apple button render etme.
   - [x] Loading/error feedback'i mevcut auth feedback modeliyle ayni tut.
4. Verification foundation
   - [x] `npm run lint`
   - [x] `npm run typecheck`
   - [x] `npx expo config --type public`
   - [x] iOS olmayan platformlarda Apple CTA'nin gorunmedigini statik platform guard ile kontrol et.

## Apple Foundation Implementation - 2026-05-06

- `expo-apple-authentication@~8.0.8` mobile workspace'e eklendi.
- `apps/mobile/app.json` icinde `ios.usesAppleSignIn = true` eklendi.
- `apps/mobile/src/lib/socialAuth.ts` icinde `isAppleSignInAvailable()` ve `signInWithApple()` helper'lari eklendi.
- Apple native sign-in nonce ile baslatiliyor; gelen `identityToken` Supabase `signInWithIdToken({ provider: 'apple' })` ile session'a cevriliyor.
- Apple full name yalnizca native response'da gelirse user metadata'ya yaziliyor; gelmezse akisi bozmayacak.
- `apps/mobile/app/(tabs)/profile.tsx` icinde Apple proprietary button yalnizca iOS ve `AppleAuthentication.isAvailableAsync()` true ise render ediliyor.
- Android/web tarafinda Apple CTA gosterilmiyor.
- Bu foundation P1-13 kapsamindaki kod isini kapatir; Apple Developer paid team, Supabase Apple provider config ve iOS fiziksel cihaz smoke release-oncesi dis bagimlilik olarak takip edilecek.
- Verification gecti: `npm run lint`, `npm run typecheck`, `npx expo config --type public`.

## Kullanıcıdan Beklenen Release-Oncesi Isler

- Apple Developer Program odemesini tamamla ve paid team erisimini aktif et.
- Apple Developer tarafinda Team ID'yi not al.
- App ID / Bundle ID `com.smartscrolling.mobile` icin Sign in with Apple capability'yi aktif et.
- EAS iOS credentials/provisioning akisinin paid team ile tamamlanabildigini dogrula.
- Supabase Dashboard > Apple provider config icin gerekirse Services ID, Key ID ve `.p8` private key hazirla.
- Apple private key / generated client secret degerlerini mobil koda veya repo dosyalarina koyma; yalnizca Apple Developer / Supabase Dashboard tarafinda kullan.
- Apple/Supabase callback hizasini release oncesi kontrol et:
  - `https://gfbhzvaqngaxucbjljht.supabase.co/auth/v1/callback`
- iOS fiziksel cihazda dev/preview build smoke yap:
  - Apple button gorunur
  - native sheet acilir
  - Supabase session olusur
  - app restart sonrasi session korunur
  - sign out calisir
- Google icin release oncesi EAS preview/internal veya production candidate build uzerinde bir kez daha fiziksel cihaz smoke yap.
- Gercek web/landing domain yayina alinacaksa Supabase `Site URL` degerini `http://localhost:3000` yerine release domain'iyle hizala.

## Apple Dashboard / Developer Release Blocker

- Kullanici henuz paid Apple Developer Program hesabina sahip degil.
- Bu nedenle Apple release smoke su an hesap/yetki bagimliligi nedeniyle beklemede.
- Release oncesi tamamlanmasi gereken dis config:
  - Apple Developer paid team
  - Team ID
  - App ID / Bundle ID: `com.smartscrolling.mobile`
  - Sign in with Apple capability
  - Gerekirse Services ID
  - Gerekirse Key ID ve `.p8` private key ile Supabase Apple provider secret kurulumu
  - Supabase Dashboard > Apple provider config
  - Apple/Supabase callback hizasi: `https://gfbhzvaqngaxucbjljht.supabase.co/auth/v1/callback`
  - iOS fiziksel cihazda dev/preview build smoke
- Apple final smoke kabul kriterleri:
  - Apple button iOS cihazda gorunur
  - Sign in with Apple native sheet acilir
  - kullanici izin verir
  - Supabase session olusur
  - profil auth provider Apple olarak gorunur veya hesap bagli duruma gecer
  - app restart sonrasi session korunur
  - sign out calisir

## Apple Build / Test Blocker

- EAS ile fiziksel iPhone development build denemesinde Apple Developer Portal auth asamasi bloklandi.
- Alinan hata: kullanilan Apple hesabinin bir developer team ile iliskili olmadigi ve bu nedenle credential/provisioning kurulumu yapilamadigi yonunde.
- Sonuc:
  - Ucretli Apple Developer Program hesabi olmadan mevcut Windows + EAS development build akisi ile fiziksel iPhone smoke test yapilamayacak.
  - Bu blokaj teknik implementasyon eksiginden ziyade hesap/yetki bagimliligi.
- Bu nedenle Apple Sign-In isi icin dogru siralama su sekilde not edildi:
  1. Kod ve dashboard hazirliklarini tamamla
  2. Ucretli Apple Developer hesabi/team baglantisi saglandiginda iOS build al
  3. Final fiziksel cihaz smoke testini o asamada yap

## Sonuc

- P1-13 uygulama/repo kapsami 2026-05-06 itibariyla kapatildi.
- Google OAuth kodu, Supabase provider config'i, redirect allowlist'i, Google Cloud callback hizasi ve fiziksel Android dev build smoke tamam.
- Apple Sign-In native foundation tamam: Expo dependency/config, iOS-only CTA ve Supabase `signInWithIdToken` helper'i hazir.
- P1-13 kapanisi Apple Developer odemesi yapilmadan alindi; Apple paid team/config ve iOS fiziksel cihaz smoke release-oncesi dis bagimlilik olarak ayrildi.
- Son verification: `npm run lint`, `npm run typecheck`, `npx expo config --type public`.
