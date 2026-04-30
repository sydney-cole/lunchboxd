---
phase: 04-feed
plan: "02"
subsystem: feed
tags: [api, feed, cursor-pagination, drizzle, batch-fetch, wave-1]
dependency_graph:
  requires: [04-01, feedQuerySchema, feedItems, reviews, users, restaurants, likes, reviewTags]
  provides: [GET /api/v1/feed]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [cursor-pagination, limit-plus-one-trick, batch-inArray-fetch, fan-out-on-write-read, no-db-transaction]
key_files:
  created:
    - apps/web/app/api/v1/feed/route.ts
  modified: []
decisions:
  - Order by feedItems.createdAt DESC not reviews.createdAt — preserves fan-out ordering correctness
  - Cursor wraps new Date(cursor) in lt() — raw string comparison fails for timestamp columns in Drizzle
  - limit+1 fetch trick detects hasMore without COUNT query — one fewer DB round-trip
  - No db.transaction() — Neon HTTP adapter does not support it; sequential awaits + Promise.all only
  - isOwnReview field included for feed UI kebab menu conditional rendering
  - Author exposes only username and avatarUrl — no email or clerkId (security)
  - restaurantIds guarded with length > 0 check before query to avoid empty inArray call
metrics:
  duration_seconds: 59
  completed_date: "2026-04-30"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 04 Plan 02: Feed API Endpoint Summary

**One-liner:** GET /api/v1/feed cursor-paginated endpoint using fan-out-on-write feedItems table with batch joins for reviews, tags, likes, restaurants, and authors.

## What Was Built

### GET /api/v1/feed (apps/web/app/api/v1/feed/route.ts)

A fully functional cursor-paginated feed endpoint. Consumers: web infinite scroll feed (Wave 2) and mobile FlatList feed (Wave 3).

**Auth flow:**
- Clerk `auth()` extracts clerkId
- `resolveUserId()` maps to internal UUID
- 401 on missing auth, 404 on unknown user

**Query parameter handling:**
- `feedQuerySchema.safeParse()` validates cursor (ISO 8601) and limit (1-100, default 20)
- 400 with Zod issues on invalid params

**Pagination logic:**
- Fetches `limit + 1` rows from `feedItems` to detect `hasMore` without COUNT
- `nextCursor` = last item's `feedCreatedAt.toISOString()` when hasMore, else null
- Cursor WHERE clause: `lt(feedItems.createdAt, new Date(cursor))` — Date object required

**Batch data fetching (no N+1):**
1. `reviews` filtered by `inArray(reviewIds)` + `isNull(deletedAt)`
2. `reviewTags` via `inArray(reviewIds)`
3. `likes` via `inArray(reviewIds)` — computes likeCount and isLikedByMe in memory
4. `restaurants` via `inArray(restaurantIds)` (guarded: skipped if empty)
5. `users` (authors) via `inArray(authorIds)` — limited to username + avatarUrl

**Response shape per item:**
```typescript
{
  id, body, rating, photoUrl, mealType, mealDate, createdAt, feedCreatedAt,
  tags: string[],
  restaurant: { id, name, address } | null,
  likeCount: number,
  isLikedByMe: boolean,
  author: { id, username, avatarUrl } | null,
  isOwnReview: boolean,
}
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b9161f2 | feat | GET /api/v1/feed cursor-paginated endpoint |

## Deviations from Plan

None — plan executed exactly as written.

Note: 4 pre-existing test failures exist in `reviews.test.ts` and `restaurants.test.ts` (REVW-02, REVW-04, REVW-05, MEAL-03). These are pre-existing failures present before this plan and documented in the 04-01 SUMMARY. All 5 feed unit tests remain GREEN.

## Known Stubs

None — implementation is fully functional with no placeholders.

## Self-Check: PASSED
