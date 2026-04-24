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

Kalan kritik dis bagimliliklar:
- Supabase Dashboard > Google provider setup
- allowed redirect URL listesi
- Google Cloud tarafinda uygun client id / callback hizasi
- dev build ve production build uzerinde smoke test

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

- Expo/iOS icin secilecek paket kararini netlestir
- gerekli native dependency ve capability ayarlarini ekle
- Apple identity token'ini Supabase `signInWithIdToken` ile session'a cevir
- iOS fiziksel cihaz smoke test'i yap

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

- Sosyal auth tarafinda sorun "kucuk bir eksik ayar" degil.
- Su an Google ve Apple icin hem UI hem helper hem callback hem de dashboard hizasi eksik.
- En dusuk riskli yol:
  - once Google
  - sonra Apple
