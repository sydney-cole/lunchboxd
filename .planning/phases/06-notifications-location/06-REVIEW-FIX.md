---
phase: 06-notifications-location
fixed_at: 2026-05-04T00:00:00Z
review_path: .planning/phases/06-notifications-location/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-05-04T00:00:00Z
**Source review:** .planning/phases/06-notifications-location/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (Critical only)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Hardcoded placeholder Android Maps API key in app.json

**Files modified:** `apps/mobile/app.json`
**Commit:** 4cfbafe
**Applied fix:** Replaced `"YOUR_ANDROID_MAPS_KEY"` with `"$ANDROID_GOOGLE_MAPS_API_KEY"` so EAS Build injects the value from project secrets at build time instead of shipping the placeholder string in the binary manifest.

---

### CR-02: Race condition in follow route causes duplicate follow notifications

**Files modified:** `apps/web/app/api/v1/follows/route.ts`
**Commit:** 82fb885
**Applied fix:** Changed the follow INSERT to use `.returning({ id: follows.id })` and stored the result in `inserted`. The notification INSERT is now guarded by `if (inserted.length > 0 && targetUserId !== actorUserId)` so concurrent or retry requests that hit `onConflictDoNothing` do not produce duplicate notifications.

---

### CR-03: Unbounded query on /api/v1/restaurants/map — no row limit

**Files modified:** `apps/web/app/api/v1/restaurants/map/route.ts`
**Commit:** e353c76
**Applied fix:** Added `.limit(500)` to the `selectDistinct` query, capping the rows returned from Postgres to 500. This bounds both memory usage on the serverless worker and response payload size on every map load.

---

### CR-04: Like notification fires on a deleted review

**Files modified:** `apps/web/app/api/v1/likes/route.ts`
**Commit:** 663126a
**Applied fix:** Added `isNull` to the drizzle-orm imports and added `isNull(reviews.deletedAt)` to the review ownership `WHERE` clause. If the query returns no row (review is soft-deleted), the handler now returns 404 rather than inserting a notification. The redundant `review &&` guard in the `if` was also removed since the early-return makes it unnecessary.

---

### CR-05: Mobile bell query proceeds with null token silently

**Files modified:** `apps/mobile/app/(app)/(tabs)/_layout.tsx`
**Commit:** 9e899ce
**Applied fix:** Added an early return of `{ hasUnread: false }` when `getToken()` returns null, preventing the fetch from sending `Authorization: Bearer null`. Added a `if (!res.ok) throw new Error(...)` guard before `res.json()` so non-200 responses surface as query errors rather than being silently parsed as valid data.

---

_Fixed: 2026-05-04T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
