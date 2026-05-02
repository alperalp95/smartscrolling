# P35-06a - Compact Feed Activity Ring

## Goal

Replace the large feed progress widget with a compact left-side circular activity indicator.

## Scope

- Show card progress and current streak in the same compact feed overlay.
- Use gray inactive ring ticks and green active ticks as the user approaches the card goal.
- Keep the widget for authenticated users only.
- Keep the widget visually smaller than the current card-style progress box.

## Out of Scope

- Animated rings.
- New charting or SVG dependencies.
- Streak warning or freeze logic.

## Checklist

- [x] Replace feed progress card with compact ring UI.
- [x] Include current streak in the same overlay.
- [x] Keep daily card goal progress based on `facts_read`.
- [x] Run typecheck.

## Acceptance

- Feed no longer shows the large centered progress card.
- Authenticated users see a compact left-side ring with card count and streak.
- No new dependencies are added.
