# P2-03c - Feed Freshness

## Amac

Akisin her giriste ve belirli etkileşimlerde daha taze hissettirmesi; kullanicinin ayni ilk karti tekrar tekrar gormemesi.

## Alt Gorevler

- [x] Feed sirasina kontrollu rotation mantigi ekle
- [x] Kategori degisiminde rotation yenile
- [x] Pull-to-refresh aninda rotation yenile
- [x] Uygulama background'dan active'e dondugunde feed'i tazele
- [x] Alt nav'da `Akis` sekmesine tekrar basildiginda refresh + rotation tetikle
- [x] Rotation mantigini daha guclu seeded shuffle seviyesine cikar
- [x] Kategori seciminde bos kategori gorunurse arka planda ek sayfa cekerek backfill dene

## Notlar

- Bu turda tam shuffle yerine rotation tercih edildi; boylece akisin tutarliligi korunurken ilk gorulen kart farklilasir.
- Sonraki dilimde rotation yerine server-side freshness veya weighted ranking gerekip gerekmedigi degerlendirilebilir.
