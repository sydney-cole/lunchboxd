---
phase: 03-social-graph
plan: 01
subsystem: schema, validation
tags: [drizzle, zod, social-graph, schema, unit-tests]
dependency_graph:
  requires: []
  provides: [friendships-unique-index, follow-schema, like-schema, user-search-schema, social-schema-tests]
  affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07]
tech_stack:
  added: []
  patterns: [pgTable-callback-unique-index, zod-v4-uuid-validation, zod-v4-string-bounds]
key_files:
  created:
    - apps/web/__tests__/social.test.ts
  modified:
    - apps/web/lib/schema.ts
    - packages/shared/src/schemas/index.ts
decisions:
  - "friendshipsUniqueIdx uses pgTable callback API matching existing follows/likes pattern"
  - "unfollowSchema defined as separate schema (not alias) for clarity and independent evolution"
  - "userSearchSchema adds max(100) bound beyond restaurantSearchSchema — prevents oversized inputs"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
requirements: [SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05]
---

# Phase 3 Plan 01: Social Graph Schema Foundation Summary

**One-liner:** Friendships unique compound index on (userAId, userBId) pushed to Neon, plus followSchema/likeSchema/userSearchSchema with 13 passing unit tests.

## What Was Built

Added the missing `friendshipsUniqueIdx` unique compound index on `(userAId, userBId)` to the `friendships` table using the pgTable callback API (same pattern as `followsUniqueIdx` on the `follows` table). This was the blocking Wave 0 issue — without this index, `.onConflictDoNothing()` would never trigger and duplicate friendship rows would accumulate.

Defined four Zod validation schemas in `packages/shared/src/schemas/index.ts`:
- `followSchema` — validates `targetUserId` as UUID string
- `unfollowSchema` — validates `targetUserId` as UUID string
- `likeSchema` — validates `reviewId` as UUID string
- `userSearchSchema` — validates `q` string with min(2)/max(100) bounds

All schemas export corresponding TypeScript types via `z.infer`. Created `apps/web/__tests__/social.test.ts` with 13 unit tests across all four schemas validating accept/reject boundary conditions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add friendships unique index | 62da17a | apps/web/lib/schema.ts |
| 2 | Define social Zod schemas | 319846a | packages/shared/src/schemas/index.ts |
| 3 | Create social schema unit tests | 94f916b | apps/web/__tests__/social.test.ts |

## Verification Results

- `grep "friendshipsUniqueIdx" apps/web/lib/schema.ts` — PASS
- `grep "followSchema|likeSchema|userSearchSchema" packages/shared/src/schemas/index.ts` — PASS
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — social.test.ts: 13/13 PASS
- `npx drizzle-kit push` (from apps/web/) — PASS (Changes applied)

## Decisions Made

- Used pgTable callback API for `friendshipsUniqueIdx` — consistent with `followsUniqueIdx` and `likesUniqueIdx` patterns already in schema.ts
- Defined `unfollowSchema` as a separate object (not an alias of `followSchema`) for independent evolution and clarity in import names
- Added `max(100)` to `userSearchSchema.q` beyond the existing `restaurantSearchSchema` which only has `min(2)` — provides input sanitization per threat model T-03-04

## Deviations from Plan

### Pre-existing Test Failures (Out of Scope — Not Fixed)

**4 pre-existing failures in restaurants.test.ts and reviews.test.ts were discovered but are unrelated to Phase 03 changes.**

- MEAL-03: reviewSchema rejecting valid homemade input
- REVW-02: reviewSchema rejecting valid note string
- REVW-04: reviewSchema rejecting valid tags array
- REVW-05: reviewSchema rejecting valid YYYY-MM-DD date

These failures exist in the codebase before any Phase 03 changes were made. They are logged in `.planning/phases/03-social-graph/deferred-items.md` for investigation. The social.test.ts (13 tests) all pass cleanly.

None — plan executed exactly as written for the 3 targeted tasks.

## Known Stubs

None. All schemas are fully implemented with real validation logic.

## Self-Check: PASSED

- `apps/web/lib/schema.ts` — FOUND, contains friendshipsUniqueIdx
- `packages/shared/src/schemas/index.ts` — FOUND, contains followSchema, likeSchema, userSearchSchema
- `apps/web/__tests__/social.test.ts` — FOUND, 75 lines
- Commit 62da17a — FOUND
- Commit 319846a — FOUND
- Commit 94f916b — FOUND
