# P1-11 Auth Foundation

- [x] Auth gorevini alt adimlara bol ve `docs/tasks/` altinda takip et
- [x] Session store ekle (`session`, `user`, `isInitializing`)
- [x] Root layout icinde `onAuthStateChange` dinleyicisini bagla
- [x] Profile ekranina temel email/sifre login-signup-signout iskeletini ekle
- [x] `public.users` bootstrap akisini trigger veya fallback ile tamamla
- [x] Auth sonrasi bookmark/progress akislari icin merkezi refresh noktalarini bagla
- [x] Google / Apple OAuth backlog'u icin ayar notlarini ekle

## OAuth Notes

- Google OAuth icin Supabase Dashboard `Authentication > Providers > Google` altinda client id / secret tanimlanmali.
- Apple Sign-In icin Apple Developer tarafinda Service ID, Key ID, Team ID ve private key uretilmeli.
- Expo tarafinda redirect URI stratejisi web / ios / android icin tek yerden tanimlanmali.
- Production oncesi Supabase allowed redirect URL listesi Expo deep link ve web callback adresleriyle hizalanmali.
- Mobil UI tarafinda provider button'lari eklenmeden once dashboard konfigrasyonu tamamlanmali.

## Verification

- [x] `npm run lint`
- [x] `npm run typecheck`
