# P1-11e Daily Goal Preference

## Amac

- Kullaniciya profile icinde basit bir gunluk hedef secimi sunmak.
- Amac retention'i desteklemek ve ileride progress/streak yuzeylerine anlamli hedef baglayabilmek.

## Kapsam

- Profile ekraninda kucuk bir gunluk hedef karti
- Sinirli ve net secenekler
- Tercihin kalici yazimi

## Onerilen Secenekler

- `3 kart`
- `5 kart`
- `10 dakika`

## Yapilacaklar

- [ ] Gunluk hedef veri modelini netlestir (`type` + `value` veya esdegeri)
- [ ] Profile ekranina basit secim UI'i ekle
- [ ] Secimi Supabase preference katmanina yaz
- [ ] Mevcut secimi profile ekraninda geri goster
- [ ] Bu hedefin daha sonra streak/progress yuzeylerinde kullanilacagini not et, ama bu slice'ta o baglantiyi kurma

## Ilk Uygulama Sonucu

- Veri modeli `daily_goal_type` + `daily_goal_value` olarak secildi.
- Profile ekranina 3 secenekli kucuk gunluk hedef karti eklendi.
- Secim Supabase profile preference katmanina yaziliyor.
- Auth init sirasinda mevcut hedef hydrate edilip profile ekraninda geri gosteriliyor.

## Not

- Bu slice analytics veya goal completion motoru kurmaz.
- Sadece kullanicinin hedefini secmesini ve profile'da gormesini saglar.
