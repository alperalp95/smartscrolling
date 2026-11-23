# P6-01a Unit Test Foundation

## Amac

- P6-01 unit test isini kucuk bir ilk dilimle baslatmak.
- Expo SDK 54 ile uyumlu Jest foundation kurmak.
- Ilk testleri native UI render yerine saf helper davranislarina baglayarak kirilganligi dusurmek.

## Kurallar

- Over-engineering yok.
- Tum uygulama coverage'i bu dilimde hedeflenmez.
- Store, EAS, Supabase remote veya secret islemi yok.
- React Native Testing Library dependency'si foundation icin hazir tutulur; genis component testleri sonraki dilimlere ayrilir.

## Alt Tasklar

- [x] Jest / `jest-expo` ve React Native Testing Library dev dependency'lerini ekle.
- [x] Root ve mobile unit test script'lerini ekle.
- [x] Saf helper testleriyle ilk minimum coverage'i kur.
- [ ] Sonraki dilimde auth prompt, bookmark ve reader progress icin hedefli testleri ayir.

## Test Kapsami

- `factVisuals`: text normalization, source/category visual key mapping ve bad media URL guard.
- `books`: free anchor, signed-out premium, signed-in free ve premium user access policy.

## Verification

- `npm run test:unit`
- `npm run lint`
- `npm run typecheck`
- `npm run check:edge-functions`

## Kapsam Disi

- Maestro / E2E.
- Full screen render testleri.
- Snapshot testleri.
- Coverage threshold zorunlulugu.
- CI workflow degisikligi.
