# P1-15p - LLM Shadow Benchmark ve Cost Audit

## Amac

Yeni LLM/provider adaylarini production insert akisina almadan once ayni source batch uzerinde olculebilir sekilde karsilastirmak.

Karar verilecek metrikler:

- JSON parse basari orani.
- Retry orani.
- `quality_rejected` ve `consistency_rejected` dagilimi.
- Source alignment basarisi.
- Turkce dogallik/editorial kalite.
- Ortalama latency.
- Tahmini token maliyeti.

## Mevcut Durum

Ilgili scriptler:

- `packages/pipeline/src/runners/test-wikipedia-groq-dry-run.js`
- `packages/pipeline/src/runners/test-wikipedia-shadow.js`
- `packages/pipeline/src/runners/review-wikipedia-candidates.js`

Bugunku dry-run scripti Groq'a sabit bagli ve model/provider karsilastirma raporu uretmiyor.

## Kapsam

Yeni veya genisletilecek script:

- `packages/pipeline/src/runners/test-fact-llm-shadow.js`

Script davranisi:

- Wikipedia veya fixture kaynak batch'i alir.
- Bir primary model ve bir veya daha fazla shadow model calistirir.
- DB insert yapmaz.
- Her aday icin normalized audit kaydi basar.
- Ozet metrikleri run sonunda gosterir.

## Kapsam Disi

- Production fallback'i aktif etmek.
- Kayitlari Supabase'e insert etmek.
- Prompt'u modele gore ozellestirmek.
- Human review UI yapmak.

## Onerilen Komutlar

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-shadow -- --source wikipedia --lang tr --count 10 --models groq:llama-3.1-8b-instant,groq:openai/gpt-oss-20b
```

Sonraki adaylar:

```bash
--models groq:llama-3.1-8b-instant,gemini:gemini-2.5-flash-lite,openai:gpt-4o-mini
```

## Rapor Formati

Run sonunda en az su alanlar olmali:

- `total_candidates`
- `generated`
- `json_failed`
- `repair_used`
- `retry_used`
- `quality_rejected_by_reason`
- `consistency_rejected_by_reason`
- `rate_limited`
- `avg_latency_ms`
- `input_tokens`
- `output_tokens`
- `estimated_cost_usd`

Model bazli satir:

```json
{
  "providerModel": "groq:openai/gpt-oss-20b",
  "generated": 9,
  "qualityRejected": 2,
  "consistencyRejected": 1,
  "retryRate": 0.22,
  "estimatedCostUsd": 0.004,
  "notes": ["good_json", "slightly_long_titles"]
}
```

## Ilk Benchmark Matrisi

- Baseline: `groq:llama-3.1-8b-instant`
- Groq fallback: `groq:openai/gpt-oss-20b`
- Groq quality fallback: `groq:openai/gpt-oss-120b`
- External cost fallback: `gemini:gemini-2.5-flash-lite`
- External quality fallback: `openai:gpt-4o-mini`
- Optional EU/provider diversity: `mistral:mistral-small-latest`

## Uygulama Plani

- [ ] Shadow script icin arg parser ekle.
- [ ] Mevcut `fetchWikipediaArticles()` ile source batch sec.
- [ ] `convertToFact()` icine model override gecmenin minimal yolunu tasarla.
- [ ] DB insert yerine `evaluateFactQuality()` ve `evaluateFactConsistency()` lokal calistir.
- [ ] Usage varsa cost hesapla; yoksa model pricing config ile tahmini hesapla.
- [ ] JSONL veya stdout audit formati belirle.
- [ ] 10 kartlik ve 50 kartlik iki benchmark standardi dokumante et.

## Kabul Kriterleri

- Shadow run production DB'ye dokunmaz.
- Ayni source batch'te en az iki model karsilastirilir.
- Baseline Groq 8B ile yeni aday arasinda karar verilebilir metrik cikar.
- Cost tahmini official pricing config'e dayali ve tarihli notla loglanir.
- Rate limit gorulurse model bazli gorunur.

## Riskler

- Tek batch editorial kalite icin yeterli olmayabilir; en az bilim/tarih/felsefe/teknoloji/saglik dagilimi gerekir.
- Turkce kaliteyi sadece otomatik gate ile olcmek yetersizdir; kucuk human review notu gerekebilir.
- Provider fiyatlari degisebilir; pricing config release oncesi manuel dogrulanmalidir.

