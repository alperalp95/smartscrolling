# P35-06 - Today Cards Widget

## Goal

Show a small feed widget that tells the authenticated user how many fact cards they read today.

## Scope

- Read today's `facts_read` count from `public.user_activity`.
- Show a compact overlay in the feed for authenticated users.
- If the user's daily goal is fact-based, show progress as `today / goal`.
- Update the widget after a newly viewed fact is tracked in the current session.

## Out of Scope

- Circular progress animation (`P35-08`).
- Weekly activity graph (`P35-09`).
- Push notification reminders.
- Guest persistence.
- New analytics/event taxonomy.

## Checklist

- [x] Add a today activity reader in the mobile activity helper.
- [x] Add compact feed widget UI.
- [x] Increment the visible count after successful activity tracking.
- [x] Run typecheck.

## Acceptance

- Authenticated users see `Bugun X kart okudun` in the feed.
- Users with a fact daily goal see `Bugun X/Y kart`.
- Guests do not see a misleading persisted progress widget.
