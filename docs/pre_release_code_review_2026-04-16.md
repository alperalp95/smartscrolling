# Pre-release Code Review

Tarih: 2026-04-21

Not:
- `CodeRabbit` ile review istense de bu ortamda `coderabbit` CLI kurulu degil.
- Repo artik bir `git` worktree, ancak CLI eksik oldugu icin review yine manuel yapildi.
- Calistirilan kontroller:
  - `npm run lint` -> gecti
  - `npm run typecheck` -> gecti

## Ozet

Son guncellemelerle birlikte onceki review'daki iki buyuk riskin durumu daha iyi:

- Feed kategori filtreleme mantigi duzeltilmis gorunuyor.
- Premium entitlement altyapisi ve premium ekraninin ilk baglantisi eklenmis.

Buna ragmen release oncesi halen dikkat ceken 4 guncel bulgu var:

1. Premium state bazi kritik veri yukleme akislarina hala baglanmamis.
2. Feed ekraninda kullaniciya gorunen debug katmani kalmis.
3. Feed upsell CTA'si premium ekrani yerine profile ekranina gidiyor.
4. Auth bootstrap `isInitializing` state'i hala fiilen calismiyor.

## Bulgular

### 1. Major - Premium entitlement kismen baglanmis, ama veri yukleme tarafinda hala sabit `false` kullaniliyor

Etki:
- Premium kullanici kutuphane kartlarinda dogru erisim goruyor gibi dursa da, "Devam Et" verisi hala premium degilmis gibi filtreleniyor.
- Daha kritik olarak, okuyucu ekrani veri yuklerken premium state'i dikkate almadigi icin premium kullanici dogrudan kitap ekranina gittiginde tam section verisi yerine bos/fallback akisa dusme riski tasiyor.
- Satin alma veya restore sonrasi bu ekranlar `hasPremium` degisimine gore tekrar yuklenmiyor.

Kanit:
- `apps/mobile/app/(tabs)/library.tsx:144` -> `fetchContinueBooks(user?.id, false)`
- `apps/mobile/app/(tabs)/library.tsx:158` -> effect sadece `user?.id` ile bagli, `hasPremium` degisimini dinlemiyor
- `apps/mobile/app/book/[id].tsx:137-141` -> `resolveBookAccess(... hasPremium: false ...)`
- `apps/mobile/app/book/[id].tsx:164` -> reader load effect'i `hasPremium` degisimini dinlemiyor
- `apps/mobile/app/book/[id].tsx:286-292` -> render tarafinda ise `hasPremium` kullaniliyor; yani UI ve data load karari birbirinden kopuk

Neden onemli:
- Bu durum "premium aldim ama premium icerik tam acilmadi" hissi yaratir.
- En riskli senaryo, premium kullanicinin kilit kalkmis UI gorurken gercek section datasini alamamasi.

Oneri:
- `fetchContinueBooks` cagrisina gercek `hasPremium` gecilmeli.
- Reader tarafinda access karari tek yerde verilmeli; data load ve render ayni entitlement kaynagini kullanmali.
- `library` ve `book/[id]` effect dependency listelerine `hasPremium` eklenmeli.

### 2. Major - Feed ekraninda production'a cikmamasi gereken debug overlay kalmis

Etki:
- Her fact kartinda kullaniciya `remote`, `local`, `fallback-no-media` ve `visual_key` gibi internal debug bilgileri gosteriliyor.
- Bu metinler son kullaniciya bir anlam ifade etmez; urunun polish seviyesini dusurur ve production debug build hissi verir.

Kanit:
- `apps/mobile/app/(tabs)/index.tsx:430-446` -> `imageDebugMode` hesaplaniyor
- `apps/mobile/app/(tabs)/index.tsx:617-619` -> debug badge dogrudan UI'da render ediliyor
- `apps/mobile/app/(tabs)/index.tsx:1086-1100` -> debug badge stilleri kalici olarak tanimli

Neden onemli:
- Bu issue crash yaratmaz ama ana feed ekraninda surekli goruldugu icin release kalitesini dogrudan etkiler.

Oneri:
- Debug badge tamamen kaldirilmali ya da sadece development flag'i altina alinmali.
- Performans loglari gerekiyorsa analytics/dev logging katmanina tasinmali; kullanici UI'sina cikmamali.

### 3. Major - Feed upsell CTA'si yanlis ekrana gidiyor

Etki:
- "Premiumu Incele" CTA'si premium funnel yerine profile ekranina yonlendiriyor.
- Kullanici paywall beklerken profile'a dusuyor; bu da monetization akisini zayiflatir.

Kanit:
- `apps/mobile/app/(tabs)/index.tsx:968-978` -> upsell karti premium copy kullaniyor
- `apps/mobile/app/(tabs)/index.tsx:978` -> `onConfirm: () => router.push('/profile')`

Neden onemli:
- Bu, dogrudan donusum kaybi yaratabilecek bir routing hatasi.

Oneri:
- Bu CTA `'/premium'` ekranina gitmeli.
- Feed, library ve reader upsell aksiyonlari tek bir helper icinde toplanip ayni hedefi kullanmali.

### 4. Minor - `isInitializing` state'i hala fiilen hic `true` olmuyor

Etki:
- Session bootstrap var ama "oturum kontrol ediliyor" durumu dogru temsil edilmiyor.
- Guest UI'nin kisa sureli yanlis gorunmesi ve auth flicker riski devam ediyor.

Kanit:
- `apps/mobile/src/store/authStore.ts:21` -> baslangic `false`
- `apps/mobile/src/store/authStore.ts:29` -> sadece `false`'a cekiliyor
- `apps/mobile/app/_layout.tsx:29-55` -> bootstrap var, ama `startInitializing` benzeri bir gecis yok

Oneri:
- `startInitializing` aksiyonu eklenmeli.
- Root layout mount aninda `true`, ilk session/premium hydration tamamlaninca `false` olmali.

## Kapanan veya Iyilestirilen Alanlar

- Feed kategori modeli artik normalize ediliyor; onceki birebir-string esleme sorunu buyuk oranda kapanmis gorunuyor.
- Premium altyapi tarafinda RevenueCat baglantisi, premium ekran ve entitlement hydration eklenmis.
- Emoji/label bozulmalarinin bir kismi duzeltilmis, ancak bazi gorunur metinlerde hala kucuk encoding artefaktlari kalmis olabilir.

## Release Oncesi Oncelik Sirasi

1. Premium state'in library ve reader veri yukleme katmanina tam baglanmasi.
2. Feed debug badge'in production UI'dan cikarilmasi.
3. Feed upsell routing'inin `'/premium'` olarak duzeltilmesi.
4. Auth bootstrap state'inin gercek bir initializing akisina kavusturulmasi.

## Sonuc

Proje su an build/lint/typecheck seviyesinde temiz ve onceki review'e gore daha olgun. Ancak yukaridaki ilk 3 madde, ozellikle premium deneyim ve monetization akisi icin release oncesi duzeltilmesi gereken guncel riskler olarak duruyor.
