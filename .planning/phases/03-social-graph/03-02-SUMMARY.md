---
phase: 03-social-graph
plan: 02
subsystem: api, social-graph
tags: [drizzle, follow, unfollow, friendship, feed-items, user-stats, clerk-auth]
dependency_graph:
  requires: [03-01]
  provides: [follow-api, unfollow-api, friendship-detection, user-stats-increment]
  affects: [03-03, 03-04, 03-05, 03-06, 03-07]
tech_stack:
  added: []
  patterns: [sequential-awaited-ops-neon, upsert-on-conflict-do-update, two-step-delete-subquery, greatest-floor-decrement]
key_files:
  created:
    - apps/web/app/api/v1/follows/route.ts
  modified: []
decisions:
  - "No db.transaction() used — Neon HTTP adapter does not support transactions; sequential awaited operations used throughout"
  - "Friendship cleanup checks BOTH directions (userAId/userBId and userBId/userAId) — ordering convention not enforced"
  - "Feed cleanup uses two-step query (get review IDs, then delete feed_items) — Drizzle does not support DELETE...WHERE IN subquery"
  - "GREATEST(count - 1, 0) prevents negative userStats counts on decrement"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
requirements: [SOCL-01, SOCL-02, SOCL-03]
---

# Phase 3 Plan 02: Follow/Unfollow API Summary

**One-liner:** POST and DELETE /api/v1/follows with Clerk auth, mutual friendship detection, feed_items cleanup, and GREATEST-floored userStats upserts using sequential Neon HTTP operations.

## What Was Built

Created `apps/web/app/api/v1/follows/route.ts` implementing the full social graph write path:

**POST /api/v1/follows** — Follow a user:
- Clerk auth guard: actor derived from session (T-03-01), never request body
- Self-follow rejected with 400
- Idempotent follow insert via `.onConflictDoNothing()` on `followsUniqueIdx`
- Mutual follow detection: queries reverse follow row; if present, upserts `friendships` row
- Upserts `userStats` for both actor (followingCount +1) and target (followerCount +1)
- Returns `{ followState: 'following' | 'friends' }`

**DELETE /api/v1/follows** — Unfollow a user:
- Same Clerk auth guard and followSchema validation
- Deletes follow row
- Deletes friendship in BOTH directions (userAId/userBId and reversed) to handle any insert ordering
- Two-step feed cleanup: fetches target's non-deleted review IDs, then deletes actor's feed_items for those reviews
- Decrements userStats for both users using `GREATEST(count - 1, 0)` to floor at zero
- Returns `{ followState: 'none' }`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create POST /api/v1/follows | 341dfbd | apps/web/app/api/v1/follows/route.ts |
| 2 | Add DELETE /api/v1/follows | 341dfbd | apps/web/app/api/v1/follows/route.ts (same commit) |

## Verification Results

- `grep "export async function POST"` — PASS (line 9)
- `grep "export async function DELETE"` — PASS (line 70)
- `grep "const { userId: clerkId } = await auth()"` — PASS (lines 11, 72)
- `grep "followSchema.safeParse"` — PASS (lines 18, 79)
- `grep "targetUserId === actorUserId"` — PASS (line 26)
- `grep "onConflictDoNothing"` — PASS (lines 33, 46)
- `grep "onConflictDoUpdate"` — PASS (lines 54, 62, 120, 128)
- `grep "GREATEST"` — PASS (lines 122, 130)
- `grep "inArray(feedItems.reviewId"` — PASS (line 112)
- `grep "db.transaction"` — empty (no transactions used)
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — social.test.ts: 13/13 PASS; 4 pre-existing failures in restaurants.test.ts and reviews.test.ts (unchanged from 03-01)

## Decisions Made

- Used sequential awaited operations throughout — Neon HTTP adapter (`drizzle-orm/neon-http`) does not support `db.transaction()`
- Friendship cleanup runs two DELETE statements covering both ordering variants of (userAId, userBId) — the friendshipsUniqueIdx does not enforce insertion order
- Feed cleanup uses a two-step approach (select review IDs → delete feed_items) rather than a subquery, because Drizzle's query builder does not support `DELETE FROM ... WHERE id IN (SELECT ...)`
- `GREATEST(count - 1, 0)` chosen over raw decrement to prevent negative counts from race conditions or duplicate unfollow calls

## Deviations from Plan

### Implementation Sequence

Tasks 1 and 2 were implemented and committed together in a single atomic commit (341dfbd), since the file required both handlers for completeness and the type-checker validates both simultaneously. All acceptance criteria for both tasks are met.

## Known Stubs

None. Both handlers are fully implemented with real auth, validation, database writes, and stat management.

## Self-Check: PASSED

- `apps/web/app/api/v1/follows/route.ts` — FOUND, 134 lines, exports POST and DELETE
- Commit 341dfbd — FOUND
- `pnpm --filter web type-check` — exit 0
