# P1-10a - Upstash Redis Foundation

## Amac

AI chat rate limit icin en kucuk gerekli Redis altyapisini tanimlamak.

## Kapsam

- Upstash Redis sadece kota/rate limit icin kullanilacak.
- Ilk slice'ta queue, cache, analytics veya session store eklenmeyecek.
- Secret/env isimleri ve runtime sorumlulugu netlestirilecek.

## Yapilacaklar

- [x] Gerekli env/secret isimlerini belirle:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [x] Local ve Supabase Edge Function secret kurulum notlarini yaz.
- [x] Redis key naming kararini sabitle:
  - `ai_chat_quota:{yyyy-mm-dd}:{user_id}`
- [x] Gunluk TTL politikasini netlestir.
- [x] Upstash baglantisi yoksa Edge Function'in fail-open mi fail-closed mu davranacagini sec.

## Kararlar

- Secret isimleri:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Bu secret'lar sadece server-side Supabase Edge Function runtime'inda okunur.
- Mobil `.env` veya `EXPO_PUBLIC_*` alanlarina Upstash bilgisi eklenmez.
- Pipeline `.env` dosyasina Upstash bilgisi eklenmez; pipeline bu slice'in parcasi degil.
- Local Edge Function calistirma icin repo disina cikmadan gitignored `.env` kullanilir.
- Remote Supabase icin CLI formati:

```powershell
npx supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
```

- Local function serve icin CLI formati:

```powershell
npx supabase functions serve --env-file .env
```

## Redis Key Modeli

- Gunluk kota key'i: `ai_chat_quota:{yyyy-mm-dd}:{user_id}`
- Tarih UTC gunu ile hesaplanir.
- `user_id` Supabase Auth user id olmalidir.
- Guest kullanici chat quota key'i almaz; guest serbest chat P3-21 policy geregi kapali kalir.

## TTL Politikasi

- Ilk increment aninda key'e bir sonraki UTC gun baslangicina kadar TTL atanir.
- Basit ve yeterli MVP davranisi:
  - `ttlSeconds = secondsUntilNextUtcMidnight + 300`
  - 300 saniyelik buffer saat farki / function gecikmesi riskini azaltir.
- Sliding window, token bazli sayac veya ayri RPM penceresi bu slice'ta yok.

## Redis Unavailable Davranisi

- Karar: fail-closed.
- Upstash URL/token eksikse veya Redis REST istegi basarisizsa Groq cagrisi yapilmaz.
- Response tipi sonraki task'ta netlesecek, ancak amac kullaniciya gecici sistem mesaji gostermektir.
- Gerekce: Redis yokken fail-open davranmak Groq organizasyon limitini ve maliyeti korumasiz birakir.
- Bu karar yalnizca `ai-chat` icin gecerlidir; `ai-definition` bu task kapsaminda degil.

## Kabul Kriteri

- [x] Hangi secret'larin nerede tutulacagi net.
- [x] Redis sadece quota icin konumlanmis durumda.
- [x] Sonraki task `P3-21a` icin kota sozlesmesi belirsiz degil.

## Notlar

- MVP icin `@upstash/redis` dependency eklemek yerine Edge Function icinde REST `fetch` ile baslamak yeterli olabilir.
- Overengineering yok: distributed queue, sliding window ve token accounting bu slice'ta yok.
- Supabase CLI help ile dogrulandi:
  - `supabase secrets set <NAME=VALUE> ...`
  - `supabase functions serve --env-file <path>`
