# P2-02 - FlashList Feed Gecisi

## Amac

Gunluk bilgi akisinda `FlatList` yerine `FlashList` kullanarak daha stabil ve performansli bir dikey swipe deneyimi elde etmek.

## Alt Gorevler

- [x] `@shopify/flash-list` bagimliligini mobil workspace'e ekle
- [x] Feed ekranindaki ana listeyi `FlatList`ten `FlashList`e tasi
- [x] Pagination, refresh ve viewability akisini yeni liste katmaninda koru
- [x] Android emulator ve web preview uzerinde swipe/pagination davranisini canli dogrula

## Notlar

- Bu ilk gecis turunda kart bilesenine dokunulmaz; sadece liste katmani degisir.
- Canli dogrulama temiz gecti; sonraki feed stabilite iyilestirmelerinde aktif kart takibi `id` bazina tasindi ve pagination append sirasi korunarak hizli swipe flicker'i ile "asagi gidemedim ama yukarida yeni kart gordum" hissi azaltildi.
