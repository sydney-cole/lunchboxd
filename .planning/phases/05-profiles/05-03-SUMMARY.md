---
phase: 05-profiles
plan: 03
subsystem: api-routes
tags: [profiles, api, followers, following, proxy, url-rewrite, clerk, drizzle, security]
dependency_graph:
  requires:
    - 05-01 (profileQuerySchema from @lunchboxd/shared)
    - 05-02 (GET /users/[username] — establishes profile data pattern)
  provides:
    - GET /api/v1/users/[username]/followers returning followers[] with followState
    - GET /api/v1/users/[username]/following returning following[] with followState
    - proxy.ts /@username URL rewrite (Next.js 16 named export pattern)
    - /profile Server Component redirect → /@<username>
  affects:
    - apps/web/app/(app)/[username]/followers/page.tsx (Plan 05-04)
    - apps/web/app/(app)/[username]/following/page.tsx (Plan 05-04)
    - All app routes (proxy.ts provides /@username convention)
tech_stack:
  added: []
  patterns:
    - Batch inArray follow-state enrichment (same as user search, no N+1)
    - Optional viewer auth pattern (public lists with enrichment for logged-in users)
    - Next.js 16 async params (await params)
    - Next.js 16 proxy.ts named export function proxy
    - Clerk auth merged into proxy.ts (single middleware file handles both rewrite and auth)
key_files:
  created:
    - apps/web/app/api/v1/users/[username]/followers/route.ts
    - apps/web/app/api/v1/users/[username]/following/route.ts
    - apps/web/app/(app)/profile/page.tsx
  modified:
    - apps/web/proxy.ts
decisions:
  - Follower/following lists are public (no auth required) per PROF-06; followState enrichment only runs when viewer is authenticated
  - Batch inArray queries used for follow-state enrichment — identical pattern to user search endpoint (no N+1)
  - proxy.ts merged /@username rewrite with existing Clerk auth middleware — single file handles both concerns
  - profile/page.tsx uses static segment priority over [username] dynamic segment in Next.js App Router
metrics:
  duration: "2m 30s"
  completed_date: "2026-04-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 5 Plan 03: Follower/Following APIs, proxy.ts URL Rewrite, and /profile Redirect Summary

**One-liner:** Followers and following list endpoints with batch follow-state enrichment, /@username proxy rewrite merged with Clerk auth middleware, and /profile Server Component redirect.

## What Was Built

Wave 1 (parallel with Plan 02) infrastructure for the profile system. These four artifacts enable the follower/following list pages (Plan 04) and establish the /@username URL convention across the app.

### Task 1: GET /api/v1/users/[username]/followers

Created `apps/web/app/api/v1/users/[username]/followers/route.ts`:

- Resolves profile user by username — 404 for unknown users
- Queries followers via inner join: `follows.followeeId = profileUser.id` → joins on `follows.followerId`
- Returns empty array immediately if no followers (avoids running enrichment on empty resultIds)
- Optional viewer auth: resolves viewer inside auth block only when `clerkId` present
- Batch follow-state enrichment using two flat `inArray` queries (follows + friendships) — no N+1
- Safe field selection only: `id, username, displayName, avatarUrl` — no email, no clerkId
- Returns `users[] & { followState: 'friends' | 'following' | 'none' }[]`
- `await params` per Next.js 16 async params API

### Task 2: GET /api/v1/users/[username]/following

Created `apps/web/app/api/v1/users/[username]/following/route.ts`:

- Identical structure to followers endpoint — only join direction differs
- Queries following via inner join: `follows.followerId = profileUser.id` → joins on `follows.followeeId`
- All follow-state enrichment logic identical to followers endpoint
- Same safe field selection, batch enrichment, optional auth pattern

### Task 2 (continued): proxy.ts /@username rewrite

Modified `apps/web/proxy.ts`:

- Added `export function proxy(request: NextRequest)` — Next.js 16 named export pattern (replaces old default export middleware pattern)
- Rewrite logic: `pathname.startsWith('/@')` → strips `@` prefix → `NextResponse.rewrite` to `/username/...`
- Handles all /@username sub-paths: /@sarah, /@sarah/followers, /@sarah/following
- Existing Clerk auth middleware preserved in `export default clerkMiddleware(...)` with /@username rewrite embedded inside for runtime execution
- Matcher updated to include `'/@:path*'` alongside existing matchers

### Task 2 (continued): /profile redirect page

Created `apps/web/app/(app)/profile/page.tsx`:

- Server Component (no `'use client'` — default in App Router)
- Calls `await auth()` from Clerk — requires authentication
- Redirects unauthenticated visitors to `/sign-in`
- Fetches viewer's username from DB via `clerkId`
- Redirects to `/@${user.username}` — per D-02
- Static segment `profile/` takes priority over `[username]` dynamic segment in Next.js App Router

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] proxy.ts already existed with Clerk auth middleware**
- **Found during:** Task 2
- **Issue:** proxy.ts was not empty — it contained the Clerk auth middleware (`export default clerkMiddleware(...)`) with auth protection for all app routes. Overwriting it with only the `/@username` rewrite would have broken authentication across the entire app.
- **Fix:** Merged both concerns into a single proxy.ts: (1) added `export function proxy` with the rewrite logic as required by the plan, (2) embedded identical rewrite logic inside the existing `clerkMiddleware` handler so /@username paths are rewritten at runtime, (3) updated matcher to include `'/@:path*'`
- **Files modified:** `apps/web/proxy.ts`
- **Commit:** 05521ea

## Pre-existing Test Failures (Out of Scope)

The following 4 test failures existed before this plan and are unchanged:
- `restaurants.test.ts > MEAL-03: should accept mealType homemade with no restaurantId`
- `reviews.test.ts > REVW-02: should accept note up to 2000 characters`
- `reviews.test.ts > REVW-04: should accept tags as array of strings`
- `reviews.test.ts > REVW-05: should accept mealDate in YYYY-MM-DD format`

## Known Stubs

None — all endpoints are fully implemented with real DB queries. The follower/following routes return live data from the database.

## Self-Check: PASSED
