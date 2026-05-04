---
phase: 06-notifications-location
verified: 2026-05-04T12:00:00Z
status: human_needed
score: 12/14 must-haves verified (2 require human testing)
overrides_applied: 0
human_verification:
  - test: "Confirm mobile bell icon + notification screen are functionally correct on device"
    expected: "Bell in Profile tab header shows red dot when hasUnread; tapping pushes NotificationsScreen with correct rows; red dot clears after opening"
    why_human: "Plan 05 checkpoint was approved WITHOUT device testing ('mobile testing deferred by user'). The mobile path (native module react-native-maps + Expo build requirement) cannot be verified programmatically."
  - test: "Confirm REQUIREMENTS.md NOTF-01 and NOTF-02 checkbox status matches implementation"
    expected: "NOTF-01 and NOTF-02 should be checked [x] — notification INSERT side effects are fully implemented in follows/route.ts and likes/route.ts"
    why_human: "The code is implemented and correct, but REQUIREMENTS.md still shows both as '[ ] Pending'. This is a documentation inconsistency requiring a manual update."
---

# Phase 6: Notifications & Location — Verification Report

**Phase Goal:** Users receive in-app notifications when followed or liked, and can browse an interactive map of reviewed restaurants filtered by their social graph.
**Verified:** 2026-05-04
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user receives an in-app notification when someone follows them or likes a review | VERIFIED | `db.insert(notifications)` present in `follows/route.ts` (type='follow') and `likes/route.ts` (type='like', else branch only); D-02 self-skip guards confirmed (`targetUserId !== actorUserId`, `review.userId !== actorUserId`) |
| 2 | A user can open a notification center and see all recent notification activity | VERIFIED | `GET /api/v1/notifications` returns cursor-paginated rows scoped to authenticated user; `NotificationBell` client component renders panel with avatar + action text + relative time rows; mobile `NotificationsScreen` with `useInfiniteQuery` |
| 3 | A user can view an interactive map of reviewed restaurants | VERIFIED (web) / ? UNCERTAIN (mobile) | Web: `APIProvider + AdvancedMarker` in `apps/web/app/(app)/map/page.tsx`, data flowing from `/api/v1/restaurants/map`; Mobile: `react-native-maps` MapView code exists but mobile human checkpoint was deferred without device testing |
| 4 | A user can search reviewed restaurants by neighborhood/city, prioritizing follows | VERIFIED | `/api/v1/restaurants/reviewed` uses `ilike(city)` + `ilike(address)` with `restaurantReviewedQuerySchema` validation; `reviewedByFollowed` computed server-side from authenticated user's follows in both `/map` and `/reviewed` endpoints |

**Score:** 3.5/4 roadmap truths verified (1 uncertain on mobile)

---

### All Must-Haves Summary (combined from all 5 plan frontmatter must_haves)

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `notificationQuerySchema` parses valid cursor + limit; rejects invalid ISO strings | VERIFIED | 17 Vitest tests passing; `packages/shared/src/schemas/index.ts` has 2 occurrences of `notificationQuerySchema` |
| 2 | `restaurantReviewedQuerySchema` rejects q > 100 chars | VERIFIED | `z.string().max(100).optional()` in schema; test covers boundary at 101 chars |
| 3 | `notificationQuerySchema` limit coerces string '20' to number 20 | VERIFIED | `z.coerce.number()` pattern; test confirms coercion |
| 4 | Test file exists with passing unit tests | VERIFIED | `apps/web/__tests__/notifications.test.ts` exists; 17 `it()` blocks across 4 `describe()` groups |
| 5 | GET /api/v1/notifications returns cursor-paginated rows scoped to authenticated user | VERIFIED | `WHERE userId = $me` via `eq(notifications.userId, userId)`; cursor pagination with limit+1 trick |
| 6 | GET /api/v1/notifications/unread returns `{ hasUnread: boolean }` | VERIFIED | Route returns `{ hasUnread: rows.length > 0 }` using limit(1) trick; no count, no unauthenticated access |
| 7 | PATCH /api/v1/notifications/read-all marks all unread rows read for authenticated user only | VERIFIED | `UPDATE WHERE userId=$me AND read=false`; userId always from `resolveUserId(clerkId)` never request body |
| 8 | Following a user immediately creates a notification row (type='follow') | VERIFIED | `db.insert(notifications)` after follow INSERT in `follows/route.ts`; `userId=targetUserId`, `actorId=actorUserId` |
| 9 | Liking a review immediately creates notification row (type='like') | VERIFIED | `db.insert(notifications)` inside `else` branch of like toggle in `likes/route.ts`; fetches review owner |
| 10 | Self-follow and self-like produce no notification row | VERIFIED | Guards: `if (targetUserId !== actorUserId)` in follows; `if (review && review.userId !== actorUserId)` in likes |
| 11 | Unlike branch produces no notification row | VERIFIED | Notification INSERT is exclusively in `else` branch; `if (existingLike)` (unlike) has no notification code |
| 12 | GET /api/v1/restaurants/map returns coordinate-bearing restaurants with `reviewedByFollowed` | VERIFIED | `isNotNull(restaurants.lat)`, `isNotNull(restaurants.lng)`, INNER JOIN, JS Map dedup with followed upgrade |
| 13 | GET /api/v1/restaurants/reviewed includes null lat/lng restaurants, optional ILIKE q filter | VERIFIED | No `isNotNull` constraint; `or(ilike(city), ilike(address))` when q provided; `restaurantReviewedQuerySchema` validates q |
| 14 | Bell icon in web nav fires PATCH read-all on open and invalidates unread query | VERIFIED | `handleOpen` calls `fetch('/api/v1/notifications/read-all', { method: 'PATCH' })` then `queryClient.invalidateQueries(['notifications-unread'])` |
| 15 | Web map page at /map shows pins with social color coding | VERIFIED | `AdvancedMarker` + `Pin` with `background: pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'`; `parseFloat(pin.lat/lng)` conversion present |
| 16 | Mobile bell icon in Profile header with unread polling | VERIFIED (code) / ? UNCERTAIN (device) | `ProfileHeaderRight` with `Ionicons notifications-outline`, `notifications-unread` query, `refetchInterval: 30_000`; but mobile checkpoint was deferred |
| 17 | Mobile NotificationsScreen fires read-all on mount | VERIFIED (code) | `useEffect` fires `PATCH /api/v1/notifications/read-all` + `queryClient.invalidateQueries(['notifications-unread'])` on mount |
| 18 | Mobile MapScreen with react-native-maps and socially-colored pins | VERIFIED (code) / ? UNCERTAIN (device) | `MapView`, `Marker` with `pinColor: pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'`, `tracksViewChanges={false}`, `parseFloat(pin.lat)` all present; EAS dev build rebuild required before device testing |

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/shared/src/schemas/index.ts` | VERIFIED | `notificationQuerySchema` (2 occurrences) + `restaurantReviewedQuerySchema` (2 occurrences) appended after Phase 5 section |
| `apps/web/__tests__/notifications.test.ts` | VERIFIED | 17 `it()` cases across 4 `describe()` groups; covers schemas + pure function logic |
| `apps/web/app/api/v1/notifications/route.ts` | VERIFIED | GET handler, cursor pagination, batch-fetch actors, scoped to `userId=$me` |
| `apps/web/app/api/v1/notifications/unread/route.ts` | VERIFIED | GET returning `{ hasUnread: boolean }`, auth guard, limit(1) trick |
| `apps/web/app/api/v1/notifications/read-all/route.ts` | VERIFIED | PATCH updating `read=true WHERE userId=$me`, auth guard |
| `apps/web/app/api/v1/follows/route.ts` | VERIFIED | `db.insert(notifications)` after follow INSERT, D-02 self-skip guard |
| `apps/web/app/api/v1/likes/route.ts` | VERIFIED | `db.insert(notifications)` in like branch only, D-02 self-skip guard |
| `apps/web/app/api/v1/restaurants/map/route.ts` | VERIFIED | `isNotNull(lat/lng)` + INNER JOIN + `isNull(deletedAt)` + `reviewedByFollowed` social signal |
| `apps/web/app/api/v1/restaurants/reviewed/route.ts` | VERIFIED | No lat/lng filter; ILIKE on city/address; `restaurantReviewedQuerySchema` for q; `reviewedByFollowed` |
| `apps/web/components/notification-bell.tsx` | VERIFIED | `'use client'`; polling `notifications-unread`; PATCH read-all on open; infinite scroll panel |
| `apps/web/app/(app)/layout.tsx` | VERIFIED | `NotificationBell` imported and rendered in nav bar; no `'use client'` (stays Server Component) |
| `apps/web/app/(app)/map/page.tsx` | VERIFIED | `'use client'`; `APIProvider + AdvancedMarker`; `parseFloat(pin.lat/lng)`; social pin colors; debounced search |
| `apps/mobile/app/(app)/notifications.tsx` | VERIFIED (code) | `useInfiniteQuery`, Bearer token, read-all on mount, avatar + action text + relative time rows |
| `apps/mobile/app/(app)/map.tsx` | VERIFIED (code) | `MapView`, `tracksViewChanges={false}`, `parseFloat(pin.lat/lng)`, social colors, list panel with search |
| `apps/mobile/app/(app)/(tabs)/_layout.tsx` | VERIFIED (code) | `ProfileHeaderRight` with bell + unread dot + `headerRight` on Profile tab |
| `apps/mobile/app/(app)/(tabs)/search.tsx` | VERIFIED (code) | `headerRight` Map button navigating to `/(app)/map` |
| `apps/mobile/app.json` | VERIFIED | `react-native-maps` plugin entry present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/schemas/index.ts` | `apps/web/app/api/v1/notifications/route.ts` | `notificationQuerySchema` import from `@lunchboxd/shared` | WIRED | Import confirmed; `safeParse` call confirmed |
| `packages/shared/src/schemas/index.ts` | `apps/web/app/api/v1/restaurants/reviewed/route.ts` | `restaurantReviewedQuerySchema` import | WIRED | Import confirmed; `safeParse` call confirmed |
| `apps/web/app/api/v1/follows/route.ts` | notifications table | `db.insert(notifications)` after follow INSERT | WIRED | INSERT inside `if (targetUserId !== actorUserId)` guard; after follows INSERT, before reverse-follow check |
| `apps/web/app/api/v1/likes/route.ts` | notifications table | `db.insert(notifications)` in like branch only | WIRED | INSERT inside `else` branch; `if (existingLike)` unlike branch has no notification code |
| `apps/web/app/(app)/layout.tsx` | `apps/web/components/notification-bell.tsx` | `import { NotificationBell }` | WIRED | Import and `<NotificationBell />` render confirmed |
| `apps/web/components/notification-bell.tsx` | `/api/v1/notifications/unread` | `useQuery(['notifications-unread'])` with `refetchInterval: 30_000` | WIRED | Confirmed |
| `apps/web/app/(app)/map/page.tsx` | `/api/v1/restaurants/map` | `useQuery(['restaurants-map'])` | WIRED | Confirmed |
| `apps/web/app/(app)/map/page.tsx` | `/api/v1/restaurants/reviewed` | `useQuery(['restaurants-reviewed', debouncedQuery])` | WIRED | Confirmed |
| `apps/mobile/app/(app)/(tabs)/_layout.tsx` | `apps/mobile/app/(app)/notifications.tsx` | `router.push('/(app)/notifications')` from bell | WIRED | Confirmed |
| `apps/mobile/app/(app)/notifications.tsx` | `/api/v1/notifications` | `useInfiniteQuery` with Bearer token | WIRED | Confirmed |
| `apps/mobile/app/(app)/map.tsx` | `/api/v1/restaurants/map` | `useQuery` with Bearer token | WIRED | Confirmed |
| `apps/mobile/app/(app)/(tabs)/search.tsx` | `apps/mobile/app/(app)/map.tsx` | `router.push('/(app)/map')` from headerRight | WIRED | Confirmed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `notification-bell.tsx` | `unreadData.hasUnread` | `GET /api/v1/notifications/unread` → DB `WHERE userId=$me AND read=false LIMIT 1` | Yes — DB query | FLOWING |
| `notification-bell.tsx` | `allItems` (panel list) | `GET /api/v1/notifications` → cursor-paginated DB query scoped to userId | Yes — DB query | FLOWING |
| `map/page.tsx` | `mapPins` | `GET /api/v1/restaurants/map` → `selectDistinct` JOIN `restaurants + reviews` with `isNotNull(lat/lng)` | Yes — DB query | FLOWING |
| `map/page.tsx` | `listRestaurants` | `GET /api/v1/restaurants/reviewed` → `selectDistinct` JOIN `restaurants + reviews` with optional ILIKE | Yes — DB query | FLOWING |
| `notifications.tsx` (mobile) | `allItems` | `GET /api/v1/notifications` with Bearer token | Yes — API → DB | FLOWING |
| `map.tsx` (mobile) | `mapPins`, `listData` | `GET /api/v1/restaurants/map` and `/reviewed` with Bearer token | Yes — API → DB | FLOWING |

---

## Behavioral Spot-Checks

Skipped for web API routes (no running server in static verification). Code-level checks confirmed:

| Behavior | Check | Result |
|----------|-------|--------|
| `notificationQuerySchema` rejects invalid cursor | `grep "notificationQuerySchema"` in test + schema | PASS — 2 schema occurrences + test coverage |
| Unlike branch has no notification INSERT | `grep -n "existingLike"` in likes/route.ts | PASS — INSERT confirmed inside `else` branch only |
| Map endpoint returns only coordinate-bearing restaurants | `grep "isNotNull"` in map/route.ts | PASS — `isNotNull(restaurants.lat)` + `isNotNull(restaurants.lng)` |
| Reviewed endpoint excludes `isNotNull` constraint | `grep "isNotNull"` in reviewed/route.ts | PASS — NOT FOUND (correct — null lat/lng included) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTF-01 | 06-01, 06-02 | User receives in-app notification when followed | SATISFIED (code) / NOT UPDATED (REQUIREMENTS.md) | `db.insert(notifications)` with `type='follow'` in `follows/route.ts` with D-02 guard. REQUIREMENTS.md still shows `[ ]` Pending — documentation not updated. |
| NOTF-02 | 06-01, 06-02 | User receives in-app notification when liked | SATISFIED (code) / NOT UPDATED (REQUIREMENTS.md) | `db.insert(notifications)` with `type='like'` in like branch of `likes/route.ts` with D-02 guard. REQUIREMENTS.md still shows `[ ]` Pending — documentation not updated. |
| NOTF-03 | 06-02, 06-04, 06-05 | User can view all notifications in notification center | SATISFIED | Web `NotificationBell` panel + mobile `NotificationsScreen` both implemented and wired |
| LOCN-01 | 06-03, 06-04, 06-05 | User can browse interactive map of reviewed restaurants | SATISFIED | Web: `APIProvider + AdvancedMarker` at `/map`; Mobile: `react-native-maps MapView` |
| LOCN-02 | 06-03, 06-04, 06-05 | User can search reviewed restaurants by neighborhood/city | SATISFIED | `ilike(city)` + `ilike(address)` in `/reviewed` endpoint; search input in web list panel and mobile map screen |
| LOCN-03 | 06-03, 06-04, 06-05 | Location browse prioritizes follows | SATISFIED | `reviewedByFollowed` computed server-side from authenticated user's follows in both `/map` and `/reviewed` endpoints; visual differentiation in UI with pin colors |

**NOTF-01 and NOTF-02 documentation gap:** The code fully implements both requirements — notification INSERT side effects with correct guards are in `follows/route.ts` and `likes/route.ts`. However, `.planning/REQUIREMENTS.md` lines 55-56 and 134-135 still show these as `Pending` / `[ ]`. This is a documentation oversight that must be corrected.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/mobile/app.json` | `"androidGoogleMapsApiKey": "YOUR_ANDROID_MAPS_KEY"` placeholder | WARNING | Placeholder value acknowledged in SUMMARY; actual Android Maps key must be set before map screen works on Android device. Not a code stub — a configuration requirement. |
| `apps/mobile/app/(app)/map.tsx` | Dynamic `require('react-native-maps')` with fallback | INFO | The map file uses a try/catch dynamic `require` pattern to handle the case where the native module is not yet loaded (before EAS rebuild). This is a valid guard, not a stub — the real MapView is loaded when the native module is available. |

No blocking stubs found. All route handlers perform real DB queries. No `return Response.json([])` empty stubs. No hardcoded data in rendering paths.

---

## Human Verification Required

### 1. Mobile Notification Bell and NotificationsScreen (Device Verification Deferred)

**Test:** On a device/simulator with the current Expo dev build (not requiring EAS rebuild for this part), open the Profile tab and confirm the bell icon appears in the header with a red dot when notifications exist. Tap it — NotificationsScreen should push onto the stack showing notification rows. On return, confirm the red dot is cleared.

**Expected:** Bell visible in Profile header; red dot when `hasUnread=true`; NotificationsScreen shows avatar + @username + action text + relative time; dot clears after opening (read-all fired on mount).

**Why human:** Plan 05 human checkpoint was explicitly approved by the user without device testing ("mobile testing deferred by user"). This is logged in `06-05-SUMMARY.md` key-decisions. The code is correct but physical device/simulator verification was not completed.

### 2. REQUIREMENTS.md Documentation Update (NOTF-01, NOTF-02)

**Test:** Open `.planning/REQUIREMENTS.md` and change:
- Line 55: `- [ ] **NOTF-01**` → `- [x] **NOTF-01**`
- Line 56: `- [ ] **NOTF-02**` → `- [x] **NOTF-02**`
- Line 134: `| NOTF-01 | Phase 6 | Pending |` → `| NOTF-01 | Phase 6 | Complete |`
- Line 135: `| NOTF-02 | Phase 6 | Pending |` → `| NOTF-02 | Phase 6 | Complete |`

**Expected:** All 33 v1 requirements marked complete.

**Why human:** This is a documentation update requiring a human to make the change and commit it. The implementation is verified complete in code.

---

## Gaps Summary

No BLOCKER gaps found. All implementation artifacts exist, are substantive, are properly wired, and have real data flowing through them.

Two items require human action before this phase can be marked fully passed:

1. **Mobile device verification not completed** — The mobile notification bell and NotificationsScreen were implemented correctly but the human checkpoint (Plan 05, Task 3) was approved by the user without actual device testing. Requires device/simulator verification.

2. **REQUIREMENTS.md documentation not updated** — NOTF-01 and NOTF-02 are marked Pending in `.planning/REQUIREMENTS.md` even though the code fully implements both requirements. Requires a manual documentation update.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
