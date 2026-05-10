# Lunchboxd Codebase — Bug Review

**Reviewed:** 2026-04-29  
**Scope:** All API routes, lib/, web pages, web components, shared package, mobile screens/components  
**Status:** Issues found

---

## CRITICAL Issues

---

### CR-01: Mobile `photo-picker.tsx` sends wrong request format — upload will always fail

**File:** `apps/mobile/components/photo-picker.tsx:39-52`

The mobile `PhotoPicker` sends `Content-Type: application/json` with a JSON body containing only `{ contentType }`:

```ts
const uploadRes = await fetch(`${API_BASE_URL}/api/v1/uploads`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ contentType }),
})
const { uploadUrl, key } = await uploadRes.json() as { uploadUrl: string; key: string }
```

The server route (`apps/web/app/api/v1/uploads/route.ts`) expects `multipart/form-data` with the actual file binary:

```ts
const formData = await req.formData()
const file = formData.get('file') as File | null
if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
```

The server also returns `{ url, key }` (not `{ uploadUrl, key }`). The mobile code then tries to PUT the file to `uploadUrl` which is `undefined`, so the second fetch hits `undefined` as a URL, crashing at runtime. Every mobile photo upload fails with a runtime error. The entire mobile photo flow is completely broken.

**Fix:** The mobile `PhotoPicker` must send a `multipart/form-data` request with the actual file blob, matching the web implementation. Example:

```ts
const formData = new FormData()
formData.append('file', {
  uri: asset.uri,
  name: asset.fileName ?? 'photo.jpg',
  type: contentType,
} as any)
formData.append('type', 'review')
const uploadRes = await fetch(`${API_BASE_URL}/api/v1/uploads`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
})
const { url, key } = await uploadRes.json()
```

---

### CR-02: Mobile `RestaurantSearch` sends unauthenticated requests — returns 401 silently swallowed

**File:** `apps/mobile/components/restaurant-search.tsx:38` and `apps/mobile/components/restaurant-search.tsx:86-90`

The mobile `RestaurantSearch` makes requests to `/api/v1/restaurants/search` and `POST /api/v1/restaurants` without an Authorization header. Both endpoints require authentication (`auth()` check). The 401 response from the search endpoint is swallowed as a generic error message ("Restaurant search unavailable"), and the `POST /api/v1/restaurants` (manual entry) call will silently fail with a 401 as well, preventing manual restaurant creation.

Unlike the web component which relies on cookie-based Clerk session, the mobile client must pass a Bearer token. The component has no mechanism to receive `getToken` unlike `PhotoPicker` does:

```ts
const res = await fetch(`${API_BASE_URL}/api/v1/restaurants/search?q=${encodeURIComponent(q)}`)
// No Authorization header
```

**Fix:** Add `onGetToken: () => Promise<string | null>` prop to `RestaurantSearch`, call it before each fetch, and include `Authorization: Bearer ${token}` headers.

---

### CR-03: `webhooks/clerk/route.ts` hard-deletes user row, cascading to all user data

**File:** `apps/web/app/api/v1/webhooks/clerk/route.ts:73-75`

When Clerk fires `user.deleted`, the handler deletes the user row from the `users` table:

```ts
await db.delete(users).where(eq(users.clerkId, event.data.id))
```

The schema has `reviews.userId` referencing `users.id` with a foreign key, but without `ON DELETE CASCADE` in the schema definition (only `references(() => users.id)` with no action clause). PostgreSQL defaults to `RESTRICT` for foreign key violations without an explicit action. This means the DELETE will **fail at the database level with a foreign key constraint violation** when the user has any reviews, follows, or other related rows. The error is unhandled and bubbles up uncaught, causing the webhook to return a 500 (or unhandled rejection), which will cause Clerk to retry the webhook repeatedly.

Additionally, even if cascade were in place, silently hard-deleting all reviews on account deletion destroys data with no soft-delete safety net.

**Fix:** Either (a) soft-delete the user row and cascade soft-deletes to their content, or (b) wrap the delete in a transaction that first removes all dependent rows in order, or (c) add proper `onDelete: 'cascade'` to all FK references in the schema. The webhook handler must also return a proper error response instead of throwing.

---

### CR-04: `follows/route.ts` — `userStats` counter is double-incremented when follow already exists

**File:** `apps/web/app/api/v1/follows/route.ts:31-78`

The `POST` handler inserts a follow row with `onConflictDoNothing()` to be idempotent, then checks `inserted.length > 0` to gate the notification insert. However, the `userStats` upsert for `followingCount` and `followerCount` is **not gated** by `inserted.length > 0` — it runs unconditionally:

```ts
const inserted = await db.insert(follows)
  .values({ followerId: actorUserId, followeeId: targetUserId })
  .onConflictDoNothing()
  .returning({ id: follows.id })

// Notification correctly gated on inserted.length > 0 ✓

// Stats upserts NOT gated — run on every POST even if already following ✗
await db.insert(userStats)
  .values({ userId: actorUserId, followingCount: '1', followerCount: '0' })
  .onConflictDoUpdate({
    target: userStats.userId,
    set: { followingCount: sql`${userStats.followingCount} + 1`, updatedAt: new Date() },
  })
```

Each repeated follow POST increments the `followingCount` and `followerCount` without a corresponding follow row being created, corrupting the counters permanently.

**Fix:** Wrap the stats upserts in `if (inserted.length > 0) { ... }` just like the notification insert.

---

### CR-05: `follows/route.ts` DELETE — `userStats` decrements even when follow didn't exist

**File:** `apps/web/app/api/v1/follows/route.ts:100-144`

The `DELETE` handler runs the stats decrement unconditionally regardless of whether a follow row actually existed:

```ts
await db.delete(follows)
  .where(and(eq(follows.followerId, actorUserId), eq(follows.followeeId, targetUserId)))

// No check on how many rows were deleted before proceeding to decrement stats
await db.insert(userStats)
  ...
  .onConflictDoUpdate({
    set: { followingCount: sql`GREATEST(${userStats.followingCount} - 1, 0)`, ... }
  })
```

Calling `DELETE /api/v1/follows` multiple times (or for a non-existent follow) drives `followingCount` and `followerCount` toward 0 regardless of their true value.

**Fix:** Use `.returning()` on the DELETE to check whether a row was actually deleted, and only run the stat decrements if a row was removed.

---

### CR-06: `feed/route.ts` — feed queries only the current user's own items, not followed users' items

**File:** `apps/web/app/api/v1/feed/route.ts:29-34`

The WHERE clause for the feed query is:

```ts
const whereClause = cursor
  ? and(
      eq(feedItems.ownerUserId, userId),        // ← only own feed items
      lt(feedItems.createdAt, new Date(cursor))
    )
  : eq(feedItems.ownerUserId, userId)           // ← only own feed items
```

This correctly uses the fan-out design: `feedItems` stores one row per follower per review, so querying `ownerUserId = me` should return both the user's own reviews and reviews from people they follow. **However**, the `fanOutToFollowers` function in `queries.ts` inserts a feed row for the author AND each follower. The feed query correctly filters by `ownerUserId`. This is structurally correct.

**Re-classification after full trace:** This is not a bug. However, a related issue is that when a user is deleted (`user.deleted` webhook), the `feedItems` rows owned by other users that reference that deleted user's reviews remain in the DB (since the DELETE handler only deletes the `users` row), but this is a consequence of CR-03.

---

### CR-07: `reviews/[id]/route.ts` GET — ownership check prevents reading others' public reviews

**File:** `apps/web/app/api/v1/reviews/[id]/route.ts:21-24`

The `GET /api/v1/reviews/:id` route filters by **both** `id` AND `userId`:

```ts
const [review] = await db.select().from(reviews)
  .where(and(eq(reviews.id, id), eq(reviews.userId, userId), isNull(reviews.deletedAt)))
```

This means a user can only fetch their own reviews by ID. The edit page (`reviews/[id]/edit/page.tsx`) calls this endpoint at line 27 to pre-populate the form. This works for the owner. But if the API is ever called for a review not owned by the caller (e.g. from mobile or any other context wanting to view a review detail), it will incorrectly return 404. More critically, there is **no public review detail endpoint** — profiles show reviews via the `/api/v1/users/[username]/reviews` endpoint, but there is no way to fetch a specific review by ID for a non-owner viewer. This is a missing feature that becomes a correctness bug when the mobile app or other consumer tries to deep-link to a specific review.

---

### CR-08: `restaurants/search/route.ts` — Google Places results upserted without `.returning()` properly handled; `undefined` rows passed to response

**File:** `apps/web/app/api/v1/restaurants/search/route.ts:46-65`

```ts
const upserted = await Promise.all(
  places.slice(0, 5).map(async (p: any) => {
    const [row] = await db.insert(restaurants).values({...})
      .onConflictDoUpdate({...})
      .returning()
    return row
  })
)
```

When `onConflictDoUpdate` is used, `returning()` on Drizzle with the Neon HTTP driver should return the upserted row. However, `row` is destructured from the first element of the array — if the array is empty for any reason, `row` is `undefined`. These `undefined` values are then spread into the `upserted` array and returned in the JSON response:

```ts
const upsertedIds = new Set(upserted.map(r => r.id))  // r.id on undefined → TypeError
```

If any individual upsert returns empty (e.g., driver quirk), `upserted.map(r => r.id)` throws `TypeError: Cannot read properties of undefined`. This crashes the request handler with an unhandled exception.

**Fix:** Filter out undefined rows: `const upserted = results.filter(Boolean)` after the Promise.all.

---

### CR-09: `users/route.ts` — username uniqueness constraint violation returns 500, not 409

**File:** `apps/web/app/api/v1/users/route.ts:24-34`

The endpoint upserts on `clerkId` conflict, but the `username` column also has a unique constraint. If a user attempts to claim a username already taken by another user (different `clerkId`), the database throws a unique constraint violation on `users.username`. There is no try/catch around the `db.insert()` call, so this propagates as an unhandled exception — Next.js returns a 500 instead of a 409. The client in `setup-username/page.tsx` at line 44 explicitly handles status 409 to show "That username is already taken" — but it can never receive a 409 from this endpoint:

```ts
// setup-username/page.tsx line 44
} else if (res.status === 409) {
  setError('That username is already taken. Try another.')
```

**Fix:** Wrap the `db.insert()` in try/catch, detect the unique constraint violation (e.g., check `error.code === '23505'`), and return `{ status: 409 }`.

---

### CR-10: `likes/route.ts` — like is inserted before review existence is verified; orphan like possible under race condition

**File:** `apps/web/app/api/v1/likes/route.ts:36-51`

The flow is:
1. Check for existing like (line 26-29)
2. If no existing like: insert the like (line 36-38)
3. Then fetch the review to check it exists and get the owner (line 42-46)
4. If review not found, return 404 (line 49-50) — **but the like row was already inserted in step 2**

```ts
await db.insert(likes)
  .values({ userId: actorUserId, reviewId })
  .onConflictDoNothing()

const [review] = await db
  .select({ userId: reviews.userId })
  .from(reviews)
  .where(and(eq(reviews.id, reviewId), isNull(reviews.deletedAt)))

if (!review) {
  return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  // Like row still exists in DB — orphaned
}
```

A like row pointing to a soft-deleted review is orphaned in the database. On the next toggle call it would be treated as an existing like and deleted, leading to incorrect toggle behavior.

**Fix:** Check review existence before inserting the like, or perform both operations in a transaction. Move the review existence check to before the `db.insert(likes)`.

---

## HIGH Issues

---

### HI-01: `follow-button.tsx` (web) — `currentState` is always `initialState`; button label never reflects mutation result

**File:** `apps/web/components/follow-button.tsx:31-48`

```ts
const currentState = initialState   // ← never updated
```

The component reads `currentState` from `initialState` (a prop) with no local state. After a successful follow/unfollow mutation, `onSuccess` invalidates `['user-search']` queries, but the profile page's `FollowButton` is rendered with a hardcoded `initialState="none"`:

```ts
// [username]/page.tsx:229
<FollowButton targetUserId={user.id} initialState="none" />
```

After a successful follow, the button never visually updates to "Following" because `currentState` is always the prop value and there is no optimistic local state. The query invalidation on `['user-search']` doesn't help for the profile page since it uses a different query key. From the user's perspective, clicking "Follow" shows "..." briefly then snaps back to "Follow".

**Fix:** Add local state: `const [state, setState] = useState(initialState)` and update it in `onSuccess` with the `followState` returned from the API.

---

### HI-02: `[username]/page.tsx` profile — all reviews show edit/delete menu for non-owners

**File:** `apps/web/app/(app)/[username]/page.tsx:271`

`isOwnReview` is passed as `isOwner` — a single boolean for the entire list:

```ts
isOwnReview={isOwner}
```

`isOwner` is `true` when the viewer is the profile owner, so all reviews on the viewer's own profile correctly show the kebab menu. But in `review-card.tsx`, the condition for showing the kebab menu is:

```ts
{isOwnReview !== false && (
  <div ... >  {/* kebab menu */}
```

This means `isOwnReview={undefined}` (when the prop is omitted) also shows the menu, because `undefined !== false` is `true`. In the profile page, `isOwner` is always a boolean, so this is fine. However the real problem is that when `isOwner === true`, **every** review on the page shows an edit/delete menu — this is correct. When `isOwner === false`, no review shows the menu — also correct. This is actually fine by the current boolean logic.

**Re-assessment:** The actual bug here is the `onEdit` and `onDelete` callbacks are both `() => {}` (no-ops) in the profile page:

```ts
onEdit={() => {}}
onDelete={() => {}}
```

For the profile owner, clicking "Edit" does nothing (no navigation to the edit page). This is a broken UX for own-profile review management.

**Fix:** Replace the no-op handlers with proper navigation:
```ts
onEdit={(id) => router.push(`/reviews/${id}/edit`)}
onDelete={(id) => setDeleteTarget(id)}
```
and add a `DeleteDialog` to the profile page.

---

### HI-03: `feed/page.tsx` — `onEdit` and `onDelete` in feed are no-ops; feed items cannot be edited or deleted

**File:** `apps/web/app/(app)/page.tsx:198-199`

```ts
onEdit={() => {}}
onDelete={() => {}}
```

For `isOwnReview` items in the feed, the kebab menu is shown but both actions do nothing. Users see an Edit and Delete option that silently fail.

**Fix:** Same as HI-02 — wire up handlers. For the feed, `isOwnReview` is per-item, so each card needs `onEdit={(id) => router.push(...)}` and an inline delete confirmation.

---

### HI-04: `fanOutToFollowers` — duplicate `feedItems` rows inserted on retry; fan-out has no idempotency guard

**File:** `apps/web/lib/queries.ts:17-37`

```ts
await db.insert(feedItems).values(feedRows)
```

There is no `onConflictDoNothing()` on this insert. If `fanOutToFollowers` is called twice for the same review (e.g., network retry, error recovery, or a bug), duplicate rows are inserted into `feedItems`. The `feedItems` table has no unique index on `(ownerUserId, reviewId)`. This results in duplicate feed entries for the same review appearing in users' feeds.

**Fix:** Add a unique index on `(ownerUserId, reviewId)` in the schema and add `.onConflictDoNothing()` to the insert in `fanOutToFollowers`.

---

### HI-05: `followers/route.ts` and `following/route.ts` — cursor pagination uses UUID comparison with `gt()`, not stable ordering

**File:** `apps/web/app/api/v1/users/[username]/followers/route.ts:38-41`  
**File:** `apps/web/app/api/v1/users/[username]/following/route.ts:38-41`

```ts
const conditions = [
  eq(follows.followeeId, profileUser.id),
  ...(cursor ? [gt(users.id, cursor)] : []),
]
```

The query uses `gt(users.id, cursor)` as a cursor, but there is no `ORDER BY users.id` clause in the query. Without an explicit `ORDER BY`, the database can return rows in any order, making UUID cursor-based pagination **non-deterministic**. Pages may overlap, skip rows, or return the same rows repeatedly. There is also no `.orderBy()` call in either route.

**Fix:** Add `.orderBy(asc(users.id))` to both queries to ensure deterministic ordering for the cursor.

---

### HI-06: `[username]/page.tsx` profile page — `isOwner` passed to `FollowButton` with `initialState="none"` always; no follow state fetched for the viewed profile

**File:** `apps/web/app/(app)/[username]/page.tsx:229`

```ts
<FollowButton targetUserId={user.id} initialState="none" />
```

The profile API (`GET /api/v1/users/[username]`) does not return the viewer's current follow state for the profile being viewed. So `initialState` is hardcoded to `"none"` for every non-owner visit. If a viewer already follows a user and navigates to their profile, the button shows "Follow" (the wrong state) instead of "Following" or "Friends". Clicking it would then issue a follow request when the user intends to unfollow.

**Fix:** Either include a `followState` field in the `GET /api/v1/users/[username]` response (when the viewer is authenticated), or add a separate query on the profile page to check follow state.

---

### HI-07: `mealDate` in mobile compose is a free-text input with no validation

**File:** `apps/mobile/app/(app)/(tabs)/compose.tsx:180-189`

```tsx
<TextInput
  style={styles.dateInput}
  value={mealDate}
  onChangeText={setMealDate}
  placeholder="YYYY-MM-DD"
  keyboardType="numbers-and-punctuation"
  maxLength={10}
/>
```

The `mealDate` field is a raw `TextInput`. The shared `reviewSchema` validates it with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`. A user can type any 10-character string (e.g., `"AAAA-BB-CC"`) and the form will attempt to submit it. The server will then return a 400 validation error, but the client shows only the generic "Something went wrong" message with no indication of what field failed.

**Fix:** Add client-side validation before submission: check that `mealDate` matches `/^\d{4}-\d{2}-\d{2}$/` and show a field-level error if it doesn't. Use a date picker component instead of free text.

---

### HI-08: `notifications/route.ts` — `read` status not updated when notifications are fetched; `read-all` is fire-and-forget on open

**File:** `apps/web/components/notification-bell.tsx:102-111`

```ts
const handleOpen = useCallback(async () => {
  setIsOpen(true)
  try {
    await fetch('/api/v1/notifications/read-all', { method: 'PATCH' })
  } catch {
    // non-critical — badge will clear on next poll
  }
  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
}, [queryClient])
```

The `read-all` PATCH is awaited before invalidating `notifications-unread`, but the `notifications` list query itself is NOT invalidated after marking all read. So the notification panel opens, marks everything read on the server, but the displayed items still show `read: false` (unread styling — border-l-2) until the next stale-time expiry (30s). Users see stale unread indicators.

**Fix:** Also invalidate `['notifications']` after the PATCH:
```ts
queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
queryClient.invalidateQueries({ queryKey: ['notifications'] })
```

---

### HI-09: `restaurants/map/route.ts` — `selectDistinct` on columns including `reviewUserId` defeats deduplication intent

**File:** `apps/web/app/api/v1/restaurants/map/route.ts:26-41`

```ts
const reviewedRows = await db
  .selectDistinct({
    id: restaurants.id,
    name: restaurants.name,
    lat: restaurants.lat,
    lng: restaurants.lng,
    reviewUserId: reviews.userId,   // ← distinct on ALL selected columns
  })
  .from(restaurants)
  .innerJoin(reviews, eq(reviews.restaurantId, restaurants.id))
  .where(...)
  .limit(500)
```

`selectDistinct` in SQL means `DISTINCT ON (all selected columns)`. Including `reviewUserId` means each unique `(restaurantId, reviewUserId)` pair is its own row. A restaurant with 3 reviewers produces 3 rows — exactly what the post-query JS deduplication loop handles. But the `.limit(500)` cap applies before deduplication, so a restaurant with many reviews could exhaust the 500-row budget with rows from one restaurant, causing other restaurants to be silently dropped from the map.

**Fix:** Use a subquery or `DISTINCT ON (restaurants.id)` to get one row per restaurant. In Drizzle, this may require raw SQL or restructuring the query to group by restaurant.

---

## MEDIUM Issues

---

### ME-01: `uploads/route.ts` — no file size limit enforced server-side; `CLAUDE.md` stack uses Vercel Blob, not Cloudflare R2

**File:** `apps/web/app/api/v1/uploads/route.ts:1`

The upload handler uses `@vercel/blob` (`import { put } from '@vercel/blob'`). The stack document and `CLAUDE.md` specify Cloudflare R2 as the storage layer. This is an implementation that diverges from the specified architecture. Additionally, there is no server-side file size check — only the web client's `PhotoPicker` enforces the 10MB limit client-side. A mobile client (or direct API call) can upload arbitrarily large files.

**Fix:** Add a server-side size check before calling `put()`. If migrating to Cloudflare R2, replace with the S3-compatible SDK.

---

### ME-02: `db.ts` — `DATABASE_URL!` non-null assertion crashes server on missing env var with opaque error

**File:** `apps/web/lib/db.ts:5`

```ts
const sql = neon(process.env.DATABASE_URL!)
```

Using the non-null assertion `!` means that if `DATABASE_URL` is missing, `neon(undefined)` is called, which will throw an error only when the first query is attempted — not at startup. The error will be confusing (something like "Invalid connection string: undefined") rather than clearly identifying the missing environment variable.

**Fix:**
```ts
if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL environment variable')
const sql = neon(process.env.DATABASE_URL)
```

---

### ME-03: `reviews/route.ts` GET — returns all `deletedAt: null` reviews but also exposes `userId` and internal fields to the client

**File:** `apps/web/app/api/v1/reviews/route.ts:78-79`

```ts
const userReviews = await db.select().from(reviews)
  .where(and(eq(reviews.userId, userId), isNull(reviews.deletedAt)))
```

`db.select()` without a projection selects all columns, including `userId` (internal UUID), `updatedAt`, and `deletedAt` (null). These are then spread into the response. While this endpoint is auth-gated to the current user, the response shape leaks internal IDs and fields that the client shouldn't need. This is also a type contract issue: `deletedAt` is always `null` here but typed as `Date | null` in the shared types.

---

### ME-04: `review-composer.tsx` — sends full `CreateReviewInput` schema for PATCH (edit) instead of `UpdateReviewInput`

**File:** `apps/web/components/review-composer.tsx:77-99`

In edit mode the composer builds a `CreateReviewInput` payload (all fields populated):

```ts
const payload: CreateReviewInput = {
  mealType,
  restaurantId: mealType === 'restaurant' && restaurant ? restaurant.id : null,
  rating,
  note: note.trim() || undefined,
  photoKey: photoKey || null,
  tags,
  mealDate: mealDate || null,
}
```

And sends it via `PATCH`. The server validates with `updateReviewSchema` which is `reviewSchema.partial()`. Since all fields are sent (not just changed fields), this works correctly. However, `rating` is included even when unchanged. More critically, `photoKey` is sent as the existing `photoUrl` value (from `initialData?.photoKey ?? null`) but the server code on PATCH expects it to be either a new upload key or `null` for "remove photo". The edit page passes the existing `photoUrl` as `photoKey`:

```ts
// reviews/[id]/edit/page.tsx:83
photoKey: review.photoUrl ?? null,
```

But `review.photoUrl` is a full URL (e.g., `https://blob.vercel-storage.com/reviews/clerkId/uuid`), not a key in the format `reviews/<clerkId>/<uuid>`. The PATCH handler then validates this against the `photoKeyPattern`:

```ts
const photoKeyPattern = /^reviews\/[a-zA-Z0-9_-]+\/[0-9a-f-]{36}$/
if (!photoKeyPattern.test(input.photoKey)) {
  return NextResponse.json({ error: 'Invalid photoKey format' }, { status: 400 })
}
```

A full URL like `https://...` will fail this regex. **The edit flow will always return a 400 if the user has an existing photo and doesn't change it.**

**Fix:** The edit page `initialData` should pass `null` for `photoKey` (not the URL) and track whether the photo was changed. Alternatively, the schema should distinguish between "no change to photo" (omit `photoKey`), "remove photo" (`photoKey: null`), and "new photo" (`photoKey: "reviews/..."` ).

---

### ME-05: `photo-picker.tsx` (web) — `previewUrl` object URL is revoked prematurely on re-render

**File:** `apps/web/components/photo-picker.tsx:21-25`

```ts
useEffect(() => {
  return () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }
}, [previewUrl])
```

The cleanup runs when `previewUrl` changes. When `previewUrl` transitions from `null` → `objectUrl`, the cleanup of the new effect runs when the *next* value of `previewUrl` is set. This is correct. However, if the component unmounts during upload (user navigates away), the cleanup fires and revokes the URL while the `<img>` may still be rendering it, causing a broken image flash. The more serious issue is this pattern creates a race where the revocation of the previous URL fires synchronously on state update before the new `<img>` tag with the new URL renders.

---

### ME-06: `restaurants/search/route.ts` — race condition between local cache check and Google Places upsert

**File:** `apps/web/app/api/v1/restaurants/search/route.ts:14-73`

Two concurrent search requests for the same query `q` can both find `cached.length < 5`, both call the Google Places API, and both attempt to upsert the same `placeId`. The `onConflictDoUpdate` handles duplicates at the DB level, but the upserted rows returned by the two concurrent requests may diverge (one gets updated data, one gets stale). The merged response (line 70-72) can return up to 10 results instead of 5 if both concurrent caches are merged incorrectly. This is a correctness issue (wrong count) rather than a crash.

---

### ME-07: `setup-username/page.tsx` — minimum username length not validated client-side or server-side

**File:** `apps/web/app/setup-username/page.tsx:16-19`  
**File:** `apps/web/app/api/v1/users/route.ts:16`

The client validates:
- Not empty
- Matches `^[a-zA-Z0-9_]+$`
- Max 30 chars

The server validates:
- Not empty + regex + max 30

Neither enforces a minimum length (e.g., 2 or 3 characters). A user can create a username of `"a"`, potentially colliding with reserved paths or short identifiers. The shared `signUpSchema` also has `min(1)` only.

---

### ME-08: `notifications/route.ts` — soft-deleted reviews' restaurant names are still fetched and returned in notifications

**File:** `apps/web/app/api/v1/notifications/route.ts:68-86`

When fetching restaurant names for like notifications, the query does NOT filter `isNull(reviews.deletedAt)`:

```ts
const reviewRows = await db
  .select({ id: reviews.id, restaurantId: reviews.restaurantId })
  .from(reviews)
  .where(inArray(reviews.id, reviewIds))
  // No isNull(reviews.deletedAt) filter
```

Notifications for likes on since-deleted reviews will still display the restaurant name (pulled from the deleted review). The deleted review's `restaurantId` is still in the DB row, so this works but produces potentially confusing notification text: "X liked your review of [Restaurant]" for a review that no longer exists.

---

### ME-09: `[username]/page.tsx` — profile stats use string type for numeric fields; UI renders raw string

**File:** `apps/web/app/(app)/[username]/page.tsx:205-210`

The `ProfileStats` type declares:
```ts
interface ProfileStats {
  followerCount: string
  followingCount: string
  reviewCount: string
}
```

These are raw `numeric` strings from Drizzle (e.g., `"42"`, `"0"`). They are rendered directly as `{stats.followerCount}` in the UI. While this works for whole numbers, if `avgRating` or other numeric fields were ever included, they could display as `"4.50"` instead of `"4.5"`. More importantly, the stats comparison `stats ?? { followerCount: '0', followingCount: '0', reviewCount: '0' }` means a user with no `userStats` row shows all zeros — but `reviewCount` in `userStats` is never incremented anywhere in the codebase. There is no code that increments `userStats.reviewCount` when a review is created.

**Fix:** Increment `userStats.reviewCount` in `POST /api/v1/reviews` after creating a review, and decrement it in `DELETE /api/v1/reviews/[id]`.

---

## LOW Issues

---

### LO-01: `tag-input.tsx` — duplicate tags can be added with different casing

**File:** `apps/web/components/tag-input.tsx:15-20`

```ts
const commitTag = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return
  if (!tags.includes(trimmed)) {  // ← case-sensitive comparison
    onChange([...tags, trimmed])
  }
}
```

The server normalizes tags with `label.toLowerCase().trim()` but the client checks `tags.includes(trimmed)` with case-sensitive equality. A user can add both "Spicy" and "spicy" as separate tags in the UI; the server will store two identical lowercase "spicy" tags.

**Fix:** Normalize client-side: `const trimmed = raw.trim().toLowerCase()`.

---

### LO-02: `review-card.tsx` — `checkClamped` runs only once on mount; doesn't recheck on window resize

**File:** `apps/web/components/review-card.tsx:52-54`

```ts
useEffect(() => {
  checkClamped()
}, [checkClamped])
```

`checkClamped` is called once when the component mounts. If the user resizes the window, `isClamped` may be stale — a card that was clamped at narrow viewport may not be clamped at wide viewport, and vice versa. The "Show more" button may appear or disappear incorrectly.

**Fix:** Add a `ResizeObserver` on `bodyRef.current` to recheck clamping on element size changes.

---

### LO-03: `map/page.tsx` — Google Maps API key exposed in client bundle via `NEXT_PUBLIC_` but no referrer restriction enforced in code

**File:** `apps/web/app/(app)/map/page.tsx:85`

```ts
<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
```

The `!` non-null assertion means the app will silently pass `undefined` to the Google Maps API if the env var is not set, resulting in a broken map with no error surfaced to the user.

**Fix:** Add a check: `if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) { /* render error state */ }`.

---

### LO-04: `mobile/follow-button.tsx` — uses hardcoded blue color `#3b82f6` instead of shared design token

**File:** `apps/mobile/components/follow-button.tsx:55`

```ts
backgroundColor: isFollowing ? 'transparent' : '#3b82f6',
```

The shared design system uses `colors.accent` from `@lunchboxd/shared`. The web follow button uses `bg-accent`. The mobile button uses a hardcoded hex that may not match the actual accent color, causing visual inconsistency.

**Fix:** Import `colors` from `@lunchboxd/shared` and use `colors.accent`.

---

### LO-05: `review-composer.tsx` — `photoKey` state initialized from `initialData.photoKey` but treated as a new upload key

**File:** `apps/web/components/review-composer.tsx:39`

```ts
const [photoKey, setPhotoKey] = useState<string | null>(initialData?.photoKey ?? null)
```

In create mode this is `null`, which is correct. But as analyzed in ME-04, in edit mode `initialData.photoKey` is the full photo URL (passed from `edit/page.tsx:83`), not a valid upload key. This state is then used as-is in the `payload.photoKey` field sent to the API.

---

### LO-06: `webhooks/clerk/route.ts` — `user.updated` event overwrites user-managed `avatarUrl` with Clerk's

**File:** `apps/web/app/api/v1/webhooks/clerk/route.ts:58-71`

```ts
} else if (event.type === 'user.updated') {
  await db.update(users).set({
    email,
    displayName,
    avatarUrl: event.data.image_url ?? null,   // ← overwrites R2 avatar
    updatedAt: new Date(),
  })
```

When Clerk fires `user.updated` (e.g., user changes their email via Clerk dashboard, or Clerk syncs something), the handler unconditionally overwrites `avatarUrl` with Clerk's `image_url`. This erases the user's custom avatar uploaded via `PATCH /api/v1/users/me`, replacing it with the Clerk OAuth profile picture.

**Fix:** Only update `avatarUrl` from Clerk's image if the user hasn't set a custom one (e.g., only when current `avatarUrl` is null, or track whether the avatar was set via the app).

---

### LO-07: `formatRelativeTime` — returns incorrect result for future timestamps

**File:** `apps/web/lib/utils.ts:2`

```ts
const diff = Date.now() - new Date(isoString).getTime()
```

If `isoString` is in the future (e.g., due to clock skew between server and client), `diff` is negative. `Math.floor(diff / 60_000)` is a negative number less than 1, so the function returns `'just now'` for timestamps up to 60 seconds in the future. For larger skews, `minutes < 60` is false with a large negative, `hours < 24` is false — eventually returning `toLocaleDateString` with a future date. The display is confusing but not a crash.

---

### LO-08: `mobile/restaurant-search.tsx` — `handleAddManually` is called unauthenticated; `POST /api/v1/restaurants` requires auth

**File:** `apps/mobile/components/restaurant-search.tsx:86-104`

This is the same root cause as CR-02 but specifically for the manual-add path:

```ts
const res = await fetch(`${API_BASE_URL}/api/v1/restaurants`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: query.trim() }),
})
```

No Authorization header — the server will return 401. The error is swallowed as "Could not save restaurant." This is categorized as LOW separately only because it is a duplicate of a CRITICAL-level root cause already identified.

---

_Reviewed: 2026-04-29_  
_Reviewer: Claude (manual deep review)_  
_Depth: deep_
