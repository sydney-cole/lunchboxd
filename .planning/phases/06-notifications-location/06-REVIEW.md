---
phase: 06-notifications-location
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - apps/mobile/app.json
  - apps/mobile/app/(app)/(tabs)/_layout.tsx
  - apps/mobile/app/(app)/(tabs)/search.tsx
  - apps/mobile/app/(app)/map.tsx
  - apps/mobile/app/(app)/notifications.tsx
  - apps/web/__tests__/notifications.test.ts
  - apps/web/app/(app)/layout.tsx
  - apps/web/app/(app)/map/page.tsx
  - apps/web/app/api/v1/follows/route.ts
  - apps/web/app/api/v1/likes/route.ts
  - apps/web/app/api/v1/notifications/read-all/route.ts
  - apps/web/app/api/v1/notifications/route.ts
  - apps/web/app/api/v1/notifications/unread/route.ts
  - apps/web/app/api/v1/restaurants/map/route.ts
  - apps/web/app/api/v1/restaurants/reviewed/route.ts
  - apps/web/components/notification-bell.tsx
  - packages/shared/src/schemas/index.ts
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase implements notifications (follow + like), a map view (web + mobile), and related API routes. The overall structure is sound — auth is consistently derived from Clerk sessions, schema validation is in place, and N+1 queries are avoided via batch fetching. However, there are five blocker-level issues: a hardcoded placeholder API key shipped in app.json, a race condition in the follow route that can double-insert notifications, an unbounded query in the map endpoint that can return unlimited rows, a missing token validity check in the mobile tab layout that silently exposes unauthenticated fetches, and a LIKE notification that fires even when a deleted review is liked. Six warnings cover logic gaps, missing error handling, and missing query bounds.

---

## Critical Issues

### CR-01: Hardcoded placeholder Android Maps API key in app.json

**File:** `apps/mobile/app.json:41`
**Issue:** `"androidGoogleMapsApiKey": "YOUR_ANDROID_MAPS_KEY"` is committed as a literal placeholder string. On Android the `react-native-maps` plugin reads this value and injects it into the manifest at build time. Any production EAS build will ship a non-functional but world-readable manifest entry. If a developer later substitutes a real key here instead of using an EAS secret, that key is committed to source control and exposed in every binary.
**Fix:** Remove the inline key and use an EAS secret / environment substitution instead:
```json
// app.json — pass the key via EAS secrets, not inline
[
  "react-native-maps",
  {
    "androidGoogleMapsApiKey": "$ANDROID_GOOGLE_MAPS_API_KEY"
  }
]
```
Then set `ANDROID_GOOGLE_MAPS_API_KEY` in the EAS project secrets dashboard. Never commit a real key value to this file.

---

### CR-02: Race condition in follow route causes duplicate like notifications

**File:** `apps/web/app/api/v1/follows/route.ts:31-45`
**Issue:** The follow INSERT and the notification INSERT are two separate, non-atomic statements. If two concurrent requests from the same actor reach the handler at the same time (e.g., double-tap, retry), the `onConflictDoNothing` on the follows table prevents a duplicate follow row, but the notification INSERT has no such guard and no unique constraint — it fires unconditionally after the follow attempt. The target user can receive two (or more) "X followed you" notifications from a single logical follow action.
**Fix:** Add a unique index on `(userId, type, actorId)` for `follow`-type notifications in the schema (filtering out `like` to avoid blocking multiple likes over time), or wrap the follow + notification INSERT in a CTE/transaction and check whether a row was actually inserted:
```ts
// Only insert the notification when a follow row was actually created
const inserted = await db.insert(follows)
  .values({ followerId: actorUserId, followeeId: targetUserId })
  .onConflictDoNothing()
  .returning({ id: follows.id })

if (inserted.length > 0 && targetUserId !== actorUserId) {
  await db.insert(notifications).values({
    userId: targetUserId,
    type: 'follow',
    actorId: actorUserId,
  })
}
```

---

### CR-03: Unbounded query on /api/v1/restaurants/map — no row limit

**File:** `apps/web/app/api/v1/restaurants/map/route.ts:25-61`
**Issue:** The query fetches every reviewed restaurant with coordinates in a single SELECT with no LIMIT clause. As the dataset grows this will return thousands of rows serialized as JSON, consuming significant memory on the serverless worker and bandwidth on every map load. More critically, `selectDistinct` does not deduplicate at the DB level before in-process deduplication — the result set returned from Postgres can be `O(reviews)` not `O(restaurants)`, potentially large even early in growth.
**Fix:** Add a reasonable hard cap (e.g., 500 pins) and document the limitation, or switch to a viewport-bounded query that accepts `lat/lng/radius` parameters:
```ts
.limit(500) // Hard cap — map is decorative at this scale; add viewport query in a follow-up
```

---

### CR-04: Like notification fires on a deleted review

**File:** `apps/web/app/api/v1/likes/route.ts:41-56`
**Issue:** The review ownership lookup at line 41 does not filter `WHERE deletedAt IS NULL`. A user can like a review that has been soft-deleted (the likes table has no such guard either), and the notification INSERT will fire for the review owner. This leaks the existence of a deleted review to its owner via a notification, and creates a like record on a deleted entity.
**Fix:** Add the `deletedAt` guard to the review lookup:
```ts
const [review] = await db
  .select({ userId: reviews.userId })
  .from(reviews)
  .where(and(eq(reviews.id, reviewId), isNull(reviews.deletedAt)))

// If review is null here, the like target is deleted — return 404
if (!review) {
  return NextResponse.json({ error: 'Review not found' }, { status: 404 })
}
```

---

### CR-05: Mobile bell query proceeds with null token silently

**File:** `apps/mobile/app/(app)/(tabs)/_layout.tsx:16-26`
**Issue:** `getToken()` can return `null` when the Clerk session has expired or the user is not authenticated. The code calls `res.json()` unconditionally on the response that is sent with `Authorization: Bearer null`. Depending on the API's auth middleware behavior this may return a 401 whose body is `{ error: 'Unauthorized' }` — this is then parsed as `{ hasUnread: boolean }` without error checking, and `data?.hasUnread` silently evaluates to `undefined` → `false`. The dot is non-functional, but the absence of error handling masks auth failures and will cause confusing UX if the token refresh fails silently.
**Fix:** Check the response status before parsing, and omit the header if the token is null:
```ts
queryFn: async () => {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${API_BASE_URL}/api/v1/notifications/unread`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to check unread status')
  return res.json()
},
```

---

## Warnings

### WR-01: Unbounded query on /api/v1/restaurants/reviewed — no row limit

**File:** `apps/web/app/api/v1/restaurants/reviewed/route.ts:45-57`
**Issue:** Like the map endpoint (CR-03), this query has no LIMIT. A search for a single common letter (e.g., `q=a`) will match most restaurants and return the full result set. The `restaurantReviewedQuerySchema` enforces a max of 100 chars on `q` but not a minimum length, so an empty or single-character search returns everything. Combined with no pagination, this is an unbounded read that will degrade under load.
**Fix:** Add a `.limit(200)` hard cap or implement cursor pagination consistent with the notifications endpoint. Also consider enforcing a minimum query length of 2 characters in the schema (matching `userSearchSchema`).

---

### WR-02: Cursor-based pagination is not stable under concurrent notification inserts

**File:** `apps/web/app/api/v1/notifications/route.ts:29-49`
**Issue:** The cursor is the `createdAt` timestamp of the last item returned (`pageRows[pageRows.length - 1].createdAt.toISOString()`). If two notifications are created at the same millisecond (e.g., batch like events), items with identical timestamps will be skipped or duplicated when the cursor lands exactly on that timestamp because `lt(notifications.createdAt, cursor)` is strictly less-than. This is a classic timestamp-cursor instability.
**Fix:** Use a UUID cursor (the notification `id`) rather than a timestamp, consistent with `followListQuerySchema` which uses `z.string().uuid()` for its cursor. Alternatively use composite `(createdAt DESC, id DESC)` ordering with a compound cursor.

---

### WR-03: Notification type is an unvalidated free-text column

**File:** `apps/web/lib/schema.ts:108`, used in `apps/web/app/api/v1/follows/route.ts:39` and `apps/web/app/api/v1/likes/route.ts:51`
**Issue:** The `type` column is `text('type').notNull()` — a free-text field. Both insert sites use string literals `'follow'` and `'like'`, but there is no database-level enum or application-level type guard preventing insertion of arbitrary type values. The API returns `type` directly to clients; client code in `notification-bell.tsx` and `notifications.tsx` performs string equality checks against `'follow'` and `'like'` that would silently fall through for any other value.
**Fix:** Use a Postgres enum or add a Zod union constraint at the insert layer:
```ts
// In schema.ts — replace text('type') with an enum column
type: text('type', { enum: ['follow', 'like'] }).notNull(),
```

---

### WR-04: read-all PATCH does not return the count of rows updated

**File:** `apps/web/app/api/v1/notifications/read-all/route.ts:16-20`
**Issue:** The handler returns `{ ok: true }` regardless of whether any rows were updated. Both callers (web `notification-bell.tsx` and mobile `notifications.tsx`) immediately call `queryClient.invalidateQueries` after the PATCH without checking the response. The missing check is not a crash risk, but if the PATCH fails silently (network error, Drizzle throws), the `invalidateQueries` call still fires and re-fetches, which re-renders the badge as "no unread" even though the server-side update failed. The mobile handler wraps nothing in try/catch, so any DB error propagates as an unhandled rejection.
**Fix:** Wrap the DB call and propagate the error:
```ts
try {
  await db.update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  return NextResponse.json({ ok: true })
} catch {
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

---

### WR-05: Stale `isLast` prop check breaks if sentinel renders inside the list

**File:** `apps/web/components/notification-bell.tsx:200-208`
**Issue:** `NotificationRow` receives `isLast={idx === allItems.length - 1}` to omit the bottom border on the last item. The sentinel `<li ref={sentinelRef} />` is rendered after the mapped items (line 208), so when there are more pages the bottom-border-removal on the last visible item is correct. However, after all pages are loaded and the sentinel is still present as a zero-height `<li>`, the last notification item will have its bottom border removed while the sentinel sits below it — visually this is likely fine, but it creates a subtle layout inconsistency. More importantly, `isLast` is evaluated at render time against the current `allItems` snapshot; once a new page loads and more items are appended, previously rendered rows do not re-render to restore their borders because React does not diff unchanged props. In practice this means intermediate items may permanently lack bottom borders after pagination.
**Fix:** Apply the bottom border unconditionally on each row and use CSS `last-child` to suppress the final border instead:
```tsx
className={`flex items-center gap-2 px-4 py-3 border-b border-border ${item.read ? '' : 'border-l-2 border-accent'}`}
// Remove the isLast prop entirely; add CSS: last:border-b-0 to the <li>
```

---

### WR-06: eslint-disable comment suppresses legitimate dependency warning in notifications.tsx (mobile)

**File:** `apps/mobile/app/(app)/notifications.tsx:108`
**Issue:** `// eslint-disable-line react-hooks/exhaustive-deps` suppresses the warning that `getToken` and `queryClient` are missing from the `useEffect` dependency array. `getToken` is a stable reference from Clerk and `queryClient` is stable from `useQueryClient`, so in practice this is safe. However, if `getToken` ever becomes unstable (e.g., after a package upgrade), the effect will not re-run, silently preventing the read-all call from using a fresh token. The suppress comment masks this fragility.
**Fix:** Add the stable dependencies explicitly rather than suppressing the lint rule:
```ts
useEffect(() => {
  // ...markRead body unchanged...
}, [getToken, queryClient])
```

---

## Info

### IN-01: Magic number `40.7128, -74.006` (New York) hardcoded as default map center

**File:** `apps/web/app/(app)/map/page.tsx:89`, `apps/mobile/app/(app)/map.tsx:112`
**Issue:** Both web and mobile map views default to New York City coordinates as the initial map region. This is fine for a hardcoded default but should be a named constant defined once in shared config to avoid drift between the two implementations and to make the default easy to change.
**Fix:** Extract to a shared constant:
```ts
// packages/shared/src/constants.ts
export const DEFAULT_MAP_CENTER = { lat: 40.7128, lng: -74.006 }
```

---

### IN-02: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!` non-null assertion with no fallback or env check

**File:** `apps/web/app/(app)/map/page.tsx:85`
**Issue:** The `!` assertion tells TypeScript the value is always defined, but if the environment variable is missing the value will be `undefined` at runtime, the `APIProvider` will receive `apiKey={undefined}`, and the map will fail silently with an auth error in the browser console — with no user-visible fallback UI.
**Fix:** Add a guard and render a fallback:
```tsx
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
if (!apiKey) {
  return <div>Map unavailable — Google Maps API key not configured.</div>
}
// ...then use apiKey (no !)
```

---

### IN-03: Stale comment artifact left in search.tsx

**File:** `apps/mobile/app/(app)/(tabs)/search.tsx:58`
**Issue:** Line 58 contains `// CRITICAL: getToken() inside queryFn (Pitfall 6)`. This is a development-time planning note, not a production code comment. It will confuse future readers who will try to find "Pitfall 6" with no reference document in the repo.
**Fix:** Remove the comment entirely. The pattern is correct; no comment is needed.

---

### IN-04: Android `package` identifier not set in app.json

**File:** `apps/mobile/app.json:23-30`
**Issue:** The `android` section does not include a `"package"` field. Without it, EAS Build derives the package name from the `slug` field, resulting in `com.mobile` — a generic identifier that will conflict on the Google Play Store and may cause issues with Google Maps key restrictions tied to a package name. The iOS `bundleIdentifier` is set to `com.sydneyco.mobile`, but the Android equivalent is missing.
**Fix:** Add an explicit `package` field:
```json
"android": {
  "package": "com.sydneyco.mobile",
  "adaptiveIcon": { ... },
  ...
}
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
