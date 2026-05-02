# P1-15m - Wikipedia Seed Registry ve Freshness Ops

## Amac

Wikipedia seed sistemini release sonrasi surdurulebilir hale getirmek. Seed'ler kategori kotasi icin degil, kaliteli aday kesfi icin kullanilir.

Model:

- `core seed pool`: guvenilir, dusuk riskli, kalici baslangic konulari.
- `expansion layer`: haftalik eklenen yeni konu basliklari.
- `cooldown/blacklist`: tekrar tekrar reject eden veya duplicate olan seed'leri gecici ya da kalici olarak durdurma.

## Kapsam

Ana hedef dosyalar:

- `packages/pipeline/src/lib/wiki-source-policy.js`
- `packages/pipeline/src/sources/wikipedia.js`
- `packages/pipeline/src/runners/review-wikipedia-candidates.js`
- `packages/pipeline/src/runners/run-all.js`

Opsiyonel DB/migration karari:

- `topic_registry` veya `wiki_seed_runs` tablosu release oncesi gerekli mi degerlendir.
- Ilk dilimde kod tabanli seed + audit dosyasi yeterliyse DB tablosu ertelenebilir.

## Kapsam Disi

- Seed'leri feed kategori filtresi gibi kullanmak.
- Category alanini DB'den silmek.
- Dusuk kaliteli random fallback'e donmek.
- Her seed'i her gun tekrar denemek.

## Uygulama Plani

- [ ] `wiki-source-policy.js` icinde seed katmanlarini ayir.
  - `CORE_TR_CATEGORY_SEED_TOPICS`
  - `EXTRA_TR_CATEGORY_SEED_TOPICS`
  - `DISABLED_TR_SEED_TOPICS`

- [ ] Tekrar sorun cikaran seed'leri disabled/cooldown listesine al.
  - Ornek: kaliteye surekli takilan veya source alignment bozan seed'ler.
  - Disabled nedeni yorumla veya audit ciktisiyla takip edilsin.

- [ ] `review-wikipedia-candidates` ciktisina seed/source audit bilgisi ekle.
  - seed title
  - normalized category
  - taxonomy confidence
  - source policy reason
  - duplicate/freshness durumu

- [ ] Haftalik seed tuning rutini tanimla.
  - En cok saved veren seed ailelerini genislet.
  - En cok reject veren seed'leri cooldown'a al.
  - Yeni seed eklemeden once source-only pilot calistir.

- [ ] Gerekirse DB tablosu tasarimini hazirla.
  - `wiki_seed_topics`: title, lang, seed_category, status, cooldown_until, notes.
  - `wiki_seed_runs`: seed_topic, attempted_at, candidates, saved, rejected, duplicate, groq_failed.

## Kabul Kriterleri

- Seed havuzu merkezi policy icinde kalir.
- Eski daginik fallback/helper mantigina geri donulmaz.
- Source-only pilot ile yeni seed katmani Groq harcamadan olculebilir.
- Problemli seed'ler tekrar tekrar Groq token yakmaz.
- Kategori verisi facts tablosunda korunur.

## Notlar

- Ilk production icin DB registry sart degil; kod tabanli seed + audit yeterli olabilir.
- 1500 fact hedefi icin seed genisletme surekli olacak, bu yuzden cooldown mekanizmasi onemli.
