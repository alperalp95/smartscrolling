# P3-21b - AI Chat Edge Quota Gate

## Amac

`supabase/functions/ai-chat/index.ts` icinde Groq cagrisi oncesine Redis tabanli gunluk quota kontrolu eklemek.

## Kapsam

- Sadece `ai-chat` Edge Function.
- `ai-definition` bu slice'ta rate limit kapsaminda degil.
- Basit gunluk increment + TTL modeli.

## Yapilacaklar

- [x] `ai-chat` request icinden user id ve premium durumunu okuyacak kucuk helper ekle.
- [x] Redis REST helper'i ekle:
  - current count oku
  - limit dolmadiysa increment et
  - ilk increment'te TTL ata
- [x] Limit doldugunda Groq cagrisi yapmadan response don.
- [x] Redis unavailable davranisini `P1-10a` kararina gore uygula.
- [x] Log'larda secret veya kullanici PII yazma.

## Uygulama Notlari

- Quota gate `supabase/functions/ai-chat/index.ts` icine eklendi.
- Redis REST komutlari dependency eklemeden native `fetch` ile cagriliyor.
- Gunluk sayaç:
  - `INCR ai_chat_quota:{yyyy-mm-dd}:{user_id}`
  - Ilk sayacta `EXPIRE` bir sonraki UTC gece yarisi + 300 saniye buffer
- Limit asildiginda Groq cagrisi yapilmadan `429 quota_exceeded` doner.
- Redis URL/token eksikse veya REST komutu basarisizsa fail-closed davranis ile `503 quota_unavailable` doner.
- Premium tier client payload'indan okunmaz.
- Server-side premium tespiti icin yalnizca Supabase Auth `app_metadata` icindeki trusted isaretler kullanilir:
  - `premium: true`
  - `entitlement: "premium"`
  - `entitlements: ["premium"]`
- RevenueCat server-side entitlement sync henuz yoksa kullanicilar guvenli varsayilan olarak free tier limitine tabi olur.
- Bu task Groq `429` handling'i iyilestirmedi; o is `P3-21c` kapsaminda.
- Bu task mobil UI mesajlarini iyilestirmedi; o is `P3-21d` kapsaminda.

## Kabul Kriteri

- [x] Free kullanici 5. sorudan sonra limit response alir.
- [x] Premium kullanici 50. sorudan sonra limit response alir.
- [x] Limit doldugunda Groq token harcanmaz.

## Verification

- [x] `npm run check:edge-functions`
- [x] `npm run typecheck`
- [x] `npx biome check supabase/functions/ai-chat/index.ts --formatter-enabled=false --organize-imports-enabled=false --max-diagnostics=20`
- [ ] `deno check` calistirilmadi; bu makinede `deno` PATH'te yok.

## Notlar

- Atomic davranis icin Upstash REST komutlari yeterli tutulacak.
- Bu task'ta dashboard, analytics veya admin panel yok.
- Quota basarili Groq cevabini degil, kabul edilen AI chat denemesini sayar. Groq hata durumunda sayaci geri almak bu slice'ta bilincli olarak eklenmedi.
