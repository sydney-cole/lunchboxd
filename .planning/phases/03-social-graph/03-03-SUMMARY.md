---
phase: 03-social-graph
plan: 03
subsystem: api, likes
tags: [drizzle, likes, toggle, batch-query, social-graph]
dependency_graph:
  requires: [03-01]
  provides: [likes-toggle-api, reviews-like-data]
  affects: [03-04, 03-05, 03-06, 03-07]
tech_stack:
  added: []
  patterns: [like-toggle-upsert, onConflictDoNothing-race-guard, batch-like-fetch]
key_files:
  created:
    - apps/web/app/api/v1/likes/route.ts
  modified:
    - apps/web/app/api/v1/reviews/route.ts
decisions:
  - "Like count computed via COUNT query (not denormalized) — simpler and avoids counter drift"
  - ".onConflictDoNothing() on insert guards race conditions from double-tap — idempotent"
  - "Batch like fetch in GET /reviews uses inArray — single query, no N+1"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
requirements: [SOCL-04]
---

# Phase 3 Plan 03: Like Toggle API and Reviews Like Data Summary

**One-liner:** POST /api/v1/likes toggles like state via Clerk auth + .onConflictDoNothing(), and GET /api/v1/reviews now includes likeCount and isLikedByMe per review via a single batch query.

## What Was Built

Created `apps/web/app/api/v1/likes/route.ts` with a POST handler that:
- Enforces Clerk auth (T-03-02): actor derived from session, never request body
- Validates `reviewId` as UUID via `likeSchema.safeParse`
- Toggles like state: checks for existing like row, deletes on unlike, inserts on like
- Guards race conditions with `.onConflictDoNothing()` on insert (backed by `likesUniqueIdx`)
- Returns `{ liked: boolean, likeCount: number }` where `likeCount` is a live COUNT query

Extended `apps/web/app/api/v1/reviews/route.ts` GET handler to:
- Import `likes` table from schema
- Batch-fetch all like rows for the current page of reviews using `inArray` (one query, no N+1)
- Build `likeCountMap` (per-review count) and `likedByMeSet` (set of reviewIds liked by current user)
- Map `likeCount` and `isLikedByMe` onto each review in the result
- POST handler unchanged — `fanOutToFollowers` still in place

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create POST /api/v1/likes toggle | 7ed9049 | apps/web/app/api/v1/likes/route.ts |
| 2 | Extend GET /api/v1/reviews with like data | 0e62765 | apps/web/app/api/v1/reviews/route.ts |

## Verification Results

- `grep "export async function POST" apps/web/app/api/v1/likes/route.ts` — PASS
- `grep "likeSchema.safeParse" apps/web/app/api/v1/likes/route.ts` — PASS
- `grep "db.delete(likes)" apps/web/app/api/v1/likes/route.ts` — PASS
- `grep ".onConflictDoNothing()" apps/web/app/api/v1/likes/route.ts` — PASS
- `grep "count.*::int" apps/web/app/api/v1/likes/route.ts` — PASS
- `grep "likeCount\|isLikedByMe" apps/web/app/api/v1/reviews/route.ts` — PASS
- `grep "fanOutToFollowers" apps/web/app/api/v1/reviews/route.ts` — PASS (POST unchanged)
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — social.test.ts 13/13 PASS, auth.test.ts 11/11 PASS (4 pre-existing failures in restaurants.test.ts and reviews.test.ts are out of scope — documented in 03-01 deferred-items.md)

## Decisions Made

- Like count is computed via a live `COUNT(*)::int` query rather than a denormalized counter column. This avoids counter drift from concurrent operations and is simpler at MVP scale; denormalization can be added later if profiling shows it's needed.
- `.onConflictDoNothing()` on the like insert leverages the `likesUniqueIdx` unique compound index on `(userId, reviewId)` to make double-tap inserts idempotent without a transaction.
- The batch like fetch in `GET /reviews` uses `inArray(likes.reviewId, reviewIds)` — a single query that fetches all like rows for the visible reviews, then groups them in application memory. This is the same pattern used for tags and restaurant data in the same handler.

## Deviations from Plan

None — plan executed exactly as written for both tasks.

### Pre-existing Test Failures (Out of Scope — Not Fixed)

The same 4 pre-existing failures documented in 03-01-SUMMARY.md remain:
- MEAL-03, REVW-02, REVW-04, REVW-05 (in restaurants.test.ts and reviews.test.ts)

These failures exist before any Phase 03 changes. Verified by running tests with changes stashed — same 4 failures appear. They are not caused by this plan's changes.

## Known Stubs

None. Both endpoints are fully implemented with real database operations.

## Self-Check: PASSED

- `apps/web/app/api/v1/likes/route.ts` — FOUND (48 lines)
- `apps/web/app/api/v1/reviews/route.ts` — FOUND, contains likeCount, isLikedByMe, fanOutToFollowers
- Commit 7ed9049 — FOUND
- Commit 0e62765 — FOUND
