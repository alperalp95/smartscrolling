# P35-07c - Daily Goal Summary Edit

## Goal

Make the daily card goal section compact after the user has selected a goal.

## Scope

- Show the saved card goal as a summary by default.
- Add a `Duzenle` action to reopen the existing `3 kart` / `5 kart` selector.
- Keep the selector open when no goal exists.
- Close the selector after a successful save.

## Out of Scope

- New goal types.
- Goal recommendation logic.
- Any feed personalization changes.

## Checklist

- [x] Add compact summary state for the daily goal.
- [x] Reuse the existing goal selector behind `Duzenle`.
- [x] Close the editor after saving.
- [x] Run typecheck.

## Acceptance

- Profile no longer keeps daily goal chips open after a goal is saved.
- Users can still edit the goal from the compact summary.
