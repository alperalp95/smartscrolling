# P35-07b - Card Only Daily Goal

## Goal

Remove the minute-based daily goal option until real time tracking exists.

## Scope

- Keep only card-based daily goal options.
- Treat old `minutes` goal data as no active goal in the mobile preference layer.
- Update profile copy so it does not imply minute tracking exists.

## Out of Scope

- Session duration tracking.
- Reader time tracking.
- Database migration for legacy values.

## Checklist

- [x] Remove the minute option from profile UI.
- [x] Narrow the mobile daily goal type to card goals.
- [x] Keep legacy minute values from showing as active.
- [x] Run typecheck.

## Acceptance

- Users can select only `3 kart` or `5 kart`.
- Existing minute values do not display as a working goal.
- Feed progress only uses card goals.
