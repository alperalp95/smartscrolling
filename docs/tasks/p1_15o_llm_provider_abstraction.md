# P1-15o - Groq Multi-Model Resolver

## Kapanis Notu - 2026-05-05

Durum: tamamlandi.

Uygulananlar:

- `packages/pipeline/src/lib/llm-model-policy.js` ile Groq model resolver eklendi.
- Default production modeli `groq:llama-3.1-8b-instant` olarak korundu.
- `test:wikipedia-groq` runner'i `--llm` override alabilir hale geldi.
- Unsupported model id'leri Groq'a istek atmadan erken reddediliyor.
- Groq client import aninda degil, ilk gercek request'te olusuyor.

Karar:

- 8B model production primary olarak kalacak.
- `groq:openai/gpt-oss-20b` ve `groq:qwen/qwen3-32b` production fallback degil, sadece dry-run/benchmark adayi olarak tutulacak.
- Bu task token limit darbogazini cozmedi; sadece model secimini ve audit edilebilir denemeyi guvenli hale getirdi.

## Amac

Mevcut `convertToFact()` davranisini, prompt'unu ve JSON output contract'ini bozmadan Groq icindeki iyi aday modelleri secilebilir hale getirmek.

Bu task tam provider abstraction degildir. Ilk release hedefi Groq disina cikmadan free-tier limit darboazini azaltmaktir.

Korunacaklar:

- `convertToFact()` public imzasi ve default davranisi.
- Mevcut SmartScrolling editorial prompt'u.
- Quality guard, consistency/source alignment ve Turkce editorial kalite kurallari.
- DB insert payload contract'i.
- Mevcut Groq rate limit sonucu: `_conversion_failed: true`, `_conversion_reason: 'rate_limit'`.

## Mevcut Durum

Ana dosya:

- `packages/pipeline/src/lib/groq.js`

Su anda model sabit:

- `llama-3.1-8b-instant`

Bu model production icin hizli ve ucuz baseline olmaya devam edecek, ancak free-tier limitlerinde ayni Groq projesindeki diger iyi modelleri kontrollu sekilde kullanabilmemiz gerekiyor.

## Ilk Allowlist

Ilk implementasyonda yalnizca su model id'leri kabul edilir:

- `groq:llama-3.1-8b-instant`
- `groq:openai/gpt-oss-20b`
- `groq:qwen/qwen3-32b`

V1 disinda kalanlar:

- `groq:openai/gpt-oss-120b`
- Gemini, OpenAI API, Mistral veya baska external provider'lar

120B modeli ileride kalite benchmark'i icin ayrica degerlendirilebilir, ancak release oncesi fallback havuzuna alinmayacak.

## Kapsam

- Groq model id parser/resolver ekle.
- Env ve CLI ile primary model override destekle.
- Bilinmeyen veya allowlist disi model id'lerini erken hata ile durdur.
- `groq.js` icindeki hardcoded model secimini resolver'dan gelen modelle degistir.
- Log/audit icin provider/model bilgisini normalize et.
- DB semasi veya insert payload'ina yeni field ekleme.

## Kapsam Disi

- Prompt'u yeniden yazmak.
- Quality gate'i gevsetmek.
- Production fallback'i bu task'ta aktif etmek.
- Eski hardcoded source fallback mantigina donmek.
- External provider adapter'i yazmak.
- Cost/billing sistemi kurmak.

## Env ve CLI

Varsayilan:

```bash
FACT_LLM_PRIMARY=groq:llama-3.1-8b-instant
```

Runner override:

```bash
--llm groq:openai/gpt-oss-20b
```

Gelecek task'larda kullanilacak ama burada sadece parse edilebilir kalabilir:

```bash
FACT_LLM_SHADOW=groq:openai/gpt-oss-20b,groq:qwen/qwen3-32b
FACT_LLM_FALLBACKS=groq:openai/gpt-oss-20b,groq:qwen/qwen3-32b
```

## Onerilen Kucuk Interface

Buyuk soyutlama yerine kucuk bir resolver yeterli:

```js
resolveFactLlmModel(value)
```

Ornek sonuc:

```js
{
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  providerModel: 'groq:llama-3.1-8b-instant'
}
```

## Uygulama Plani

- [ ] Mevcut import/typecheck durumunu tekrar dogrula.
- [ ] `packages/pipeline/src/lib/llm-model-policy.js` veya benzer kucuk bir resolver dosyasi ekle.
- [ ] Allowlist'i merkezi tut; runner'lara duplicate seed/model listesi dagitma.
- [ ] `groq.js` icindeki `model: 'llama-3.1-8b-instant'` sabitini resolver sonucu ile degistir.
- [ ] `test-wikipedia-groq-dry-run.js` ve ilgili kucuk runner'lara `--llm` parametresi ekle.
- [ ] Unknown model icin Groq call yapmadan temiz hata ver.
- [ ] Usage/token bilgisi varsa logla; yoksa null-safe gec.

## Kabul Kriterleri

- Env/CLI verilmeden pipeline bugunku gibi `llama-3.1-8b-instant` ile calisir.
- `--llm groq:openai/gpt-oss-20b` ile kucuk dry-run calisir.
- `--llm groq:qwen/qwen3-32b` ile kucuk dry-run calisir.
- Allowlist disi model id Groq'a istek atmadan reddedilir.
- `npm run typecheck` gecer.
- Quality guard ve source policy davranisi degismez.

## Test Plani

Kucuk sirayla:

```bash
node -e "import('./packages/pipeline/src/lib/groq.js').then(() => console.log('ok'))"
npm run typecheck
npm run test:wikipedia-groq -- --lang tr --count 1 --llm groq:llama-3.1-8b-instant
npm run test:wikipedia-groq -- --lang tr --count 1 --llm groq:openai/gpt-oss-20b
```

Groq token harcamasi dusuk tutulmali; once import/typecheck, sonra 1'lik smoke.

## Riskler

- Model secimi prompt davranisini sessizce degistirebilir; bu yuzden ilk asamada prompt modele gore ozellestirilmeyecek.
- Free-tier limitleri production garantisi degildir; bu task sadece kapasite dagitimi icin zemin hazirlar.
- Fazla erken provider abstraction overengineering yaratir; external provider isi ayri task olarak kalmali.
