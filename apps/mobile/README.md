# SmartScrolling Mobile App

This folder contains the Expo / React Native client for SmartScrolling.

## Current Status

Working today:

- feed screen with Supabase-backed facts
- library screen backed by Supabase `books` rows
- book reader screen
- highlighted word popup UI
- stabilized TypeScript and lint baseline
- CI includes lint and mobile typecheck gates
- bookmark persistence for authenticated sessions
- reading progress hydration and debounced sync for valid authenticated book sessions
- ai-definition popup invocation with local fallback protection
- ai-chat sheet invocation with local failure fallback
- ai-chat history hydration and debounced persistence to `chat_sessions` for authenticated sessions
- demo library books mapped to seeded Supabase `books.id` UUID values
- real free-book catalog slice for two books with remote `cover_url` support
- first reader slice now changes by real book identity (`Kendime Dusunceler`, `Ask ve Gurur`)
- library cards include branded fallback covers for catalog polish when remote art is weak
- reader now has a phase-1 full-readable path for `Kendime Dusunceler` and `The Problems of Philosophy`; next step is extending the rest of the catalog with `book_sections` + Storage-backed source files
- section verisi olan kitaplarda reader artik bolum-bolum tam ekran hissi veren dikey pager ile calisiyor
- access policy now enforces one free anchor text plus auth/premium gates in library and reader runtime
- library catalog is now aligned to a 10-book public-domain learning shelf instead of a mixed fiction demo
- soft FTUE modal is live on first launch and routes users into either feed discovery or the free anchor book

Not finished yet:

- auth flow
- progressive profiling persistence, daily goal, and notification preference steps are not complete yet
- Google OAuth ilk mobil button/helper/callback dilimi eklendi; dashboard provider setup ve redirect allowlist hizasi tamamlanmadan production-ready sayilmaz
- Apple Sign-In button'u ve native capability entegrasyonu henuz tamamlanmadi

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router 6
- TypeScript
- Zustand
- Supabase

## Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Start the mobile app:

```bash
cd apps/mobile
npx expo start
```

3. Optional checks:

```bash
npm run lint
cd apps/mobile
npx tsc --noEmit
```

## Important Paths

- app routes: `apps/mobile/app`
- shared mobile logic: `apps/mobile/src`
- Supabase client: `apps/mobile/src/lib/supabase.ts`
- feed store: `apps/mobile/src/store/feedStore.ts`
- feed types: `apps/mobile/src/types/index.ts`

## Known Gaps

- save interactions are persisted when a user session exists, while like state is still local UI state
- reading progress sync is active for the seeded two-book demo catalog; yeni kitaplar icin ayni UUID hizasi korunmali
- AI definition popup and AI chat sheet are wired, but both still read from demo book content until real book rows are connected
- premium entitlement is still a placeholder gate; RevenueCat wiring remains a separate follow-up
- documentation is being aligned sprint by sprint with implementation

## Related Docs

- `docs/roadmap_todo.md`
- `docs/project_action_plan.md`
- `docs/tasks/p1_00_stabilization_task_list.md`
- `docs/tasks/p1_11_auth_foundation.md`
