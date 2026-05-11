# P35-13b - Backend Content Freshness Push

## Goal

P35-13 MVP single local reminder davranisini bozmadan, daily fact ingest basarili olduktan sonra yeni icerik varsa remote push gondermek.

## Scope

- Tetikleme: yalnizca GitHub Actions `Facts Ingest` daily modu basarili bittikten sonra.
- Freshness: son 3 saatte `facts.created_at` ile eklenmis en az 1 fact.
- Hedefleme: MVP'de `push_tokens.enabled = true` ve `users.notifications_enabled = true` olan tum tokenlar.
- Copy: `Yeni kartlar hazir` / `Bugun yeni bilgiler seni bekliyor.`
- Kayit: DB campaign/log tablosu yok; Edge Function response ve console log yeterli.

## Out of Scope

- Interest-based hedefleme.
- Per-user delivery log veya campaign dedupe tablosu.
- Catch-up ingest sonrasi otomatik push.
- Mobil uygulamada yeni UI veya ikinci local notification.

## Checklist

- [x] `content-freshness-push` Edge Function eklendi.
- [x] Internal auth icin `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` kontrolu eklendi.
- [x] Fresh facts ve enabled token query'leri service-role server context'inde yapildi.
- [x] Expo Push API gonderimleri 100'luk chunk'lara bolundu.
- [x] `facts-ingest.yml` daily ingest basarisi sonrasi function cagrisi yapacak sekilde guncellendi.
- [x] Weekly catch-up modunda push tetiklenmeyecek sekilde birakildi.
- [x] `npm run check:edge-functions` kapsamÄ±na yeni function eklendi.
- [x] Remote deploy yapildi ve `npx supabase functions list` ile `ACTIVE`, version 5 olarak dogrulandi.
- [ ] Manual content freshness push smoke sonucu kaydedilecek.
- [ ] GitHub Actions daily workflow smoke sonucu kaydedilecek.

## Deploy / Smoke Notes - 2026-05-10

- `content-freshness-push` remote Supabase projesine deploy edildi.
- Ilk remote cagrida `BOOT_ERROR` goruldu; runtime `.d.ts` import'u ve `supabase-js` dependency'si kaldirilarak function service-role REST `fetch` akisiyle sadeleştirildi.
- Internal bearer cagrisi 200 dondu ve canli DB'de son 3 saatte fresh fact olmadigi icin beklenen `sent: false`, `reason: no_fresh_facts`, `freshFactCount: 0` sonucunu verdi.
- Full send/receipt smoke henuz yapilmadi; bunun icin son 3 saatte en az bir gercek `facts` kaydi ve enabled push token hedefi gerekir.

## Smoke Checklist

- [ ] En az bir enabled `push_tokens` row'u var.
- [ ] Son 3 saatte en az bir `facts.created_at` row'u var.
- [ ] `content-freshness-push` `send` response'u `sent: true`, `targetCount > 0`, non-empty `ticketIds` donuyor.
- [ ] 45-60 saniye sonra `receipts` action Expo receipt `status: ok` donuyor.
- [ ] `Facts Ingest` workflow daily mode log'unda content freshness push response'u gorunuyor.

## Acceptance

- Daily ingest yeni fact urettiginde remote content push otomatik denenir.
- Yeni fact yoksa veya hedef token yoksa function 200 ile `sent: false` doner.
- Mobil local reminder davranisi degismez.
- Interest-based hedefleme broadcast MVP smoke tamamlandiktan sonra ayri task olarak kalir.
