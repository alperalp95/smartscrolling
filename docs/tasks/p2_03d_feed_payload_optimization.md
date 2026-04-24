# P2-03d - Feed Payload Optimization

## Amac

Feed sorgusunun tasidigi veri miktarini, davranisi degistirmeden azaltmak.

## Alt Gorevler

- [x] Feed icin gerekli alanlari netlestir
- [x] `facts` sorgusunu `select('*')` yerine hafif projection ile degistir
- [x] Ilk gorunumu hizlandirmak icin ilk sayfada daha kucuk payload, sonrasinda arka plan prefetch modeli ekle
- [ ] Feed modeli ile full fact modeli ayristirma ihtiyacini sonraki slice'ta degerlendir

## Notlar

- Bu turda DB semasi degismedi.
- Sadece mobil feed sorgusu daraltildi; reader veya diger yuzeyler etkilenmedi.
- Sonraki dilimde dusunulebilirler:
  - server-side feed query strategy
  - weighted ranking veya seeded server-side freshness
  - feed modeli ile full fact modeli ayrisma
