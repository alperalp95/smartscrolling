# P3-21d - Mobile AI Quota UI

## Amac

AI chat limit durumlarini mobil tarafta kullaniciya sade ve dogru gostermek.

## Kapsam

- Kitap reader chat sheet.
- Free quota doldu mesajı + premium CTA.
- Premium/system limit doldu mesajı + sonra tekrar dene.

## Yapilacaklar

- [x] `ai-chat` response kodlarini mobil helper'da normalize et.
- [x] `quota_exceeded` icin free kullaniciya premium yonlendirmesi goster.
- [x] Premium kullanicida quota dolarsa "bugunluk AI limitine ulastin" mesaji goster.
- [x] `groq_rate_limited` icin gecici yogunluk mesaji goster.
- [x] Mevcut fallback chat davranisini bozmadan ilerle.

## Kabul Kriteri

- Limit dolumu sessiz hata gibi gorunmez.
- Free kullanici icin monetizasyon akisi anlasilir.
- Premium kullaniciya "satin al" yerine sistem/bugunluk limit dili kullanilir.

## Notlar

- Yeni ekran yok.
- Mevcut chat sheet ve premium prompt mekanizmasi kullanilir.

## Uygulama Notlari

- `fetchAiChat`, Edge Function hata body'lerinden `code`, `quota` ve `retryAfterSeconds` alanlarini normalize edip `AiChatRequestError` olarak firlatiyor.
- `useBookChat`, bilinen hata kodlarini kullanici mesajina ceviriyor; bilinmeyen hatalar eski genel fallback mesajiyla kaldi.
- Free quota doldugunda mevcut `promptForPremium` akisi aciliyor.
- Premium quota doldugunda satin alma CTA'i degil, bugunluk sistem limiti dili kullaniliyor.
- `groq_rate_limited`, Groq sistem yogunlugu olarak ayriliyor ve varsa `retryAfterSeconds` bilgisi mesaj diline yansitiliyor.

## Verification

- [x] `npm run typecheck`
- [x] `npx biome check apps/mobile/src/lib/aiChat.ts apps/mobile/src/lib/useBookChat.ts --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=20`
- [ ] `npx biome check apps/mobile/src/lib/aiChat.ts apps/mobile/src/lib/useBookChat.ts apps/mobile/app/book/[id].tsx --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=20`
  - Blokaj: `apps/mobile/app/book/[id].tsx` icinde task oncesinden gelen iki `useEffect` dependency uyarisi var (`activeSectionIndex`, `hasPremium`). Bu task kapsaminda davranis degistirmemek icin dokunulmadi.
