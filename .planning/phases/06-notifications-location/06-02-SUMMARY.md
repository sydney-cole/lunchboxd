---
phase: 06-notifications-location
plan: 02
subsystem: notifications-api
tags: [notifications, api, route-handlers, cursor-pagination, side-effects, drizzle]
dependency_graph:
  requires:
    - notificationQuerySchema (packages/shared/src/schemas/index.ts — from 06-01)
    - notifications table (apps/web/lib/schema.ts — from 06-01 migration)
  provides:
    - GET /api/v1/notifications (cursor-paginated notification list with actor enrichment)
    - GET /api/v1/notifications/unread ({ hasUnread: boolean })
    - PATCH /api/v1/notifications/read-all (mark all notifications read for authenticated user)
    - notification INSERT side effect on POST /api/v1/follows
    - notification INSERT side effect in like branch of POST /api/v1/likes
  affects:
    - apps/web/app/api/v1/notifications/route.ts (new)
    - apps/web/app/api/v1/notifications/unread/route.ts (new)
    - apps/web/app/api/v1/notifications/read-all/route.ts (new)
    - apps/web/app/api/v1/follows/route.ts (modified)
    - apps/web/app/api/v1/likes/route.ts (modified)
tech_stack:
  added: []
  patterns:
    - "Cursor pagination with limit+1 trick — identical contract to feed/route.ts (04-02)"
    - "Batch-fetch actor users and restaurant names using inArray — no N+1 queries"
    - "limit(1) trick for hasUnread — avoids COUNT query when only existence check is needed"
    - "Notification INSERT placed after follow/like INSERT succeeds — inline side effect pattern (D-01)"
    - "D-02 self-notification skip guard: if (targetUserId !== actorUserId) and if (review.userId !== actorUserId)"
key_files:
  created:
    - apps/web/app/api/v1/notifications/route.ts
    - apps/web/app/api/v1/notifications/unread/route.ts
    - apps/web/app/api/v1/notifications/read-all/route.ts
  modified:
    - apps/web/app/api/v1/follows/route.ts
    - apps/web/app/api/v1/likes/route.ts
    - apps/web/app/(app)/[username]/page.tsx (Rule 1 fix)
    - apps/web/proxy.ts (Rule 1 fix)
decisions:
  - "Notification INSERT in follows route placed after follow INSERT and before reverse-follow check — ordering ensures notification only fires if follow succeeded"
  - "Like notification requires SELECT reviews.userId before INSERT — single-row SELECT in else branch (no N+1 since it's a toggle action)"
  - "actorId always sourced from resolveUserId(clerkId), never request body — enforced in both follows and likes modifications (T-06-02-04)"
metrics:
  duration: "8m"
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_created: 3
  files_modified: 4
---

# Phase 6 Plan 02: Notification API Endpoints and Side Effects Summary

**One-liner:** Three notification API route handlers (cursor-paginated list, hasUnread check, read-all PATCH) plus inline notification INSERT side effects added to follows and likes routes with D-02 self-skip guards.

---

## What Was Built

**Three new route files:**

- **`apps/web/app/api/v1/notifications/route.ts`** — GET handler with cursor-based pagination matching the feed/route.ts contract. Batch-fetches actor users and restaurant names (via review lookup) in separate queries to avoid N+1. All rows scoped via `WHERE userId = $me`.

- **`apps/web/app/api/v1/notifications/unread/route.ts`** — GET returning `{ hasUnread: boolean }`. Uses limit(1) trick to check existence without a COUNT query.

- **`apps/web/app/api/v1/notifications/read-all/route.ts`** — PATCH that updates all unread notifications to `read: true` for the authenticated user. `userId` always comes from `resolveUserId(clerkId)` — never accepted from the request body (T-06-02-03).

**Two modified route files:**

- **`apps/web/app/api/v1/follows/route.ts`** — Added `notifications` to import. After the follow INSERT succeeds, a `notifications` INSERT fires with `type: 'follow'`, `userId = targetUserId`, `actorId = actorUserId`. Self-skip guard: `if (targetUserId !== actorUserId)` (D-02).

- **`apps/web/app/api/v1/likes/route.ts`** — Added `notifications` and `reviews` to import. Inside the `else` (like) branch only, after the like INSERT, fetches `reviews.userId` for the given reviewId, then inserts a notification with `type: 'like'`. Unlike branch (`if (existingLike)`) has zero notification code (T-06-02-05, D-06). Self-skip guard: `if (review && review.userId !== actorUserId)` (D-02).

---

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create notification API routes | 532360b | apps/web/app/api/v1/notifications/route.ts, unread/route.ts, read-all/route.ts |
| 2 | Add notification INSERT side effects to follows and likes routes | def7622 | apps/web/app/api/v1/follows/route.ts, apps/web/app/api/v1/likes/route.ts |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript null narrowing on profile page (pre-existing)**
- **Found during:** Task 1 — build failed before new files could be verified
- **Issue:** `apps/web/app/(app)/[username]/page.tsx` line 153: `profile === null` did not narrow `undefined` case, causing TypeScript error "Property 'user' does not exist on type '{ user: ProfileUser; stats: ProfileStats } | undefined'"
- **Fix:** Changed `profile === null` to `profile == null` (loose equality narrows both null and undefined)
- **Files modified:** apps/web/app/(app)/[username]/page.tsx
- **Commit:** 532360b

**2. [Rule 1 - Bug] Fixed proxy.ts NextRequest import type used as value constructor (pre-existing)**
- **Found during:** Task 1 — build failed with "NextRequest cannot be used as a value because it was imported using 'import type'"
- **Issue:** `apps/web/proxy.ts` imported `NextRequest` with `import type`, but used it as `new NextRequest(...)` value constructor on line 42
- **Fix:** Changed `import type { NextRequest }` to `import { NextRequest }` to allow value use
- **Files modified:** apps/web/proxy.ts
- **Commit:** 532360b

---

## Deferred Issues

Pre-existing test failures (4 failures in restaurants.test.ts and reviews.test.ts) exist before and after this plan's changes. Not caused by this plan. Logged for future investigation:
- `MEAL-03: should accept mealType homemade with no restaurantId`
- `REVW-02: should accept note up to 2000 characters`
- `REVW-04: should accept tags as array of strings`
- `REVW-05: should accept mealDate in YYYY-MM-DD format`

---

## Known Stubs

None — all three notification endpoints are fully wired to the database. No placeholder data or hardcoded values.

---

## Threat Surface Scan

New endpoints introduced at trust boundaries:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-auth-endpoint | apps/web/app/api/v1/notifications/route.ts | New GET endpoint at /api/v1/notifications — cursor param validated by notificationQuerySchema; WHERE scoped to userId=$me (T-06-02-01, T-06-02-02) |
| threat_flag: new-auth-endpoint | apps/web/app/api/v1/notifications/unread/route.ts | New GET endpoint — no params; userId from session only |
| threat_flag: new-auth-endpoint | apps/web/app/api/v1/notifications/read-all/route.ts | New PATCH endpoint — userId always from Clerk session, never request body (T-06-02-03) |

All three mitigations from the plan's threat register implemented as specified.

---

## Self-Check: PASSED

- apps/web/app/api/v1/notifications/route.ts: FOUND
- apps/web/app/api/v1/notifications/unread/route.ts: FOUND
- apps/web/app/api/v1/notifications/read-all/route.ts: FOUND
- apps/web/app/api/v1/follows/route.ts: FOUND with db.insert(notifications)
- apps/web/app/api/v1/likes/route.ts: FOUND with db.insert(notifications)
- Commit 532360b: FOUND
- Commit def7622: FOUND
- pnpm --filter web build: PASSED
- Pre-existing test failures confirmed out-of-scope (failures exist on commit prior to this plan)
