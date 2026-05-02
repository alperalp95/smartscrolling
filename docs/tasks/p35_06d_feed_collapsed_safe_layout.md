# P35-06d - Feed Collapsed Safe Layout

## Goal

Fiziksel Android cihazlarda collapsed feed kartinin alt tab/navigation alanina tasmasini engellemek.

## Scope

- Sadece feed'deki normal/collapsed kart layout'unu duzelt.
- Kisa ekranlarda preview metin satir sayisini dinamik azalt.
- Collapsed kart alt boslugunu Android safe-area farklarina karsi biraz daha korumali yap.
- Debug `imageDebugBadge` bilgisini normal kullanicidan gizle; yalnizca review/dev yuzeyinde goster.

## Out of Scope

- Expanded okuma modu.
- Profil, kutuphane veya reader ekranlari.
- Cihaz modeline ozel ayar.
- Feed kart redesign'i.

## Checklist

- [x] Backlog task dosyasi acildi.
- [x] Collapsed feed kartinda dinamik preview satir sayisi eklendi.
- [x] Alt bosluk safe-layout icin korumali hale getirildi.
- [x] Debug badge normal kullanimda gizlendi.
- [x] Roadmap ve changelog guncellendi.
- [x] Typecheck ve hedefli Biome check calistirildi.
- [x] Degisiklikler commitlendi.

## Acceptance

- Poco X3 Pro gibi fiziksel Android cihazlarda collapsed kart alt aksiyon/tab bar alanina tasmaz.
- Pixel emulator gibi daha rahat ekranlarda kart gereksiz bosluklu gorunmez.
- Debug fallback bilgisi review/dev yuzeyi disinda gorunmez.
