# P35-10d - Remote Push Sender Smoke

## Goal

P35-10c token foundation uzerine ilk server-side remote push smoke akisini kurmak.

## Scope

- Edge Function sender tasarimi.
- Expo Push API'ye server-side request.
- Tek kullanici veya tek token hedefli kontrollu smoke.
- Ticket ve receipt sonucunu loglama modeli.
- P35-13 content freshness trigger'i bu sender smoke tamamlandiktan sonra ele alinacak.

## Out of Scope

- Geniş fanout.
- Otomatik content freshness trigger.
- Direct FCM/APNs entegrasyonu.
- Client icinden remote push gonderimi.

## Checklist

- [x] Edge Function endpoint ve auth modeli netlestirildi.
- [x] Test hedefi authenticated kullanicinin kendi enabled tokenlari olarak secildi.
- [x] Expo Push API payload formati belirlendi.
- [x] Ticket response loglama modeli response + console olarak secildi.
- [x] Receipt polling/logging davranisi manuel `receipts` action olarak planlandi.
- [x] `remote-push-smoke` Edge Function eklendi.
- [x] Edge function varlik kontrolu `npm run check:edge-functions` kapsamına alindi.
- [x] `remote-push-smoke` Edge Function remote Supabase projesine deploy edildi.
- [x] Android development build uzerinde token kaydi dogrulandiktan sonra smoke et.
- [x] P35-13 backend freshness trigger task'ini sender smoke sonucuna gore ac.

## Android Development Build Smoke - 2026-05-10

- Device: physical Android development build.
- Firebase/FCM setup: `google-services.json` added to `apps/mobile` and `android.googleServicesFile` configured in `app.json`; FCM V1 service account key uploaded to EAS credentials for `com.smartscrolling.mobile`.
- Client token smoke: Profile `Bildirimler` opt-in returned `Push token kaydedildi.` and enabled `push_tokens` persistence for the test user.
- Sender smoke: `remote-push-smoke` `send` action accepted the authenticated user's enabled token. Full pasted ticket payload was not captured in this note, but receipt polling below confirms Expo accepted the ticket id.
- Receipt smoke: `receipts` action returned `ok: true`, HTTP `status: 200`, receipt id `019e12e6-17ee-757c-8389-a783629aa09f`, Expo receipt `status: ok`.

## Smoke API

- `POST { "action": "send", "title"?: string, "body"?: string }`
- `POST { "action": "receipts", "ids": string[] }`
- Auth: `Authorization: Bearer <user JWT>`
- Target: yalnizca authenticated kullanicinin `enabled = true` push token kayitlari.

## Acceptance

- Server-side sender mobil koda secret koymadan tek test bildirimi gonderebilir.
- Expo ticket/receipt sonucu incelenebilir.
- Basarisiz tokenlar sonraki cleanup davranisi icin ayirt edilebilir.
- P35-13 icin interest-based content trigger'a gecis yolu netlesir.
