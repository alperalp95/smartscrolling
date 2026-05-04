# P1-15q - Groq Free-Tier Production Fallback ve Limit Guard

## Amac

Gunluk/haftalik fact uretiminde Groq free-tier rate/token limitine takilinca job'un kirilmadan, kontrollu sekilde diger allowlist Groq modellerini denemesini saglamak.

Bu task para harcamayi acmaz. External provider eklemez. Kalite hatalarini pahali veya baska modele paslayarak maskelemez.

## On Kosullar

Bu task baslamadan once:

- P1-15o ile Groq model resolver tamamlanmis olmali.
- P1-15p ile 8B, GPT-OSS 20B ve Qwen 32B icin kucuk fixture benchmark'i calismis olmali.
- En az bir 3-5'lik live Wikipedia pilotunda fallback adaylarinin editorial kalitesi manuel kontrol edilmis olmali.

## Varsayilan Strateji

Primary:

- `groq:llama-3.1-8b-instant`

Fallback sirasi:

- `groq:openai/gpt-oss-20b`
- `groq:qwen/qwen3-32b`

Run cap:

- `FACT_LLM_MAX_FALLBACKS_PER_RUN=5`

Fallback sadece altyapi kaynakli hatalarda calisir:

- `rate_limit`
- `timeout`
- `provider_5xx`
- `temporary_unavailable`

Fallback calismamali:

- `quality_rejected`
- `consistency_rejected`
- `source_alignment`
- `invalid_title`
- `low_value_source_topic`
- `taxonomy_or_source_drift`

## Kapsam

- `FACT_LLM_FALLBACKS` parser'i ekle.
- `FACT_LLM_MAX_FALLBACKS_PER_RUN` guard'i ekle.
- Runner CLI icin `--max-fallbacks` destekle.
- Item-level fallback denemesini sadece retryable provider hatalarinda yap.
- Run summary'ye fallback sayisi, model ve neden bilgisini ekle.
- Tum modeller limitlenirse run'i temiz sekilde durdur.

## Kapsam Disi

- Paid billing acmak.
- Gemini/OpenAI/Mistral external fallback eklemek.
- Sinirsiz retry.
- Kalite reject'lerinde otomatik daha buyuk modele gecmek.
- DB semasini degistirmek.
- Category verisini DB'den kaldirmak veya ranking/FTUE varsayimlarini degistirmek.

## Env ve CLI

Varsayilan env:

```bash
FACT_LLM_PRIMARY=groq:llama-3.1-8b-instant
FACT_LLM_FALLBACKS=groq:openai/gpt-oss-20b,groq:qwen/qwen3-32b
FACT_LLM_MAX_FALLBACKS_PER_RUN=5
FACT_LLM_STOP_ON_RATE_LIMIT=1
```

Runner override:

```bash
--llm groq:llama-3.1-8b-instant
--llm-fallbacks groq:openai/gpt-oss-20b,groq:qwen/qwen3-32b
--max-fallbacks 5
```

## Runner Davranisi

Beklenen akis:

1. Item primary model ile denenir.
2. Primary `rate_limit`, `timeout`, `provider_5xx` veya `temporary_unavailable` verirse fallback sirasi denenir.
3. Fallback basarili olursa normal quality/consistency guard devam eder.
4. Fallback da kalite reject olursa baska modele gecilmez; reject nedeni korunur.
5. Run-level fallback cap dolarsa temiz ozetle durulur.
6. Tum allowlist modeller limitlenirse run `rate_limit_stopped` ozetiyle biter.

## Run Summary

Run sonunda en az su bilgiler gorunmeli:

- `primary_model`
- `fallback_models`
- `fallback_attempted`
- `fallback_succeeded`
- `fallback_stopped_by_cap`
- `rate_limited_by_model`
- `timeout_by_model`
- `generated_by_model`
- `quality_rejected_by_model`
- `stop_reason`

Ornek:

```json
{
  "primaryModel": "groq:llama-3.1-8b-instant",
  "fallbackModels": ["groq:openai/gpt-oss-20b", "groq:qwen/qwen3-32b"],
  "fallbackAttempted": 4,
  "fallbackSucceeded": 3,
  "fallbackStoppedByCap": false,
  "rateLimitedByModel": {
    "groq:llama-3.1-8b-instant": 4
  },
  "generatedByModel": {
    "groq:openai/gpt-oss-20b": 2,
    "groq:qwen/qwen3-32b": 1
  },
  "stopReason": null
}
```

## Uygulama Plani

- [ ] P1-15p benchmark sonucuna gore fallback allowlist'i tekrar onayla.
- [ ] `FACT_LLM_FALLBACKS` ve `--llm-fallbacks` parser'ini ekle.
- [ ] `convertToFact()` veya runner seviyesinde en kucuk fallback noktasini sec.
- [ ] Fallback'i sadece retryable provider error sonucuna bagla.
- [ ] Run-level fallback counter ve cap ekle.
- [ ] Summary/audit output'unu runner sonunda gorunur yap.
- [ ] 1 primary + 1 fallback simule test ekle.

## Kabul Kriterleri

- Env verilmeden bugunku tek-model davranis korunur.
- Primary rate limit oldugunda fallback sirasi denenir.
- Fallback sadece retryable provider hatalarinda calisir.
- Quality/source/taxonomy reject'leri fallback ile maskelenmez.
- `maxFallbacks=5` dolunca run temiz sekilde durur.
- Tum modeller free-tier limitine takilirsa para harcanmadan durulur.
- `npm run typecheck` gecer.

## Test Plani

No-token:

```bash
npm run typecheck
```

Simulasyon:

```bash
npm --workspace @smartscrolling/pipeline run test:fact-llm-fallback -- --simulate-rate-limit --max-fallbacks 1
```

Kucuk live pilot:

```bash
npm run test:wikipedia-groq -- --lang tr --count 3 --llm groq:llama-3.1-8b-instant --llm-fallbacks groq:openai/gpt-oss-20b --max-fallbacks 2
```

Production batch'e gecmeden once 3-5 kayit DB'de manuel kontrol edilmeli.

## Riskler

- Free-tier limitleri model bazli gorunse de Groq org/project tarafinda ortak limitler olabilir; fallback bunu tamamen cozmez, sadece bazi darbogazlari azaltir.
- Fallback ile uretilen kartlar model bazli style drift yaratabilir; shadow benchmark ve manuel DB kontrolu sart.
- Retry/fallback fazla genis tutulursa token limitini hizli tuketir; cap dusuk tutulacak.
