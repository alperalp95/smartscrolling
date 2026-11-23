# P6-02a Maestro Smoke Foundation

## Amac

- P6-02 E2E isini kucuk bir Maestro smoke foundation ile baslatmak.
- Ilk akislari release kritik yuzeylere odaklamak: tab navigation, library -> reader ve compliance yuzeyi.
- Uygulama davranisini degistirmeden stabil `testID` noktalari eklemek.

## Kurallar

- Over-engineering yok.
- Full E2E suite bu dilimde hedeflenmez.
- Store, EAS, Supabase remote veya secret islemi yok.
- Gercek Maestro kosusu emulator/dev build ve lokal Maestro CLI gerektirir; bu dilimde CLI kurulmadi.

## Alt Tasklar

- [x] Feed, Library, Profile, Reader ve compliance yuzeyleri icin minimum `testID` ekle.
- [x] Maestro smoke flow dosyalarini ekle.
- [x] Root `test:e2e:maestro` script'ini ekle.
- [ ] Android emulator/dev build uzerinde `maestro test .maestro` kosusunu yap.
- [ ] Smoke sonucuna gore flow metinlerini veya testID noktalarini dar kapsamla duzelt.

## Flow Kapsami

- `basic-navigation.yaml`: Feed -> Library -> Profile tab navigation.
- `library-reader-smoke.yaml`: Library free anchor kitabi -> Reader acilisi.
- `compliance-guest-smoke.yaml`: misafirde profilde giris cagrisi gorunur, `account-delete-entry` gorunmez.
- `compliance-account-smoke.yaml`: e-posta ile giris yapip `account-delete-entry` gorunur (silmeye basmaz). Kimlik bilgisi YAML icinde degil: `maestro test -e MAESTRO_TEST_EMAIL=... -e MAESTRO_TEST_PASSWORD=... .maestro/compliance-account-smoke.yaml`.
- Not: `maestro test .maestro` env verilmeden hesap akisini da kosar ve basarisiz olur; env ile veya akislari tek tek calistirin.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run check:edge-functions`
- Manuel sonraki adim: Android dev build/emulator hazirken `maestro test .maestro`

## Kapsam Disi

- AI chat report submit E2E.
- Account deletion final destructive action.
- Store/TestFlight/Play Internal Testing.
- Maestro CLI kurulumu ve emulator kosusu.
