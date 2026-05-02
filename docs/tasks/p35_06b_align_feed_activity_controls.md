# P35-06b - Align Feed Activity Controls

## Goal

Align the feed activity ring and the back-to-top button vertically.

## Scope

- Keep the activity ring on the left.
- Move the back-to-top button up to match the activity ring top alignment for authenticated users.
- Do not change button behavior.

## Out of Scope

- Redesigning feed gestures.
- Changing ad, review, or guest hint behavior.
- New animations.

## Checklist

- [x] Adjust authenticated back-to-top top offset.
- [x] Keep guest offset unchanged.
- [x] Run typecheck.

## Acceptance

- When both are visible, the back-to-top button no longer sits lower than the activity ring.
