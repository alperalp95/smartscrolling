# P35-06c - Feed Read Qualification Threshold

## Goal

Feed'de hizli kaydirilan kartlarin gunluk kart okuma sayacini sisirmesini engellemek.

## Scope

- Kart okundu sayimini `activeFactId` olur olmaz yapmak yerine kart progress'i esik gecince yap.
- Esik: kart suresinin %35'i, minimum 2 saniye, maksimum 5 saniye.
- Pause durumunda progress durdugu icin okundu esigi de ilerlemesin.
- Ayni kart ayni session'da bir kez sayilmaya devam etsin.
- Yeni dependency, migration veya veri modeli degisikligi ekleme.

## Out of Scope

- Backend event modeli.
- Kalici per-card read history.
- Analytics event taxonomy.
- Streak veya hedef UI tasarimini degistirme.

## Checklist

- [x] Backlog task dosyasi acildi.
- [x] Kart progress threshold callback'i eklendi.
- [x] Feed `facts_read` increment'i threshold sonrasina tasindi.
- [x] Roadmap ve changelog guncellendi.
- [x] Typecheck ve hedefli Biome check calistirildi.
- [x] Degisiklikler commitlendi.

## Acceptance

- Kullanici karttan esik dolmadan hizli kayarsa `facts_read` artmaz.
- Kullanici kartta esik kadar kalirsa kart okundu sayilir.
- Pause sirasinda esik ilerlemez.
- Ayni kart tekrar gorulse bile session icinde ikinci kez sayilmaz.
