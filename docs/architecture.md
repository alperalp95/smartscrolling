# SmartScrolling Architecture

> Version: v0.2
> Date: 2026-04-13
> Status: Current repo state after stabilization sprint

---

## Product Snapshot

SmartScrolling is a cross-platform mobile app concept that turns short-form scrolling into a learning experience. The current repository contains:

- a React Native + Expo mobile app
- a Supabase schema with RLS policies
- deployed Supabase Edge Functions for AI definition and AI chat flows
- a content ingestion pipeline for Wikipedia and NASA based fact generation

The project is past the idea stage, but it is still in MVP assembly mode rather than release-ready production.

---

## What Is Working Today

### Mobile app

- Expo Router based mobile application under `apps/mobile`
- Feed screen with vertical full-screen card flow
- Library screen and book reader screen
- Library is being repositioned as an AI-assisted learning library, not a general fiction bookshelf
- Highlight popup interaction inside the book reader
- Local like/save UI state in the feed
- Supabase-backed fact fetching for the feed
- Supabase-backed library catalog for books with cover metadata
- `books` tablosunu ham kaynak dosya metadata'si ile, `book_sections` tablosunu ise okunabilir section icerigi ile ayiran storage-backed kitap modeli baslatildi
- Supabase-backed bookmark persistence for authenticated sessions
- Reader progress state that hydrates and debounced-syncs to `reading_progress` when a valid user/book identity exists
- Reader popup that can call a deployed `ai-definition` Edge Function with local fallback protection
- Reader chat history that hydrates from and debounced-syncs to `chat_sessions` for authenticated sessions
- Feed save ve reader chat gibi korunan aksiyonlarda oturumsuz kullanici icin profile yonlendiren auth prompting
- Auth prompting ile profile'a giden kullaniciyi basarili giris sonrasi kaynak ekrana geri donduren post-auth redirect akisi
- Value-first auth stratejisi: kullanici feed ve demo kitap deneyimini anon yasayabilir, auth save/sync/chat gibi yuksek niyet anlarinda istenir
- Soft FTUE ilk denemede implement edildi ancak web preview stabilitesini bozdugu icin kontrollu rollback ile devreden cikarildi; yeniden implementasyon arastirma-temelli ikinci turda ele alinacak
- Book access strategy karari: kullaniciya 1 serbest okunabilir metin verilecek; diger metinler auth, premium katmanindaki metinler ise auth + premium isteyecek
- Runtime access policy ilk kez kodlandi: library rozetleri ve reader kilit ekranlari `free_anchor` / `premium` ayrimini uyguluyor; gercek premium entitlement baglantisi sonraki RevenueCat adiminda tamamlanacak
- Aktif katalog simdilik 10 kitaplik public-domain ogrenme rafina genisletildi; roman katalogu aktif raftan cikarildi
- Demo library entries are now aligned with seeded Supabase `books.id` UUID values
- Library screen now reads from the `books` table; reader metadata and first public-domain content slices are now served from live book identity
- First full-readable phase is prepared for `Kendime Dusunceler` and `The Problems of Philosophy`; next scalable step is extending the rest of the catalog with `book_sections` rows while keeping original source files in Supabase Storage
- Reader now prefers `book_sections` rows for full reading flow, while highlight popup logic still falls back to curated inline slice data
- Reader now prefers `book_sections` rows for full reading flow and rebuilds keyword/reference highlights from section text for popup continuity
- Reader section deneyimi, `book_sections` mevcutsa bolum-basina tek ekran davranisi veren dikey pager yapisina tasindi

### Backend foundation

- Supabase migration for core tables:
- `users`
- `facts`
- `books`
- `book_sections`
- `book_highlights`
- `reading_progress`
- `bookmarks`
- `chat_sessions`
- `user_activity`
- RLS rules for user-owned tables
- Edge Function folders for `ai-chat` and `ai-definition`

### Tooling

- Monorepo structure with npm workspaces
- Turbo for workspace orchestration
- Biome for lint and formatting
- GitHub Actions workflow for EAS build pipeline
- TypeScript and lint baseline stabilized on 2026-04-13
- CI now includes a dedicated mobile typecheck gate and Supabase function entrypoint sanity check

---

## What Is Not Finished Yet

- authentication flow temel seviyede aktif; auth prompting ve post-auth redirect var, ancak tam auth-first urun akisi henuz tamamlanmadi
- progressive profiling ve guest mode mesajlasmasi henuz ilk asamada; retention odakli onboarding akisi tamamlanmadi
- FTUE ikinci turdan once yeniden tasarlanacak; hedef, global root modal yerine web-safe ve progressive bir giris katmani kurmak
- planlanan profiling sirasi: ilk auth -> ilgi alani, ilk anlamli aktivite -> gunluk hedef, ikinci geri donus -> bildirim tercihi
- Google / Apple OAuth provider setup is documented but not yet configured in dashboard/mobile runtime
- Documentation outside roadmap/task tracking still needs ongoing alignment as backend features land

---

## Current Stack

### Mobile

| Layer | Current choice |
|---|---|
| App framework | React Native |
| Runtime | Expo SDK 54 |
| Routing | Expo Router 6 |
| Language | TypeScript |
| State | Zustand |
| Animation | React Native Animated + Reanimated |
| Data fetch | direct fetch + Supabase client |
| Styling | StyleSheet based RN styling |

### Backend

| Layer | Current choice |
|---|---|
| Backend platform | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth foundation present, app flow incomplete |
| Authorization | RLS |
| Serverless | Supabase Edge Functions (Deno) |
| AI target integration | Groq wired through deployed Supabase Edge Functions |

### Content pipeline

| Layer | Current choice |
|---|---|
| Source 1 | Wikipedia |
| Source 2 | NASA APOD |
| Enrichment | Groq-based transformation scripts |
| Insert target | Supabase `facts` table |

---

## System View

```text
Mobile App (Expo / React Native)
  -> fetches facts from Supabase
  -> shows feed, library, reader, profile
  -> persists bookmarks for authenticated users
  -> syncs reading progress when user and book identity are valid
  -> still uses local UI state for like

Supabase
  -> Postgres tables + RLS
  -> planned auth/session source
  -> active persistence target for bookmarks and reading progress
  -> deployed `ai-definition` and `ai-chat` flows

Content Pipeline
  -> pulls content from Wikipedia and NASA
  -> transforms content into fact cards
  -> inserts facts into Supabase
```

---

## Repository Structure

```text
smartscrolling/
|-- apps/
|   `-- mobile/
|       |-- app/
|       |-- assets/
|       |-- components/
|       |-- hooks/
|       `-- src/
|           |-- lib/
|           |-- store/
|           `-- types/
|-- docs/
|   |-- CHANGELOG.md
|   |-- architecture.md
|   |-- content_strategy.md
|   |-- project_action_plan.md
|   |-- project_audit_report.md
|   |-- roadmap_todo.md
|   |-- rules.md
|   `-- tasks/
|       |-- lessons.md
|       `-- p1_00_stabilization_task_list.md
|-- packages/
|   `-- pipeline/
|-- supabase/
|   |-- functions/
|   `-- migrations/
|-- package.json
`-- turbo.json
```

---

## Backend Priorities

The next recommended backend execution order is:

1. complete email/password auth polish and provider setup
2. replace local like state with persistent engagement tracking
3. persist chat history into `chat_sessions`
4. replace placeholder premium gate with RevenueCat entitlement checks and expand the learning catalog beyond the current two-book seed

---

## Notes

- This document reflects the repo as of 2026-04-13, not the long-term target architecture.
- If the implementation moves, this file should be updated together with `docs/roadmap_todo.md` and `docs/tasks/p1_00_stabilization_task_list.md`.
