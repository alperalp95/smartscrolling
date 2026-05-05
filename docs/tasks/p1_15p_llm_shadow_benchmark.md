# P1-15p - Groq Model Shadow Benchmark ve Fixture Audit

## Kapanis Notu - 2026-05-05

Durum: kismen tamamlandi, fixture kismi release sonrasi veya paid-tier kararindan sonra.

Uygulananlar:

- `packages/pipeline/src/runners/test-fact-llm-shadow.js` eklendi.
- Live Wikipedia adaylari uzerinde 8B, GPT-OSS 20B ve Qwen 32B karsilastirildi.
- DB insert kapali tutuldu; kalite, consistency ve conversion failure nedenleri audit edildi.

Sonuc:

- `groq:llama-3.1-8b-instant` en stabil model.
- `groq:openai/gpt-oss-20b` JSON validation hatasina dustu.
- `groq:qwen/qwen3-32b` bazi iyi cevaplar uretti ama yavas ve retry/JSON tarafinda kirilgan.
- Diger Groq modelleri su an release production kapasitesine pratik katki saglamadi.

Karar:

- Shadow runner repo'da kalsin; gereksiz kod degil, ileride prompt/model denemeleri icin audit araci.
- Sabit JSONL fixture simdilik ertelendi. Asil release yolu 8B + kucuk batch + kalite tuning + PDF curated.

## Amac

Groq icindeki aday modelleri production insert akisina almadan once ayni sabit kaynak batch'i uzerinde karsilastirmak.

Bu task'in hedefi "hangi model daha havali" sorusu degil; SmartScrolling fact kalitesi icin hangi Groq modellerinin release oncesi guvenli fallback/override adayi oldugunu olcmektir.

## Karar Metrikleri

- JSON parse basari orani.
- Retry/repair orani.
- `quality_rejected` dagilimi.
- `consistency_rejected` ve source alignment sorunlari.
- Turkce baslik/govde dogalligi.
- Merak uyandirici Wikipedia dolasimi hedefine uyum.
- Ortalama latency.
- Token kullanimi.
- Rate limit/timeout gorunurlugu.

## Mevcut Durum

Ilgili scriptler:

- `packages/pipeline/src/runners/test-wikipedia-groq-dry-run.js`
- `packages/pipeline/src/runners/test-wikipedia-shadow.js`
- `packages/pipeline/src/runners/review-wikipedia-candidates.js`

Bugunku dry-run akisinda model karsilastirmasi ve sabit fixture uzerinden adil benchmark yeterince gorunur degil.

## Kapsam

- Sabit JSONL fixture ile ayni Wikipedia adaylarini farkli Groq modellerinde calistir.
- DB insert yapma.
- Model bazli audit ozeti bas.
- Run sonunda kalite/reject/rate-limit nedenlerini okunur hale getir.
- Ilk model matrisi sadece Groq allowlist ile sinirli kalsin.

## Kapsam Disi

- Production fallback'i aktif etmek.
- Kayitlari Supabase'e insert etmek.
- Prompt'u modele gore ozellestirmek.
- External provider maliyet benchmark'i yapmak.
- Human review UI yapmak.

## Model Matrisi

Baseline:

- `groq:llama-3.1-8b-instant`

Benchmark adaylari:

- `groq:openai/gpt-oss-20b`
- `groq:qwen/qwen3-32b`

V1 disi:

- `groq:openai/gpt-oss-120b`
- Gemini/OpenAI/Mistral external modeller

## Fixture Yaklasimi

Adil benchmark icin kaynak batch sabitlenmeli:

- Ornek fixture: `packages/pipeline/fixtures/llm-shadow/wikipedia-tr-10.jsonl`
- Her satir tek Wikipedia adayini temsil eder.
- Fixture DB insert sonucu degil, source/enrichment sonrasi conversion oncesi aday payload'i olmali.
- Fixture dosyasi kucuk tutulmali; ilk standart 10 aday.

10'luk fixture'da mumkunse karisik konu profili olsun:

- bilim/cevre
- tarih
- teknoloji
- biyografi
- sanat/kultur

Kategori esitleme hedef degil; burada amac model davranisini farkli metin tiplerinde gormek.

## Onerilen Komutlar

Fixture ile benchmark:

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-shadow -- --fixture packages/pipeline/fixtures/llm-shadow/wikipedia-tr-10.jsonl --models groq:llama-3.1-8b-instant,groq:openai/gpt-oss-20b,groq:qwen/qwen3-32b
```

Kucuk live pilot:

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-shadow -- --source wikipedia --lang tr --count 3 --models groq:llama-3.1-8b-instant,groq:openai/gpt-oss-20b
```

## Rapor Formati

Run sonunda en az su alanlar olmali:

- `fixture`
- `models`
- `total_candidates`
- `generated`
- `json_failed`
- `repair_used`
- `retry_used`
- `quality_rejected_by_reason`
- `consistency_rejected_by_reason`
- `rate_limited`
- `timeout`
- `avg_latency_ms`
- `input_tokens`
- `output_tokens`

Model bazli satir ornegi:

```json
{
  "providerModel": "groq:openai/gpt-oss-20b",
  "totalCandidates": 10,
  "generated": 8,
  "qualityRejected": 1,
  "consistencyRejected": 1,
  "jsonFailed": 0,
  "rateLimited": 0,
  "avgLatencyMs": 1240,
  "notes": ["good_json", "title_style_ok"]
}
```

Reject audit ornegi:

```json
{
  "title": "Marmara Denizi deniz salyasi felaketi",
  "providerModel": "groq:qwen/qwen3-32b",
  "accepted": false,
  "rejectReason": "taxonomy_or_source_drift",
  "policyHint": "science_environment_or_reject"
}
```

## Uygulama Plani

- [ ] P1-15o model resolver tamamlandiktan sonra shadow runner'i ona bagla.
- [ ] `--fixture` ve `--models` argumanlarini ekle.
- [ ] DB insert yolunu kapali tut; sadece local audit calissin.
- [ ] `evaluateFactQuality()` ve consistency/source alignment kontrollerini benchmark raporuna dahil et.
- [ ] JSONL audit output opsiyonu ekle, ama stdout ozeti okunur kalsin.
- [ ] 3'luk live pilot ve 10'luk fixture benchmark standardini dokumante et.

## Kabul Kriterleri

- Shadow run production DB'ye dokunmaz.
- Ayni fixture'da en az iki Groq modeli karsilastirilir.
- Baseline 8B ile 20B/Qwen arasinda karar verilebilir metrik cikar.
- Rate limit, timeout ve reject nedenleri model bazli gorunur.
- Groq token harcamasi 10'luk fixture ile sinirli tutulabilir.

## Test Plani

Once no-token:

```bash
npm run typecheck
```

Sonra kucuk tokenli smoke:

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-shadow -- --fixture packages/pipeline/fixtures/llm-shadow/wikipedia-tr-10.jsonl --models groq:llama-3.1-8b-instant --limit 1
```

Ardindan 2 model x 3 aday:

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-shadow -- --fixture packages/pipeline/fixtures/llm-shadow/wikipedia-tr-10.jsonl --models groq:llama-3.1-8b-instant,groq:openai/gpt-oss-20b --limit 3
```

## Riskler

- Tek fixture editorial kalite icin yeterli degildir; release oncesi 3-5 farkli kucuk batch ile kontrol gerekir.
- Free-tier limitler benchmark'i yarida kesebilir; bu durum basarisizlik degil audit verisi olarak loglanmali.
- Model farklarini kalite artisi gibi okumamak gerekir; source policy ve quality guard gevsetilmeyecek.
