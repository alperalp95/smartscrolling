# P3-10i Translation Cost Optimization

Bu gorev, `EN raw -> TR reader edition` akisinda Groq kota ve maliyet baskisini azaltmak icin acildi.

## Sorun

- Ilk pilotta daha `section 1/3` seviyesinde `rate_limit_exceeded` goruldu.
- Ana neden, translate modunda section chunk'larinin hala gorece buyuk kalmasi ve ilk denemede pahali model kullanimi.

## Alinan Karar

- [x] Translate modunda parse edilen section'lar daha kucuk parcalara bolunecek.
- [x] Varsayilan `maxWordsPerSection` translate akisinda `420` olarak dusuruldu.
- [x] Bu deger hem `.env` ile hem de CLI flag'i ile override edilebilir hale getirildi.
- [ ] Gerekirse sonraki adimda daha hafif Groq modeli icin kalite/maliyet denemesi yapilacak.

## Teknik Not

- Normal EN parse preview akisi hala `900` kelime sinirina yakin section mantigini koruyor.
- Sadece `--translate-tr` modunda daha kucuk section chunk'lari kullaniliyor.
- Yeni CLI secenegi:
  - `--translation-max-words 320`
- Yeni env:
  - `GROQ_TRANSLATION_MAX_WORDS=420`

## Beklenen Etki

- Tek section basina giden prompt boyutu kuculur
- TPD/TPM baskisi azalir
- 3 section'lik kalite pilotunu bitirme sansi artar

## Sonraki Adim

- Kota reset oldugunda ilk deneme:
  - `--section-limit 3 --translation-max-words 320`
- Hala pahaliysa model secimi ikinci optimizasyon katmani olacak
