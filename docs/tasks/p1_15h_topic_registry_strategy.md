# P1-15h - Topic Registry ve Freshness Stratejisi

## Amac

Curated seed sistemini tamamen atmadan, uzun vadede buyuyen ve bakimi zorlasan konu listelerini daha olgun bir `topic registry` modeline evriltmek.

## Alt Gorevler

- [ ] Seed sistemini birincil uretim motoru degil, `editorial starter set` olarak tanimla
- [ ] `topic_registry` icin hedef veri modelini cikar (`topic_name`, `category`, `source_type`, `seed_priority`, `status`, `last_processed_at`, `times_generated`)
- [ ] Uretim stratejisini uc katmanli hale getir:
  - core seed pool
  - expansion layer
  - freshness layer
- [ ] Release sonrasi haftalik kontrollu ingest modelini tanimla (gunluk yerine haftalik 10-20 yeni kart gibi)
- [ ] `topic_registry` gecisini release sonrasi mimari iyilestirme backlog'u olarak planla

## Notlar

- Mevcut seed sistemi su an yanlis degil; kaliteyi hizli toparlamak icin dogru gecis katmani oldu.
- Ancak uzun vadede tek basina buyutulmesi duplicate agirligini, manuel bakim maliyetini ve yeni kart cikis hizini zorlayacaktir.
- Bu nedenle release oncesi hedef:
  - mevcut curated seed + source quality gate ile tabani buyutmek
- Release sonrasi hedef:
  - seed'leri `topic_registry` ile orkestre edilen daha olgun bir konu havuzuna tasimak
- Tazelik hissi icin her gun yeni icerik zorunlu degildir; haftalik kontrollu batch + farkli siralama + kategori rotasyonu daha saglikli bir model olabilir.
