---
phase: 04-feed
plan: "01"
subsystem: feed
tags: [zod, schema, utils, tests, wave-0]
dependency_graph:
  requires: []
  provides: [feedQuerySchema, FeedQueryInput, formatRelativeTime, feed.test.ts]
  affects: [packages/shared, apps/web]
tech_stack:
  added: []
  patterns: [zod-coerce, datetime-validation, relative-time-formatting, tdd-wave-0]
key_files:
  created:
    - apps/web/__tests__/feed.test.ts
    - apps/web/lib/utils.ts
  modified:
    - packages/shared/src/schemas/index.ts
decisions:
  - feedQuerySchema uses z.string().datetime() for ISO 8601 cursor validation (Zod v4 API)
  - z.coerce.number() converts string query params to number automatically for limit field
  - formatRelativeTime is a pure function with no dependencies; no library import needed
  - Wave 0 tests created GREEN (not RED) because implementations were added first in same wave
metrics:
  duration_seconds: 57
  completed_date: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 01: Feed Wave 0 Foundation Summary

**One-liner:** feedQuerySchema (cursor pagination + limit coercion) and formatRelativeTime utility added, locked by 5 GREEN unit tests.

## What Was Built

Wave 0 foundation for Phase 4 Feed: the shared Zod schema for feed query parameters and a pure time-formatting utility, both covered by 5 unit tests.

### feedQuerySchema (packages/shared/src/schemas/index.ts)

Appended to the shared schemas file after the Phase 3 section:

- `cursor`: `z.string().datetime().optional().nullable()` — validates ISO 8601 format, accepts null (first page) or undefined, rejects arbitrary strings
- `limit`: `z.coerce.number().int().min(1).max(100).default(20)` — coerces string query params to integers, enforces max 100, defaults to 20
- `FeedQueryInput` type exported via `z.infer`

### formatRelativeTime (apps/web/lib/utils.ts)

New file created with a pure function:

- `< 1 min` → `'just now'`
- `1-59 min` → `'Xm'`
- `1-23 h` → `'Xh'`
- `1-6 d` → `'Xd'`
- `>= 7 d` → short date via `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`

### feed.test.ts (apps/web/__tests__/feed.test.ts)

5 unit tests (all GREEN):

1. `feedQuerySchema` rejects non-ISO-8601 cursor
2. `feedQuerySchema` accepts null cursor
3. `feedQuerySchema` coerces string limit and enforces max 100
4. `formatRelativeTime` returns `'just now'` for < 1 minute ago
5. `formatRelativeTime` returns `'2h'` for 2 hours ago

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 99b9c0a | feat | feedQuerySchema added to shared package |
| edd1cbe | feat | formatRelativeTime added to apps/web/lib/utils.ts |
| 47442f0 | test | feed.test.ts with 5 unit tests (all GREEN) |

## Deviations from Plan

None — plan executed exactly as written.

Note: 4 pre-existing test failures exist in `reviews.test.ts` and `restaurants.test.ts` (REVW-02, REVW-04, REVW-05, MEAL-03). These are pre-existing failures caused by tests omitting the required `rating` field from `reviewSchema`. They are out of scope for this plan and were present before any changes were made.

## Known Stubs

None — both implementations are fully functional with no placeholders.

## Self-Check: PASSED
