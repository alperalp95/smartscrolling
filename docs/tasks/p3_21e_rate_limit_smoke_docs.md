# P3-21e - Rate Limit Smoke Test ve Docs Kapanisi

## Amac

P1-10/P3-21 isinin release oncesi minimum dogrulamasini ve dokuman kapanisini yapmak.

## Yapilacaklar

- [x] Free kullanici icin limit smoke test notu ekle.
- [x] Premium kullanici icin limit smoke test notu ekle.
- [x] Groq 429 response davranisi manuel olarak simule edilebiliyorsa not et.
- [x] `docs/roadmap_todo.md` icinde P1-10 ve P3-21 durumunu guncelle.
- [x] `docs/CHANGELOG.md` icine implementasyon kapanis kaydi at.

## Kabul Kriteri

- Typecheck geciyor.
- Limit policy ve UI davranisi dokumanda kapali.
- Roadmap checkbox'lari ancak implementasyon ve smoke test tamamlaninca isaretli.

## Notlar

- Bu task implementation sonrasinin kapanis task'idir.
- Sadece backlog acildigi icin P1-10/P3-21 bu dosyada kapanmis sayilmaz.

## Smoke Test Runbook

### On Hazirlik

1. Supabase remote secret'larini set et:

```bash
npx supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
```

2. `ai-chat` Edge Function'i deploy et:

```bash
npx supabase functions deploy ai-chat
```

3. Mobil app'i Supabase remote project env'i ile calistir.

### Free Kullanici

Beklenen davranis:

- Authenticated free kullanici hazir AI sorularini kullanabilir.
- Ayni UTC gunu icinde 1-5. istekler kabul edilir.
- 6. istekte Edge Function `429 quota_exceeded` doner.
- Mobil chat sheet icinde "Bugunluk 5 hazir AI soru hakki" mesaji gorunur.
- Mevcut premium prompt acilir ve kullaniciyi premium ekrana yonlendirir.
- Groq cagrisi limit asimindan sonra yapilmaz.

### Premium Kullanici

Beklenen davranis:

- Server-side trusted entitlement olan premium kullanici gunluk 50 istek limitine sahiptir.
- 51. istekte Edge Function `429 quota_exceeded` doner.
- Mobil chat sheet satin alma CTA'i gostermeden "bugunluk AI sohbet limitine ulastin" dilini kullanir.
- Premium tier client payload'indan degil, Supabase Auth `app_metadata` icindeki trusted alandan okunur.

### Groq 429 Simulasyonu

Manuel simulasyon secenekleri:

- Groq org/model limitine kontrollu sekilde ulasilirsa `ai-chat` response'u `429 groq_rate_limited` olmali.
- Local debug icin Groq fetch cevabi gecici olarak `429` + `retry-after` header'i donecek sekilde mock'lanabilir; bu degisiklik commit'lenmemeli.

Beklenen davranis:

- Mobil chat sheet "AI servisi su anda yogun" mesajini gosterir.
- Varsa `retryAfterSeconds` bilgisi mesajdaki bekleme suresine yansir.
- Bu durum free/premium quota dolumu gibi premium CTA tetiklemez.

## Verification

- [x] `npm run typecheck`
- [x] Mobil AI chat helper dosyalari icin hedefli Biome check gecti.
- [x] Supabase remote secret set tamamlandi: `npx supabase secrets set --env-file .env`
- [x] `ai-chat` Edge Function deploy edildi: `npx supabase functions deploy ai-chat`
- [x] Remote free smoke test kullanici tarafindan dogrulandi; hazir soru cache davranisi MVP icin kabul edildi.
- [ ] Premium 51. soru manuel yuk testi kosulmadi; ayni server-side quota mekanizmasi kullanildigi icin ileri dogrulama notu olarak birakildi.

## Kapanis Notu

- Free kullanicida hazir sorular AI chat endpoint'ine gider ve gercek Edge/Groq cagrisinda quota artar.
- Ayni soru + ayni kitap baglami kisa sure icinde tekrar tiklanirsa mobil 30 saniyelik cache cevabi gosterir; bu durumda Groq token'i harcanmaz ve quota artmaz.
- Bu cache davranisi MVP icin kabul edildi.
