# P3-24b-e - Consent ve Release Smoke

## Amac

Reklam entegrasyonunu store policy, consent ve release smoke testleriyle kapatmak.

## Kapsam

- UMP / consent karari.
- Test reklam dogrulamasi.
- Production ad unit gecis checklist'i.
- Store beyanlarinin son kontrolu.

## Yapilacaklar

- [ ] EEA/UK/Isvicre kullanicilari icin consent stratejisini netlestir.
- [ ] Google UMP veya Google-certified CMP gereksinimini release checklist'ine bagla.
- [ ] Test ad unit'lerle guest/free/premium reklam smoke test yap.
- [ ] Premium kullanicida reklam gosterilmedigini dogrula.
- [ ] Production ad unit gecisine hazirlik notu ekle.
- [ ] Play Console `contains ads` ve Data safety beyanlarini son kez kontrol et.

## Kabul Kriteri

- Consent gereksinimi release oncesi acik kalmaz.
- Test reklamlar guest/free icin gorunur, premium icin gorunmez.
- Production ad unit'e gecis bilincli ve dokumante edilir.

## Notlar

- Bu task tamamlanmadan production reklam yayina alinmaz.
- Consent olmadan kisisellestirilmis reklam akisi baslatilmaz.
