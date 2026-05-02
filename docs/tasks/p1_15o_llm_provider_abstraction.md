# P1-15o - Fact LLM Provider Abstraction

## Amac

Mevcut `convertToFact()` davranisini ve JSON output contract'ini bozmadan, Groq'a sabit bagli editorial conversion katmanini provider/model secilebilir hale getirmek.

Bu is refactor degil, kontrollu bir adapter dilimidir:

- Mevcut prompt aynen korunur.
- `convertToFact()` public imzasi korunur.
- Ilk production default yine `groq:llama-3.1-8b-instant` olur.
- Yeni provider'lar once dry-run/shadow ile dogrulanmadan insert akisina alinmaz.

## Mevcut Durum

Ana dosya:

- `packages/pipeline/src/lib/groq.js`

Su anda ayni dosyada birlikte duruyor:

- SmartScrolling fact prompt'u.
- Groq SDK client kurulumu.
- `model: 'llama-3.1-8b-instant'` sabiti.
- JSON object mode istegi.
- `failed_generation` repair davranisi.
- Retry nedeni ve quality-aware second pass.
- Groq rate limit algilama.

Bu yapi prompt contract'i acisindan iyi, ancak production oncesi rate/token limitleri icin tek provider'a bagimlilik yaratiyor.

## Kapsam

Yeni teknik katman:

- `packages/pipeline/src/lib/llm/index.js`
- `packages/pipeline/src/lib/llm/groq-provider.js`
- `packages/pipeline/src/lib/llm/json-recovery.js`
- `packages/pipeline/src/lib/llm/provider-config.js`

Ilk dilimde yalnizca Groq adapter'i eklenir. OpenAI/Gemini/Mistral adapter'lari bu task'ta zorunlu degildir; interface'i bozmadan sonradan eklenebilir olmalidir.

## Kapsam Disi

- Prompt'u yeniden yazmak.
- Quality gate'i gevsetmek.
- `facts` DB semasini degistirmek.
- Otomatik provider fallback'i production'a almak.
- Hardcoded eski fallback kaynak yapisina donmek.

## Onerilen Interface

```js
await requestFactJson({
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  systemPrompt,
  userPrompt,
  temperature: 0.35,
  maxTokens: 900,
  responseFormat: 'json_object',
  categoryHint,
});
```

Provider sonucu normalize edilmeli:

```js
{
  ok: true,
  json,
  rawText,
  usage: {
    inputTokens,
    outputTokens,
    totalTokens,
  },
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
}
```

Hata sonucu normalize edilmeli:

```js
{
  ok: false,
  retryable: true,
  reason: 'rate_limit',
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  retryAfterMs,
  originalError,
}
```

## Env ve CLI Karari

Ilk kabul edilen env isimleri:

- `FACT_LLM_PRIMARY=groq:llama-3.1-8b-instant`
- `FACT_LLM_FALLBACKS=`
- `FACT_LLM_SHADOW=`

Runner override daha sonra eklenebilir:

- `--llm groq:openai/gpt-oss-20b`
- `--llm-shadow openai:gpt-4o-mini`

## Uygulama Plani

- [ ] `requestFactJson()` icindeki Groq SDK cagrisi adapter'a tasinacak.
- [ ] `convertToFact()` icinde prompt, retry ve payload normalization aynen kalacak.
- [ ] `failed_generation` repair davranisi provider-agnostic `json-recovery` katmanina alinacak.
- [ ] Groq rate limit algisi provider-normalized hata formatina cevrilecek.
- [ ] Default model env yoksa bugunku model olacak.
- [ ] Dry-run scriptleri yeni env model secimini kullanabilecek.
- [ ] Usage/token bilgisi varsa loglanacak, yoksa null gecilecek.

## Kabul Kriterleri

- `GROQ_API_KEY` disinda yeni secret olmadan mevcut pipeline eskisi gibi calisir.
- `convertToFact()` ciktisi degismez.
- Mevcut `run-all` ve `test:wikipedia-groq` davranisi default durumda ayni kalir.
- `FACT_LLM_PRIMARY=groq:openai/gpt-oss-20b` ile ayni prompt farkli Groq modeliyle calistirilabilir.
- Rate limit durumunda mevcut `_conversion_failed: true, _conversion_reason: 'rate_limit'` davranisi korunur.

## Riskler

- Erken genisletilen interface gereksiz soyutlama yaratabilir; bu yuzden ilk adapter sadece Groq olmali.
- Provider usage formatlari farkli oldugu icin cost logu null-safe tasarlanmali.
- JSON repair provider'a tasinirsa prompt contract'i sessizce degismemeli.

