# P35-06e - Feed Paging Viewport Fix

## Goal

Fiziksel Android cihazlarda, ozellikle 3 tus navigation modunda, Feed paging kartlarinin yarim sayfa veya kayik oturmasini engellemek.

## Scope

- Feed liste viewport'unu cihaz modeline gore degil, runtime layout olcumune gore belirle.
- Fact kartlari ve ad kartlari ayni olculen page height ile render edilsin.
- FlashList paging davranisi tam sayfa snap hissini korusun.
- Eski Android navigation bar modlarinda app tab bar kesilmesine karsi kucuk guvenlik payi ekle.

## Out of Scope

- Feed redesign.
- Tab bar redesign.
- Bildirim veya remote push akisi.
- Cihaz modeline ozel layout kurali.

## Checklist

- [x] Feed wrapper `onLayout` ile gercek viewport yuksekligini olcer.
- [x] Fact ve ad kart yuksekligi olculen viewport yuksekliginden gelir.
- [x] FlashList `snapToInterval` olculen page height ile hizalanir.
- [x] Android fling momentum'u tek swipe'ta birden fazla kart atlamayacak ama gecis hissi sertlesmeyecek sekilde sinirlandi.
- [x] Android tab bar bottom padding'e kucuk navigation guard eklendi.
- [x] Roadmap ve changelog guncellendi.
- [x] Emulator ve fiziksel Android 3 tus navigation smoke kabul edildi.

## Smoke Notes - 2026-05-11

- Emulator smoke: kartlar tek tek ilerliyor; yarim sayfa/kayik paging gorulmedi.
- Fiziksel Android smoke: Feed paging guzel gorundu; eski Android navigation bar kesilme riski icin kucuk tab bar guard eklendi.
- Scroll hissi icin `disableIntervalMomentum` korundu, `decelerationRate="fast"` kaldirildi.

## Acceptance

- Android 3 tus navigation modunda swipe sonrasi kart yarim sayfa baslamaz.
- Normal kaydirmada kartlar tek tek ilerler; hizli fling 2-3 kart birden atlamaz.
- Gesture navigation ve emulator paging davranisi bozulmaz.
- Alt tab/progress/action alanlari mevcut safe offset davranisini korur.
- Eski Android navigation modlarinda app tab bar alttan kesik gorunmez.
