# P35-03 - Best Streak Summary

## Goal

Profil ozetinde kullanicinin en iyi gunluk serisini gostermek.

## Scope

- `user_activity` son 90 gun verisinden en uzun aktif gun serisini hesapla.
- Mevcut `fetchActivitySummary()` cevabina `bestStreakDays` ekle.
- Profilde `Gunluk seri` alaninin altinda kucuk `Rekor: X gun` satiri goster.
- Yeni DB kolonu veya migration ekleme.

## Out of Scope

- Streak kirilma uyarisi.
- Streak freeze veya grace period.
- Kalici rekor kolonu.
- Rozet, animasyon veya detayli istatistik ekrani.

## Checklist

- [x] Backlog task dosyasi acildi.
- [x] Best streak son 90 gunluk `user_activity` verisinden hesaplandi.
- [x] Profil ozetinde rekor satiri gosterildi.
- [x] Roadmap ve changelog guncellendi.
- [x] Typecheck ve hedefli Biome check calistirildi.
- [x] Degisiklikler commitlendi.

## Acceptance

- Aktif kullanici profil ekraninda mevcut gunluk seriyle birlikte `Rekor: X gun` bilgisini gorur.
- Veri yoksa rekor `0 gun` olarak kalir.
- Bu is yeni Supabase sema degisikligi gerektirmez.
