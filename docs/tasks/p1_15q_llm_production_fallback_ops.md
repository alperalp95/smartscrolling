# P1-15q - LLM Production Fallback ve Budget Guard

## Amac

Gunluk/haftalik fact uretiminde Groq rate/token limitine takilinca job'un kirilmadan, kontrollu ve butce siniri icinde devam edebilmesini saglamak.

Bu task, P1-15o provider abstraction ve P1-15p shadow benchmark tamamlanmadan baslamamalidir.

## Varsayilan Strateji

Production default:

- Primary: `groq:llama-3.1-8b-instant`
- First fallback: `groq:openai/gpt-oss-20b`
- External fallback: karar bekliyor

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

## Kapsam

Ilgili dosyalar:

- `packages/pipeline/src/lib/groq.js`
- `packages/pipeline/src/lib/llm/*`
- `packages/pipeline/src/runners/run-all.js`
- `packages/pipeline/src/runners/test-fact-llm-shadow.js`
- `packages/pipeline/package.json`

## Kapsam Disi

- Sinirsiz retry.
- Her kalite hatasinda pahali modele gecmek.
- Free tier limitlerini production guarantee gibi kullanmak.
- Kaynak/prompt politikasini gevsetmek.

## Budget Guard

Onerilen env:

- `FACT_LLM_DAILY_BUDGET_USD=1`
- `FACT_LLM_MONTHLY_BUDGET_USD=10`
- `FACT_LLM_MAX_FALLBACKS_PER_RUN=10`
- `FACT_LLM_STOP_ON_BUDGET=1`

Run summary'de gorunmeli:

- Provider/model bazli token.
- Provider/model bazli estimated cost.
- Fallback kac kez calisti.
- Fallback nedenleri.
- Budget stop oldu mu.

## Runner Davranisi

Daily ingest ile uyumlu olmali:

- `--target-saved`
- `--max-candidates`
- `--max-groq`
- `--stop-on-rate-limit`
- `--max-fallbacks`
- `--daily-budget-usd`

Rate limitte davranis:

1. Primary rate limited ise ayni item icin first fallback denenir.
2. Fallback yoksa mevcut davranis gibi temiz durulur.
3. Rate limit storm olursa run fail degil, `rate_limit_stopped` ozetiyle biter.
4. Cron retry firtinasi olusturmamak icin exit code karari ayrica netlestirilir.

## Uygulama Plani

- [ ] Provider fallback config parser ekle.
- [ ] Normalized provider hata nedenlerini runner summary'ye tasi.
- [ ] `convertToFact()` icinde altyapi hatalari icin fallback deneme noktasi ekle.
- [ ] Fallback denemelerini item-level max ile sinirla.
- [ ] Run-level `maxFallbacks` ve `dailyBudgetUsd` guard ekle.
- [ ] Production alias ekle: `facts:wikipedia-daily`.
- [ ] Fallback kullanildiginda fact metadata'sini DB'ye yazmadan once logla; DB semasi degismedigi surece internal field insert payload'a girmesin.

## Kabul Kriterleri

- Primary provider rate limit oldugunda run tamamen kaybolmaz.
- Fallback sadece retryable provider hatalarinda calisir.
- Gunluk job tahmini butceyi asmaz.
- Run sonunda cost ve fallback nedenleri gorunur.
- Default env ile bugunku tek-Groq davranisi korunur.

## Karar Bekleyenler

- External fallback Gemini mi OpenAI mi olacak?
- Ucretli billing acilacak mi, yoksa fallback sadece manual/dry-run mi kalacak?
- Production'da fallback ile uretilen kartlar otomatik insert edilecek mi, yoksa once review mode'a mi alinacak?
- Aylik butce hedefi kac USD olacak?

