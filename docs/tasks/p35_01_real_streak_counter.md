# P35-01 - Real Streak Counter

## Goal

Replace the hardcoded profile streak value with a real streak calculated from `public.user_activity`.

## Scope

- Read recent `user_activity` rows for the authenticated user.
- Treat a day as active when `facts_read`, `pages_read`, or `ai_queries` is greater than zero.
- Calculate the current streak from today; if today has no activity but yesterday does, keep showing the current carried streak from yesterday.
- Show the calculated streak in the profile summary.
- Use the same activity data to mark active days in the weekly row.

## Out of Scope

- Streak break warning (`P35-02`).
- Streak record/best streak (`P35-03`).
- Grace period or freeze mechanics (`P35-04`).
- Badges, animations, confetti, or weekly charts.

## Checklist

- [x] Add a small activity summary reader in the mobile activity helper.
- [x] Wire profile summary to the real streak value.
- [x] Replace static weekly dots with activity-backed dots.
- [x] Run typecheck.

## Acceptance

- New users or guests see `0` / inactive dots.
- Authenticated users with activity records see a non-hardcoded streak.
- The implementation does not introduce new tables or broad analytics abstractions.
