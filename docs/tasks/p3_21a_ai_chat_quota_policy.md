# P3-21a - AI Chat Quota Policy

## Amac

AI chat icin kullanici tiplerine gore sade kota politikasini netlestirmek.

## Politika

- Guest: serbest chat yok; hazir soru/preview deneyimi urun kararina gore kalabilir.
- Free authenticated user: `5 soru / gun`.
- Premium user: `50 soru / gun`.
- Sistem/Groq limiti: Groq `429` veya Redis korumasi dolarsa kullaniciya gecici yogunluk mesaji doner.

## Yapilacaklar

- [x] Free ve premium limit sayilarini sabitle.
- [x] Gunluk pencerenin UTC mi local tarih mi olacagini sec.
- [x] Premium entitlement kaynagini netlestir (`authStore.hasPremium` / request payload / server-side lookup).
- [x] Limit dolunca donulecek response shape'i tanimla.
- [x] UI mesajlarini urun diliyle netlestir.

## Quota Sozlesmesi

| Kullanici tipi | Gunluk limit | Redis key | Davranis |
|---|---:|---|---|
| Guest | 0 | yok | Chat request `401 auth_required` doner. Hazir soru/preview UI urun tarafinda kalabilir, Groq'a gitmez. |
| Free authenticated | 5 | `ai_chat_quota:{yyyy-mm-dd}:{user_id}` | 5 hak dolunca Groq'a gitmeden `quota_exceeded` doner. |
| Premium authenticated | 50 | `ai_chat_quota:{yyyy-mm-dd}:{user_id}` | 50 hak dolunca Groq'a gitmeden `quota_exceeded` doner. |
| Sistem / Groq limit | uygulanmaz | yok | Groq `429` ya da Redis unavailable durumunda gecici sistem mesaji doner. |

## Gunluk Pencere

- Gunluk pencere UTC gunu ile hesaplanir.
- Pencere key prefix'i `yyyy-mm-dd` formatindadir.
- Local timezone kullanilmamasinin nedeni server tarafinda deterministik ve kullanici cihaz saatinden bagimsiz kalmaktir.

## Premium Entitlement Kaynagi

- Edge Function client payload'indaki `hasPremium`, `isPremium`, `quotaTier` gibi degerlere guvenmez.
- Mobil `authStore.hasPremium` sadece UI karari icin kullanilir; server quota karari icin trusted source degildir.
- Hedef trusted source server-side entitlement kontroludur:
  - Supabase JWT ile `user_id` dogrulanir.
  - Premium tier sadece server tarafinda dogrulanabiliyorsa `premium` sayilir.
- P3-23 server-side entitlement kaynagi hazir degilse P3-21b ilk implementasyonda tum authenticated kullanicilari `free` quota tier olarak ele alir.
- Premium 50/gun davranisi ancak server tarafinda dogrulanabilir entitlement baglandiginda aktif edilir.

## Response Shape

### Auth yok

```json
{
  "error": "Authentication required",
  "code": "auth_required"
}
```

HTTP status: `401`

### Gunluk quota doldu

```json
{
  "error": "Daily AI chat limit reached",
  "code": "quota_exceeded",
  "quota": {
    "tier": "free",
    "limit": 5,
    "remaining": 0,
    "resetAt": "2026-04-30T00:00:00.000Z"
  }
}
```

HTTP status: `429`

### Redis / quota sistemi gecici kullanilamiyor

```json
{
  "error": "AI quota is temporarily unavailable",
  "code": "quota_unavailable"
}
```

HTTP status: `503`

### Groq organizasyon/model limiti

```json
{
  "error": "AI is temporarily busy",
  "code": "groq_rate_limited",
  "retryAfterSeconds": 60
}
```

HTTP status: `429`

## UI Mesajlari

- `auth_required`: "AI sohbet icin once hesabini bagla."
- `quota_exceeded` + free tier: "Bugunku 5 AI soru hakkini kullandin. Premium ile gunluk 50 soruya cikabilirsin."
- `quota_exceeded` + premium tier: "Bugunku 50 AI soru hakkini kullandin. Yarin tekrar devam edebilirsin."
- `quota_unavailable`: "AI kotasi su an kontrol edilemiyor. Biraz sonra tekrar dene."
- `groq_rate_limited`: "AI servisi su an yogun. Biraz sonra tekrar dene."

## Kullanicinin Yapmasi Gereken Operasyonlar

P3-21b implementasyonuna gecmeden once:

1. Upstash hesabinda Redis database olustur.
2. Upstash dashboard'dan REST URL ve REST token degerlerini al.
3. Remote Supabase secrets icin su komutu calistir:

```powershell
npx supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
```

4. Local test icin gitignored `.env` dosyana ayni iki degeri ekle.
5. Premium 50/gun davranisini gercek test etmek icin RevenueCat tarafinda `premium` entitlement ve auth user id / appUserID hizasinin tamamlanmasi gerekecek. Bu hazir degilse ilk backend quota testi free tier uzerinden yapilir.

## Kabul Kriteri

- [x] Edge Function tarafinda uygulanacak politika tek sayfada anlasilir.
- [x] Mobil UI tarafinin hangi hata tipinde ne gosterecegi belli.
- [x] Premium kullanici sinirsiz degil, genis ama kontrollu limitli.

## Notlar

- Groq limitleri organizasyon/model seviyesinde oldugu icin premium kullaniciya da urun limiti verilir.
- Token bazli kota sonraki maliyet olgunlastirma isidir; ilk MVP sayac bazli gunluk quota ile baslar.
- Bu task policy kapanisidir; Redis helper veya mobil UI kodu eklenmedi.
