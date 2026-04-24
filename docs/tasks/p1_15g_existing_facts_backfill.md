# P1-15g - Existing Facts Backfill

## Amac

Mevcut `facts` kayitlarini, yeni "yorum yok / bilgi uydurma yok / kaynakla eslesen bilgi" kuralina gore kontrollu sekilde yeniden uretmek.

## Alt Gorevler

- [ ] `source_url` bulunan mevcut fact kayitlarini backfill adayi olarak listele
- [ ] Ham kaynagi tekrar cekip yeni prompt ile yeniden ureten script hazirla
- [ ] Quality gate'i gecmeyen veya kaynak fetch'i basarisiz olan kayitlari skip et
- [ ] Ilk turu kucuk batch (10-20 kayit) ile calistir ve sonuc kalitesini gozden gecir
- [ ] Guvenli bulunursa daha genis batch'lere yay

## Notlar

- Bu gorev mevcut `title/content` alanlarini kor gozle duzeltmek icin degil, `source_url` uzerinden source-based regeneration yapmak icindir.
- Backfill sadece quality gate'i gecen ve kaynakla yeniden eslesebilen kayitlara uygulanmalidir.
- En dogru zamanlama, source strategy ve prompt sadakati yeterince stabil olduktan sonradir; yani hemen degil, release oncesi kontrollu kalite turu olarak ele alinmalidir.
