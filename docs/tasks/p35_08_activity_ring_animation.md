# P35-08 - Activity Ring Animation

## Goal

Feed ekranindaki gunluk kart activity ring'ini kisa ve dikkat dagitmayan bir dolma animasyonuyla daha canli hale getirmek.

## Scope

- Animasyon yalnizca feed'deki sol activity ring'de calissin.
- Ring ekrana geldiginde progress 0'dan mevcut hedef yuzdesine kisa animasyonla dolsun.
- Kart sayisi degistikce ring mevcut durumdan yeni yuzdeye yumuşak gecsin.
- Yeni animasyon kutuphanesi ekleme; mevcut React Native `Animated` kullan.

## Out of Scope

- Profil haftalik grafikte animasyon.
- Surekli pulse/donme animasyonu.
- Yeni dependency.
- Activity veri modeli veya Supabase degisikligi.

## Checklist

- [x] Backlog task dosyasi acildi.
- [x] Feed activity ring animasyonu eklendi.
- [x] Roadmap ve changelog guncellendi.
- [x] Typecheck ve hedefli Biome check calistirildi.
- [x] Degisiklikler commitlendi.

## Acceptance

- Kullanici feed ekranina geldiginde activity ring mevcut progress'e dogru kisa animasyonla dolar.
- Animasyon yeni paket gerektirmez.
- Ring text, basa don butonu ve mevcut activity davranisi degismez.
