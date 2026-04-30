---
phase: 05-profiles
plan: 02
subsystem: api-routes
tags: [profiles, api, drizzle, clerk, cursor-pagination, security]
dependency_graph:
  requires:
    - 05-01 (patchUserSchema, profileQuerySchema from @lunchboxd/shared)
  provides:
    - GET /api/v1/users/[username] returning { user, stats, reviews }
    - PATCH /api/v1/users/me for authenticated profile edits
    - GET /api/v1/users/[username]/reviews with cursor pagination
  affects:
    - apps/web/app/(app)/profile pages (Plan 05-04)
    - apps/mobile profile screens (Plan 05-06)
tech_stack:
  added: []
  patterns:
    - Async params await (Next.js 16 API)
    - inArray batch fetch (no N+1 for tags/likes)
    - limit+1 cursor pagination trick (no COUNT query)
    - avatarKey ownership check via clerkId segment comparison
    - Server-side avatarUrl construction from R2_PUBLIC_URL
    - Optional viewer auth pattern (public routes with enrichment for logged-in users)
key_files:
  created:
    - apps/web/app/api/v1/users/[username]/route.ts
    - apps/web/app/api/v1/users/me/route.ts
    - apps/web/app/api/v1/users/[username]/reviews/route.ts
  modified: []
decisions:
  - Viewer userId resolved lazily inside the enrichment block — skipped entirely for unauthenticated requests
  - avatarKey ownership enforced at PATCH handler by matching clerkId segment against auth() session (not body)
  - Stats default to { followerCount '0', followingCount '0', reviewCount '0' } when no userStats row exists (new users)
  - profileQuerySchema used for reviews pagination — same cursor contract as feedQuerySchema for consistency
metrics:
  duration: "1m 50s"
  completed_date: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 5 Plan 02: Wave 1 API Routes — User Profile Endpoints Summary

**One-liner:** Three Next.js 16 route handlers for public profile data, authenticated profile edits with avatarKey ownership enforcement, and cursor-paginated review lists.

## What Was Built

Wave 1 API foundation for Phase 5 (Profiles). Web pages (Plan 04/05) and mobile screens (Plan 06) depend on these three endpoints.

### Task 1: GET /api/v1/users/[username]

Created `apps/web/app/api/v1/users/[username]/route.ts`:

- Resolves user by username with safe field selection only (id, username, displayName, avatarUrl, bio — no email, no clerkId)
- Returns 404 JSON for unknown usernames
- Fetches userStats (followerCount, followingCount, reviewCount) with a default fallback for users with no stats row
- Fetches 10 most recent non-deleted reviews with `isNull(reviews.deletedAt)` soft-delete filter
- Batch-fetches tags and likes using `inArray` (no N+1 queries)
- Optional viewer auth: resolves viewerUserId inside enrichment block only if `clerkId` is present, enabling `isLikedByMe` for authenticated viewers
- `params` awaited per Next.js 16 async params API

### Task 2: PATCH /api/v1/users/me

Created `apps/web/app/api/v1/users/me/route.ts`:

- Requires authentication — 401 for unauthenticated requests
- Validates request body with `patchUserSchema` (bio, displayName, avatarKey)
- avatarKey ownership check: splits key on `/` and compares segment [1] against `clerkId` from `auth()` — returns 403 if mismatch
- Constructs avatarUrl server-side: `${R2_PUBLIC_URL}/${avatarKey}` — client cannot supply arbitrary URLs
- Partial update: only fields explicitly present in parsed data are written to DB
- Actor always from `auth()` session — `actorUserId` from `resolveUserId(clerkId)`, never from request body

### Task 3: GET /api/v1/users/[username]/reviews

Created `apps/web/app/api/v1/users/[username]/reviews/route.ts`:

- Resolves profile user by username — 404 for unknown
- Validates cursor/limit with `profileQuerySchema` — returns 400 for invalid params
- Cursor pagination using limit+1 trick: fetches one extra row, slices to `limit`, returns `nextCursor` as ISO string or null
- WHERE clause: `userId = profileUser.id AND deletedAt IS NULL AND (cursor ? createdAt < cursor)`
- Batch-fetches tags, restaurants, and likes with `inArray` (no N+1)
- Optional viewer auth for `isLikedByMe` enrichment
- Response: `{ items: enrichedReviews[], nextCursor: string | null }`

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

The following 4 test failures existed before this plan and are unchanged:
- `restaurants.test.ts > MEAL-03: should accept mealType homemade with no restaurantId`
- `reviews.test.ts > REVW-02: should accept note up to 2000 characters`
- `reviews.test.ts > REVW-04: should accept tags as array of strings`
- `reviews.test.ts > REVW-05: should accept mealDate in YYYY-MM-DD format`

## Known Stubs

None — all three routes are fully implemented with real DB queries and auth validation.

## Self-Check: PASSED
