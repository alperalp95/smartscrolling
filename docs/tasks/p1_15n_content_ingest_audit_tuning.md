# P1-15n - Content Ingest Audit ve Tuning Loop

## Amac

Gunluk ve haftalik content ingest kosularindan ogrenilebilir audit ciktisi uretmek. Bu cikti prompt, quality guard, seed policy ve maliyet limitlerini tuning etmek icin kullanilir.

## Kapsam

Ana hedef dosyalar:

- `packages/pipeline/src/runners/run-all.js`
- `packages/pipeline/src/runners/review-wikipedia-candidates.js`
- `packages/pipeline/src/runners/test-wikipedia-groq-dry-run.js`
- `packages/pipeline/src/lib/groq.js`
- `packages/pipeline/src/lib/quality-policy.js`
- `packages/pipeline/src/lib/wiki-quality-guard.js`
- `packages/pipeline/src/lib/wiki-source-policy.js`

## Kapsam Disi

- Quality guard'lari gevsetmek.
- Groq uretimini insan review'u olmadan buyuk batchlerle serbest birakmak.
- Production DB'de category alanini kaldirmak.
- Admin CMS yapmak.

## Uygulama Plani

- [ ] Run summary'yi daha karar verilebilir hale getir.
  - saved
  - duplicate_source_url
  - duplicate_recent_topic
  - quality_rejected reason dagilimi
  - consistency_rejected reason dagilimi
  - groq_failed reason dagilimi
  - rate_limit goruldu mu

- [ ] Groq retry nedenlerini ozetle.
  - short_content
  - invalid_title
  - title_alignment
  - source_alignment
  - rate_limit

- [ ] Seed performans ozetini ekle.
  - source title
  - category hint
  - normalized taxonomy
  - saved/rejected/duplicate status

- [ ] Haftalik tuning checklist'i dokumante et.
  - En cok reject eden baslik kaliplari quality-policy'ye eklenmeli mi?
  - Prompt yeni zayif kalibi yasaklamali mi?
  - Hangi seedler cooldown'a alinmali?
  - Hangi seed aileleri genisletilmeli?
  - Groq retry threshold maliyet/kalite dengesi dogru mu?

- [ ] Dry-run kalite komutlarini standartlastir.
  - Source-only Wikipedia pilot.
  - Groq dry-run kucuk batch.
  - `npm run typecheck`.
  - `npm run facts:report`.

- [ ] Audit ciktisini dosyaya yazma opsiyonunu degerlendir.
  - Ornek: `packages/pipeline/reports/ingest-YYYY-MM-DD.json`.
  - Secret veya raw token bilgisi yazilmaz.

## Kabul Kriterleri

- Gunluk job sonunda sadece "kac kayit geldi" degil, neden kayit gelmedigi de gorulur.
- Haftalik 100 hedefi kacarsa hangi sinirin etkili oldugu anlasilir.
- Groq maliyeti ve rate limit davranisi goze carpar.
- Tuning kararlarina kaynak olacak reject pattern'leri gorunur.
- Kucuk pilot/test kosulari buyuk run-all yerine tercih edilir.

## Notlar

- Audit, urun karari ile veri politikasini ayirmali: kategori DB'de kalir, feed'de gosterim ayri karardir.
- Review loop production disinda baslar; ileride admin/editor yuzeyine tasinabilir.
