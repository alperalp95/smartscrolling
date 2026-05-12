# P35-02 - Streak Break Warning

## Goal

Streak kirilma riskini P35-12 local reminder stack'iyle cakismadan belirlemek ve tek local reminder copy'sine baglamak.

## Scope

- Yeni bir notification sistemi kurulmaz.
- Ayrica ikinci pending notification olusturulmaz.
- Remote push, background task ve tetik aninda Supabase sorgusu bu slice'in parcasi degildir.
- Risk state'i `user_activity` uzerinden turetilir; `users.streak_days` kullanilmaz.
- P35-04 grace/freeze hakki veya harcama modeli kapsam disidir.

## MVP Behavior

- Aktif gun tanimi mevcut streak sistemiyle aynidir: `facts_read`, `pages_read` veya `ai_queries` toplami `0`dan buyukse gun aktiftir.
- Bugun aktifse streak riskte degildir.
- Bugun henuz aktif degil ama dun aktifse streak bugun riskte sayilir.
- Bugun ve dun aktif degilse risk gosterilmez; seri zaten kirilmis kabul edilir.
- Risk state'i daily goal'dan degil, streak active day tanimindan turetilir.

## Checklist

- [x] Task dokumani acildi.
- [x] P35-12 ile duplicate notification yaratmama siniri netlestirildi.
- [x] `ActivitySummary` icine migration'siz streak risk state'i eklendi.
- [x] P35-02c: risk state'i tek local reminder copy'sine baglandi.
- [ ] Android development build smoke sonucu P35-12 ile birlikte kaydedilecek.

## Acceptance

- Bugun aktif, dun aktif: `isStreakAtRiskToday = false`.
- Bugun bos, dun aktif: `isStreakAtRiskToday = true`.
- Bugun bos, dun de bos: `isStreakAtRiskToday = false`.
- Bugun bos, dun aktifken `streakDays` mevcut tasima davranisini korur.
- Bugun aktif olunca `streakDays >= 1` ve risk false olur.
- Risk true iken P35-12 single local reminder copy'si streak kirilma uyarisi olarak secilir.
- Ayni anda birden fazla SmartScrolling daily reminder kurulmaz.
- Remote push veya freeze/grace migration'i gerekmez.

## Follow-up

Fiziksel Android development build smoke P35-12 ile birlikte kaydedilecek. Inline profile/feed risk mesaji MVP icin zorunlu degildir.
