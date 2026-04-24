# P1-15b - Source Whitelist Enforcement

## Amac

`verified` rozetini Groq ciktisina birakmadan, pipeline tarafinda guvenilir kaynak politikasiyla uretmek.

## Alt Gorevler

- [x] Source whitelist kurallarini pipeline icinde ayri bir policy modulune tası
- [x] `insertFact` oncesinde `verified` alanini source policy ile yeniden hesapla
- [ ] Whitelist domain listesini MVP kaynak genislemesine gore Stanford Encyclopedia, PubMed ve benzeri yeni kaynaklarla buyut
- [ ] Review gerektiren whitelist-disi kaynaklar icin ayri isaretleme stratejisi ekle

## Notlar

- Ilk turda whitelist yalnizca `wikipedia.org` ve `nasa.gov` ailesini kapsar.
- Bu gorev `P2-07` altinda tanimlanan operasyonel kurali pipeline davranisina ceviren ilk teknik enforcement adimidir.
