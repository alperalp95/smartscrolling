# P4-01b - Interest Summary Edit

## Goal

After interests are selected, show them as a compact profile summary with an edit action instead of leaving all chips open.

## Scope

- Show selected interests as a summary after they are saved or hydrated.
- Add a simple `Duzenle` action to reopen the chip selector.
- Keep first-time/no-interest users in the chip selection state.
- Save behavior remains unchanged.

## Out of Scope

- Feed personalization changes.
- Onboarding redesign.
- New interest categories.

## Checklist

- [x] Add summary state for selected interests.
- [x] Add edit action to reopen chips.
- [x] Close editor after successful save.
- [x] Run typecheck.

## Acceptance

- Users with saved interests see a compact summary by default.
- Tapping `Duzenle` opens the existing chip selector.
- Users with no interests still see the selector immediately.
