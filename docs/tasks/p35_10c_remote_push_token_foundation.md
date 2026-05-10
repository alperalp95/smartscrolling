# P35-10c - Remote Push Token Foundation

## Goal

Local notification MVP tamamlandiktan sonra remote push icin en kucuk guvenli temel katmani kurmak: Expo push token saklama, token lifecycle ve backend tarafindan hedeflenebilir bildirim gonderme yolunu hazirlamak.

## Scope

- Expo Push Service kullanimi icin `ExpoPushToken` persistence modeli.
- Remote push bu taskta sadece foundation olarak ele alinacak; P35-13 content freshness trigger'i bu token temelinin uzerine kurulacak.
- Client secret, FCM/APNs credential veya service role key mobil koda gomulmeyecek.
- Token alma yine kullanicinin bilinclli notification opt-in aksiyonundan sonra yapilacak.
- Expo Go production-ready push smoke kabul edilmeyecek; Android development build ve release/preview build farklari dokumante edilecek.

## Official Docs Snapshot

- Expo SDK 54 docs: Android SDK 53+ remote push Expo Go icinde desteklenmez; development build gerekir. Local notifications Expo Go'da daha genis desteklidir.
- Expo Push Service docs: server, client'tan alinan `ExpoPushToken` degeriyle Expo Push API'ye istek atar; delivery sonucunu ticket/receipt akisiyle izlemek gerekir.
- Expo notification concepts: remote push server'dan cihaza gider; local notification ise app icinden planlanir. P35 local MVP bu nedenle remote push ile karistirilmamalidir.

## DB Model

Yeni tablo:

- `public.push_tokens`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references public.users(id) on delete cascade`
- `expo_push_token text not null`
- `platform text not null check (platform in ('android', 'ios'))`
- `enabled boolean not null default true`
- `last_seen_at timestamptz not null default now()`
- `revoked_at timestamptz null`
- `app_version text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints / indexes:

- `unique (user_id, expo_push_token)`
- index on `(user_id, enabled)`
- index on `(expo_push_token)`

RLS intent:

- Authenticated user can select/insert/update only own token rows.
- User can mark own token disabled/revoked.
- Server-side send job uses service role outside mobile client.

## Client Lifecycle Plan

1. User taps Profile `Bildirimler`.
2. OS permission is granted.
3. Local schedule remains active as today.
4. Remote foundation helper optionally calls Expo token fetch.
5. Token is upserted to `push_tokens`.
6. App launch/Profile focus can refresh `last_seen_at` only if notifications are still enabled and OS permission is granted.
7. Toggle off disables/revokes current user's token rows and cancels local pending notifications.
8. OS permission revoked from App Info disables local preference and marks token rows disabled best-effort.
9. Sign out disables the current Expo token row best-effort before session sign-out.

## Backend Send Plan

- First remote sender will be an Edge Function, not client-side code.
- It receives a safe internal/event payload, queries eligible `push_tokens`, sends to Expo Push API, and records send result.
- Initial send target should be tiny and explicit, for example one authenticated user or one test token.
- Ticket/receipt logging should be planned before broad fanout.
- Sender implementation is tracked in `P35-10d Remote Push Sender Smoke`.

## P35-13 Connection

P35-13 MVP is already covered by single daily local copy. The real backend content freshness trigger should wait for this foundation:

- detect new published content batch
- choose eligible users
- dedupe per user/content window
- send remote push through Edge Function
- avoid creating a second local daily notification

## Checklist

- [x] Confirm Expo Push Service vs direct FCM/APNs decision.
- [x] Confirm `push_tokens` table columns and RLS policy shape.
- [x] Confirm token lifecycle on toggle off, OS permission revoked, sign out and account deletion.
- [x] Confirm token fetch is part of Profile opt-in immediately.
- [x] Create Supabase migration after DB model approval.
- [x] Apply Supabase migration to linked remote project after user approval.
- [x] Update generated Supabase types after migration.
- [x] Add client upsert/revoke helper without changing local scheduling behavior.
- [x] Add Android development build token smoke checklist.
- [x] Plan first Edge Function sender and Expo ticket/receipt logging as the next task.
- [x] Link P35-13 backend freshness trigger to the sender task.

## Decisions

- MVP provider: Expo Push Service.
- Token model: one current row per `user_id + expo_push_token`; no token history table.
- Sign out: disable current token row best-effort.
- P35-13 targeting: interest-based, implemented after sender smoke.
- Debug UI: no separate debug row in MVP.

## Acceptance

- No remote credential or secret is added to mobile code.
- Token persistence migration and client helper are in place.
- Local notification MVP behavior remains unchanged.
- P35-13 remote content trigger has a clear dependency on `P35-10d`.

## Android Development Build Smoke Checklist

- [x] Toggle on with permission granted keeps local schedule and upserts one enabled token row.
- [ ] Reopening app/Profile updates `last_seen_at` without duplicate rows.
- [ ] Toggle off disables token rows and clears local pending reminders.
- [ ] Android App Info notification revoke syncs preference off and disables token rows.
- [ ] Sign out disables the current-token row best-effort.
- [ ] Token unsupported on emulator/dev environment does not break local notifications.

## Android Smoke Notes - 2026-05-10

- Initial physical Android token fetch failed until Firebase Android config was added to the native build.
- `google-services.json` is configured via `android.googleServicesFile`; FCM V1 service account key was uploaded to EAS credentials.
- After reinstall/clear data and Profile opt-in, the app displayed `Push token kaydedildi.` and `push_tokens` persistence unblocked P35-10d sender smoke.
