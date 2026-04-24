# P1-15c - Duplicate Fingerprint Guard

## Amac

`facts` akisinda duplicate kontrolunu yalnizca `source_url` ile sinirli birakmamak; ayni kategoride normalize edilmis baslik tekrarlarini da erken asamada elemek.

## Alt Gorevler

- [x] Duplicate kontrol mantigini pipeline icinde ayri bir policy modulune tasi
- [x] `source_url` duplicate kontrolune ek olarak normalize `title` guard'i ekle
- [ ] Metin fingerprint veya benzerlik skoru tabanli duplicate guard ekle
- [ ] Duplicate adaylarini review veya raporlama akisina isaretle

## Notlar

- Ilk turda duplicate title kontrolu ayni kategori icinde normalize edilmis baslik esitligi ile calisir.
- Bu dilim MVP icin dusuk riskli bir kalite korumasi saglar; agir similarity algoritmasi bilincli olarak sonraya birakildi.
