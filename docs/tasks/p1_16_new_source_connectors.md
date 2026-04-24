# P1-16 - Yeni Kaynak Connector'leri

## Amac

Wikipedia ve NASA disinda, daha curated ve urun degeri yuksek yeni kaynaklari pipeline'a eklemek.

## Alt Gorevler

- [x] `Stanford Encyclopedia of Philosophy` icin curated topic listesiyle ilk connector'u ekle
- [x] `MedlinePlus` icin curated topic listesiyle ilk connector'u ekle
- [x] Bu iki kaynagi mevcut quality gate, consistency gate ve source policy zincirine bagla
- [x] `run-all` akisini yeni kaynaklari da isleyecek sekilde genislet
- [x] Kucuk probe ile en az bir yeni kaynak kaydinin DB'ye girebildigini dogrula
- [ ] Sonraki dilimde `NOAA`, `ESA`, `CERN` veya `Our World in Data` gibi yeni curated kaynaklari degerlendir

## Notlar

- Stanford connector'u HTML paragraph extraction ile calisiyor ve felsefe odakli seed topic havuzu kullaniyor.
- MedlinePlus connector'u saglik odakli seed topic havuzu kullaniyor; `Mental Health` probe'u quality/consistency zincirinden gecip DB'ye yazildi.
- Source-aware prompt yapisi ve source excerpt destekli consistency gate, yeni connector'lerin de ayni kalite hattinda calismasini sagliyor.
- Sonraki guvenli kaynak genisleme dilimi olarak, mevcut connector'leri bozmadan `Stanford` ve `MedlinePlus` topic havuzlarini buyutmek; ikinci adim olarak da `NOAA`, `ESA`, `CERN` veya `Our World in Data` gibi curated kaynaklari eklemek planlanir.
- 2026-04-20 arastirma notu: Turkce kaynak genislemesi icin en umut verici adaylar `Khan Academy Turkce`, `TUBITAK Bilim Genc`, `TDV Islam Ansiklopedisi` ve uygun yapisi bulunursa `T.C. Saglik Bakanligi / Saglikli Bilgi` katmanidir.
- Bu adaylarin tamami ayni seviyede degildir:
  - `Khan Academy Turkce`: yuksek hacim ve guclu Turkce icerik, ancak format daha cok ders/anlatim odaklidir; fact extraction icin secili konu havuzu gerekir.
  - `TUBITAK Bilim Genc`: Turkce populer bilim ve bilim tarihi icerigi guclu; ancak lisans/kullanim kosullari ayrica kontrol edilmelidir.
  - `TDV Islam Ansiklopedisi`: tarih ve felsefe icin derin Turkce icerik saglar; ancak konu ekseni ve urun tonu dikkatle secilmelidir.
  - `Saglik Bakanligi / Saglikli Bilgi`: resmi ve Turkce olmasi degerlidir; fakat bilgi sayfasi yapisi ve connector ergonomisi ayrica dogrulanmalidir.
- Sonraki slice'ta mevcut connector'leri bozmadan seed topic havuzlari buyutuldu:
  - `Stanford`: `Metaphysics`, `Logic and Ontology`, `Free Will`, `Philosophy of Mind`, `Political Philosophy`, `Justice as Fairness`
  - `MedlinePlus`: `Digestive Diseases`, `Blood Pressure`, `Cholesterol`, `Exercise and Physical Fitness`, `Stress`, `Diabetes`
- Sonraki temizlik turunda 404 veren seed'ler duzeltildi:
  - `Stanford`: `Philosophy of Mind` yerine `Modularity of Mind`, `Justice as Fairness` yerine `John Rawls`
  - `MedlinePlus`: `Blood Pressure` topic'i gercek konu sayfasi olan `highbloodpressure.html` ile hizalandi
- Kategori sayimlarinda `Saglik` ve `Felsefe` geride kaldigi icin bu iki kaynakta hedefli bir seed genisletmesi daha yapildi:
  - `Stanford`: `Personal Identity`, `Philosophy of Religion`, `Moral Responsibility`, `Consciousness`, `Pragmatism`, `Social Contract Theory`
  - `MedlinePlus`: `Anxiety`, `Depression`, `Obesity`, `Digestive System`, `Asthma`, `Exercise for Children`
- Sonraki ince ayarda `Stanford` extraction katmani hafifletildi; uzun felsefe entry'lerinin Groq JSON uretimini bozma riskini azaltmak icin paragraph sayisi `3 -> 2` olarak dusuruldu.
- Sonraki urun kararinda kategori esitligi yerine `minimum healthy floor` benimsendi; bu nedenle yeni seed/topic genislemesi `Saglik` ve `Teknoloji` odagina kaydirildi.
- Bu turda:
  - `MedlinePlus`: `Kidney Diseases`, `Lung Diseases`, `Healthy Aging`, `Metabolism`, `Pain`, `Rehabilitation`
  - `Wikipedia technology`: `Computer programming`, `Distributed computing`, `Search engine`, `Open-source software`, `Cloud computing`, `Digital signal processing`
  - `Wikipedia health`: `Kidney`, `Lung`, `Pain management`, `Aging`, `Rehabilitation`, `Metabolism`
- Sonraki dengeli buyume turunda yine sadece zayif kategorilere hafif destek verildi:
  - `MedlinePlus`: `Arthritis`, `Liver Diseases`, `Bones, Joints and Muscles`, `Medical Tests`
  - `Wikipedia technology`: `Computer architecture`, `Compiler`, `Data compression`, `Cryptography`
  - `Wikipedia health`: `Arthritis`, `Liver`, `Respiratory system`, `Medical diagnosis`
- Son mini saglik turunda:
  - `MedlinePlus`: `Digestive Health`, `Heart Health Tests`, `Mobility Aids`, `Patient Safety`
  - `Wikipedia health`: `Digestive health`, `Patient safety`, `Mobility aid`, `Cardiovascular examination`
