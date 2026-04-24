# P1-00 Stabilizasyon Sprinti Teknik Task Listesi

Bu liste backend ve platform guvenilirligini onceleyen teknik siraya gore hazirlandi. Amac yeni ozellik eklemeden once kalite kapilarini yesile cevirmek ve veri sozlesmesini sabitlemek.

## 1. Kod kalite kapilarini yesile cek

- [x] `npm run lint` cikisini temizle.
- [x] Generated dosyalari (`.expo/**`) manuel kalite kapsamindan ayir.
- [x] `import type`, format ve kolay statik analiz hatalarini temizle.
- [x] `npx tsc --noEmit` icin mevcut hata siniflarini dokumante et.

## 2. TypeScript kok nedenini kapat

- [x] React Native JSX tip kiriklarinin kaynagini netlestir.
- [x] Gerekirse `tsconfig`, Expo generated types veya kutuphane tip uyumunu duzelt.
- [x] UI seviyesindeki acik tip hatalarini gider:
- [x] `external-link.tsx`
- [x] `parallax-scroll-view.tsx`
- [x] `app/(tabs)/index.tsx`
- [x] `app/book/[id].tsx`

## 3. Veri sozlesmesini hizala

- [x] Feed store, Supabase veri modeli ve mobil tipleri ayni alan adlarina cek.
- [x] `FactType` benzeri tiplerde `content/source_label/media_url` ile UI beklentilerini uyumlu hale getir.
- [ ] Mock alanlari ve production alanlarini ayir.
- [x] Gerekli donusum katmanini store seviyesinde merkezilestir.

## 4. Backend cekirdegi icin minimum isleyen akislari tamamla

- [x] Auth iskeletini netlestir ve backend baglantisini hazirla.
- [x] Save/bookmark davranisini kalici hale getir.
- [x] Reading progress yazimini backend'e bagla.
- [x] AI definition akisi icin edge function entegrasyonunu aktif hale getir.

## 5. CI ve dokumantasyon kapisi

- [x] CI'ya `typecheck` adimi ekle.
- [x] README ve roadmap dokumanlarini gercek durum ile hizala.
- [x] Stabilizasyon sprinti sonunda tekrar `lint` ve `typecheck` ciktilarini kayda al.

## Mevcut Durum

- Tamamlanan bloklar: kalite kapilari, TypeScript kok neden cozumlemesi, veri sozlesmesinin ilk hizalama turu, auth foundation, bookmark persistence, reading progress ve AI definition/chat entegrasyonu
- Dogrulama: `npm run lint` basarili, `apps/mobile` icinde `npx tsc --noEmit` basarili
- Son stabilizasyon notu: web preview sirasinda gecici olarak bozulan kalite kapilari tekrar yesile cekildi
- Siradaki kritik isler: chat history kalicilastirma, books akisini dogrudan veritabanindan besleme ve auth RLS dogrulama turu

## Uygulama Sirasi

1. Lint ve generated dosya temizligi
2. TypeScript kok neden analizi ve ilk tip duzeltmeleri
3. Veri sozlesmesi hizalama
4. Kalici backend akislarinin acilmasi
5. CI ve dokumantasyon guvencesi
