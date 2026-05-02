# P3-21c - Groq 429 Handling

## Amac

Groq organizasyon/model limitine takilinca kullaniciya kontrollu ve anlasilir hata donmek.

## Kapsam

- `ai-chat` Edge Function Groq response handling.
- `retry-after` header'i varsa response'a guvenli sekilde yansitma.
- Mobil UI icin ayrik hata kodu.

## Yapilacaklar

- [x] Groq `429` status kontrolunu ayri case olarak ele al.
- [x] `retry-after` header'ini parse et.
- [x] Response body icinde `code: "groq_rate_limited"` don.
- [x] Kullaniciya secret, provider error veya ham stack trace siza riskini engelle.
- [x] Non-429 Groq hatalarini mevcut fallback davranisini bozmadan koru.

## Uygulama Notlari

- `supabase/functions/ai-chat/index.ts` icinde Groq response `status === 429` ayri case olarak ele alindi.
- `retry-after` header'i saniye veya HTTP date formatinda parse edilir.
- Parse edilen deger response'a `retryAfterSeconds` olarak eklenir.
- Parse edilemeyen header durumunda `retryAfterSeconds` alanı gonderilmez.
- Provider'in ham error body' si kullaniciya dondurulmez.
- Non-429 Groq hatalari mevcut `502 Groq request failed` davranisini korur.

## Kabul Kriteri

- [x] Groq 429 olursa app crash etmez.
- [x] Kullanici "biraz sonra tekrar dene" mesajini gorebilir.
- [x] Free/premium quota dolmasi ile Groq sistem limitinin response kodlari ayridir.

## Verification

- [x] `npm run check:edge-functions`
- [x] `npm run typecheck`
- [x] `npx biome check supabase/functions/ai-chat/index.ts --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=20`

## Notlar

- Retry/backoff loop eklenmeyecek; mobil kullanici yeniden denemeyi manuel yapar.
- Request queue bu task kapsaminda degil.
- Groq docs'a gore rate limit asiminda API `429 Too Many Requests` doner ve `retry-after` header'i yalnizca 429 durumunda set edilir.
