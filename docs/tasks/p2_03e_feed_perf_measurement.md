# P2-03e - Feed Performance Measurement

## Amac

Feed yuklenme hissinin gercekten nerede yavasladigini olcmek; veri, ilk kart ve ilk gorsel zamanlarini ayirmak.

## Alt Gorevler

- [x] Feed sorgusu icin elapsed time logu ekle
- [x] Ilk kart ekranda gorundugu anin logunu ekle
- [x] Ilk feed gorselinin yuklendigi ani logla
- [x] Emulator uzerinde olcum sonuclarini degerlendir

## Notlar

- Bu turda davranis degismedi; yalnizca olcum loglari eklendi.
- Ilk olcumlerde `request ~1706ms` ve `first_card_visible ~1821ms` goruldu; bunun uzerine ilk sayfa boyutu dusurulup arka plan prefetch modeli guclendirildi.
