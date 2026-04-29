# Phase 3: Social Graph - Research

**Researched:** 2026-04-29
**Domain:** Social graph — follow/unfollow, friendship detection, likes, user search
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Follow button appears in user search results only. No profile stub, no follow button on ReviewCard. Phase 5 adds follow to profiles.
- **D-02:** User search lives on a dedicated `/search` page (web) with an equivalent tab in mobile. Simple text input; results appear below.
- **D-03:** Search result card shows: avatar + username + Follow/Following/Friends button. No review count or bio in Phase 3.
- **D-04:** On follow: INSERT into `follows` table; check if followee already follows back — if yes, INSERT into `friendships` table. `userStats.followerCount` and `followingCount` increment for both users immediately.
- **D-05:** On unfollow: DELETE from `follows`; also DELETE from `friendships` if a friendship row exists. DELETE from `feed_items` where `owner_user_id = actor` and `review_id` belongs to the unfollowed user. `userStats` counts decrement.
- **D-06:** No backfill on follow — only future reviews from the newly followed user appear in the actor's feed.
- **D-07:** Follow button has three states: "Follow" (not following), "Following" (following but not mutual), "Friends" (mutual follow). Label change only — no badge or icon.
- **D-08:** `friendships` table is written on follow (D-04) and cleaned up on unfollow (D-05). Mutuality reads from the friendships table directly (not derived at query time).
- **D-09:** Like button (heart icon + count) appears on `ReviewCard` on both web and mobile. Not on a detail page.
- **D-10:** Optimistic UI for likes — click/tap toggles the like state and increments/decrements the count instantly. API call fires async; on error, roll back to previous state. No polling or SSE.
- **D-11:** Like is a toggle — same action unlikes if already liked (DELETE). If not liked, INSERT.

### Claude's Discretion

- Search debounce timing and minimum character threshold for triggering search
- Like button visual design (filled vs outline heart, animation on tap)
- Error rollback UX on failed like (toast, silent revert, or retry)
- Mobile search: tab bar icon placement and search input behavior
- `userStats` update strategy: direct UPDATE in the same transaction or async increment (Claude picks what fits the Drizzle pattern)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOCL-01 | User can follow another user (asymmetric) | Follow API (POST /api/v1/follows) with atomic userStats increment + friendship detection |
| SOCL-02 | User can unfollow a user | Unfollow API (DELETE /api/v1/follows) with feed_items cleanup + userStats decrement |
| SOCL-03 | Mutual follows are detected and displayed as friends | friendships table write-on-follow read pattern; three-state button |
| SOCL-04 | User can like a review | Toggle like API (POST/DELETE /api/v1/likes) with optimistic UI via TanStack Query useMutation |
| SOCL-05 | User can search for other users by username or display name | ILIKE query on users table; GET /api/v1/users/search?q=; debounced client input |
</phase_requirements>

---

## Summary

Phase 3 adds the social interaction layer on top of the existing review data model. All five social tables (`follows`, `friendships`, `likes`, `userStats`, `feedItems`) already exist in `schema.ts` with correct indices — no migrations are needed. The entire phase is API + UI work.

The most important implementation concern is **atomicity**: follow/unfollow must update the `follows` table, conditionally write/delete `friendships`, and update `userStats` counts all as a single consistent unit. Because `drizzle-orm/neon-http` uses the Neon HTTP adapter (not a pooled WebSocket connection), there is no native `db.transaction()` support — the pattern used in this codebase is sequential awaited operations with careful ordering. The plan must address this explicitly.

A second concern is the **`userStats` bootstrap gap**: the webhook handler and `/api/v1/users` route do not INSERT a `userStats` row at user creation time. The follow handler must use `INSERT ... ON CONFLICT DO UPDATE` (upsert) to handle first-follow gracefully rather than a bare `UPDATE` that silently no-ops if the row is absent.

Optimistic UI for likes follows a standard TanStack Query v5 `useMutation` pattern with `onMutate` snapshot + `onError` rollback + `onSettled` invalidation. This is the same TanStack Query version (`^5.100.5`) already installed in both `apps/web` and `apps/mobile`.

**Primary recommendation:** Build Phase 3 as four discrete plans: (1) Follow/Unfollow API + userStats, (2) Like toggle API, (3) User search API, (4) Web + Mobile UI (search page, ReviewCard like button). Keep each plan vertically thin.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 | ORM queries for follows, friendships, likes, userStats | Already the project ORM; all tables defined |
| @clerk/nextjs | ^7.2.7 | Server-side auth (`await auth()`) in API routes | Locked stack choice; pattern established in Phase 1–2 |
| @clerk/expo | ^3.2.4 | Mobile auth (`useAuth().getToken()`) | Locked stack choice; Bearer token pattern from Phase 2 |
| @tanstack/react-query | ^5.100.5 | `useMutation` for optimistic like toggle; `useQuery` for search results | Already installed web + mobile; QueryProvider at root |
| lucide-react | ^1.12.0 | `Heart` icon for web like button | Already used in ReviewCard (Pencil, Trash2, MoreHorizontal) |
| zod | ^4.3.6 (web), via shared | Schema validation for follow/like/search request bodies | Established pattern; `z.object()` from `zod/v4` |

### New Icons (Mobile)

| Library | Version | Purpose |
|---------|---------|---------|
| @expo/vector-icons | ^15.0.3 (already installed) | `Ionicons` for heart icon on mobile; no new install needed |

**Installation:** No new packages required. All dependencies are present.

---

## Architecture Patterns

### Recommended API Route Structure

```
apps/web/app/api/v1/
├── follows/
│   └── route.ts          # POST (follow) + DELETE (unfollow) — same route, body/query param distinguishes
├── likes/
│   └── route.ts          # POST (like toggle) — returns { liked: boolean, likeCount: number }
└── users/
    └── search/
        └── route.ts      # GET ?q=<query> — returns UserSearchResult[]
```

> Note: `/api/v1/users/` already exists (`route.ts` with POST for user creation). Add `/search/` as a sub-route.

### Pattern 1: Follow API — Atomic Sequential Operations

The Neon HTTP adapter (`drizzle-orm/neon-http`) does NOT support `db.transaction()`. Use sequential awaited operations ordered so that partial failure leaves data in a recoverable state.

**Follow order (POST /api/v1/follows):**
1. Auth check + resolve userId
2. Validate `targetUserId` exists and is not the caller
3. INSERT into `follows` with `.onConflictDoNothing()` (idempotent — double-follow is safe)
4. Check if `follows` row exists in the reverse direction (followee → actor) → if yes, INSERT into `friendships` with `.onConflictDoNothing()`
5. Upsert `userStats` for actor (increment `followingCount`) via INSERT ON CONFLICT DO UPDATE
6. Upsert `userStats` for target (increment `followerCount`) via INSERT ON CONFLICT DO UPDATE
7. Return `{ followState: 'following' | 'friends' }`

**Unfollow order (DELETE /api/v1/follows):**
1. Auth check + resolve userId
2. DELETE from `follows` WHERE `followerId = actor AND followeeId = target`
3. DELETE from `friendships` WHERE `(userAId = actor AND userBId = target) OR (userAId = target AND userBId = actor)`
4. DELETE from `feed_items` WHERE `ownerUserId = actor AND reviewId IN (SELECT id FROM reviews WHERE userId = target AND deletedAt IS NULL)`
5. Decrement `userStats` for actor (`followingCount - 1`, floor at 0)
6. Decrement `userStats` for target (`followerCount - 1`, floor at 0)
7. Return `{ followState: 'none' }`

**Critical note on `userStats` upsert pattern (Drizzle):**

```typescript
// Source: established project pattern (onConflictDoUpdate in webhooks/clerk/route.ts)
await db.insert(userStats)
  .values({
    userId: targetUserId,
    followerCount: '1',
    followingCount: '0',
  })
  .onConflictDoUpdate({
    target: userStats.userId,
    set: {
      followerCount: sql`${userStats.followerCount} + 1`,
      updatedAt: new Date(),
    },
  })
```

This is safe for first-follow because it handles the case where no `userStats` row yet exists for the user (the webhook does not create one).

**Decrement with floor at 0:**

```typescript
// Source: Drizzle ORM sql template + GREATEST pattern
set: {
  followerCount: sql`GREATEST(${userStats.followerCount} - 1, 0)`,
  updatedAt: new Date(),
}
```

### Pattern 2: Friendship Detection Query

After inserting into `follows`, check reverse direction in a single query:

```typescript
// Source: schema.ts — follows table has followsFollowerIdx + followsFolloweeIdx
const [reverseFollow] = await db
  .select({ id: follows.id })
  .from(follows)
  .where(
    and(
      eq(follows.followerId, targetUserId),
      eq(follows.followeeId, actorUserId)
    )
  )

if (reverseFollow) {
  // Mutual — write friendship
  await db.insert(friendships)
    .values({
      userAId: actorUserId,  // convention: smaller UUID first is optional; just be consistent
      userBId: targetUserId,
    })
    .onConflictDoNothing()
}
```

The `friendships` table has no unique index defined yet (confirmed by reading `schema.ts`). The plan should add a unique index on `(userAId, userBId)` OR use application-level ordering to normalize (always store smaller UUID as userAId) to prevent duplicate friendship rows. Since no migration is supposed to happen, the `.onConflictDoNothing()` approach requires a unique constraint to work. **The plan must add this index.**

Actually, re-reading `schema.ts`: `friendships` table has no unique index — only `id PK`. This means `.onConflictDoNothing()` will never conflict and duplicate rows CAN be inserted. The plan must either:
- Add a unique index on `friendships(userAId, userBId)` with normalized ordering (Wave 0 migration), OR
- Use application logic to first DELETE any existing friendship row before INSERT (avoids index need)

**Recommendation:** Add a unique index on `friendships` with enforced ordering. This is a DDL addition but not a data migration — acceptable as Wave 0 in the plan.

### Pattern 3: Unfollow Feed Cleanup

The feed_items cleanup requires a subquery pattern since Drizzle ORM does not support `DELETE ... WHERE reviewId IN (SELECT ...)` natively. Use the two-step approach:

```typescript
// Step 1: get review IDs from the unfollowed user (non-deleted only)
const targetReviewIds = await db
  .select({ id: reviews.id })
  .from(reviews)
  .where(and(eq(reviews.userId, targetUserId), isNull(reviews.deletedAt)))

if (targetReviewIds.length > 0) {
  // Step 2: delete feed_items for actor where reviewId is in that set
  await db.delete(feedItems)
    .where(
      and(
        eq(feedItems.ownerUserId, actorUserId),
        inArray(feedItems.reviewId, targetReviewIds.map(r => r.id))
      )
    )
}
```

**Performance note:** `inArray` with potentially hundreds of review IDs is fine for MVP. The `feedItemsOwnerIdx` (on ownerUserId) is already in place. If a user has thousands of reviews, this may be slow — acceptable at this scale.

### Pattern 4: Like Toggle (Idempotent Insert/Delete)

Like is a toggle on a single endpoint — the API determines current state and flips it:

```typescript
// POST /api/v1/likes  body: { reviewId: string }
// Returns: { liked: boolean, likeCount: number }

// Check existing like
const [existingLike] = await db
  .select({ id: likes.id })
  .from(likes)
  .where(and(eq(likes.userId, actorUserId), eq(likes.reviewId, reviewId)))

if (existingLike) {
  // Unlike
  await db.delete(likes).where(eq(likes.id, existingLike.id))
} else {
  // Like — onConflictDoNothing for safety (unique index on userId+reviewId exists)
  await db.insert(likes)
    .values({ userId: actorUserId, reviewId })
    .onConflictDoNothing()
}

// Count current likes for response
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(likes)
  .where(eq(likes.reviewId, reviewId))

return NextResponse.json({ liked: !existingLike, likeCount: count })
```

The `likes` table already has `likesUniqueIdx` on `(userId, reviewId)` — confirmed in `schema.ts`.

### Pattern 5: Optimistic UI for Likes (TanStack Query v5)

TanStack Query v5 `useMutation` with `onMutate` snapshot + `onError` rollback is the standard pattern. The query cache key for reviews (`['reviews']` or similar) must be invalidated/updated.

```typescript
// Source: TanStack Query v5 optimistic updates documentation
// web: apps/web/components/review-card.tsx extension

const queryClient = useQueryClient()

const toggleLike = useMutation({
  mutationFn: async ({ reviewId }: { reviewId: string }) => {
    const res = await fetch(`/api/v1/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId }),
    })
    if (!res.ok) throw new Error('Like failed')
    return res.json() as Promise<{ liked: boolean; likeCount: number }>
  },
  onMutate: async ({ reviewId }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['reviews'] })

    // Snapshot previous value
    const previousReviews = queryClient.getQueryData(['reviews'])

    // Optimistically update
    queryClient.setQueryData(['reviews'], (old: ReviewWithLike[] | undefined) =>
      old?.map(r =>
        r.id === reviewId
          ? {
              ...r,
              isLikedByMe: !r.isLikedByMe,
              likeCount: r.isLikedByMe ? r.likeCount - 1 : r.likeCount + 1,
            }
          : r
      )
    )

    return { previousReviews }
  },
  onError: (_err, _vars, context) => {
    // Roll back on error
    if (context?.previousReviews) {
      queryClient.setQueryData(['reviews'], context.previousReviews)
    }
  },
  onSettled: () => {
    // Always refetch after mutation to sync server state
    queryClient.invalidateQueries({ queryKey: ['reviews'] })
  },
})
```

**Key v5 difference from v4:** `onMutate` receives variables directly (not wrapped). The `context` return from `onMutate` is passed to `onError` and `onSettled`. This is unchanged from v5.0 through current version.

**ReviewCard extension:** The `ReviewCard` component props interface must be extended with `likeCount: number`, `isLikedByMe: boolean`, and `onLike: (id: string) => void`. The GET /api/v1/reviews response must also include these fields — requires joining `likes` table for the current user.

### Pattern 6: User Search — ILIKE Query

```typescript
// GET /api/v1/users/search?q=<query>
// Returns: UserSearchResult[] — { id, username, displayName, avatarUrl, followState }

const q = `%${searchTerm}%`
const results = await db
  .select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  })
  .from(users)
  .where(
    or(
      ilike(users.username, q),
      ilike(users.displayName, q)
    )
  )
  .limit(20)  // cap results at 20 for MVP
```

Then for each result, determine `followState` by querying `follows` and `friendships` for the current actor:

```typescript
import { ilike, or } from 'drizzle-orm'

// Batch follow-state lookup (not N+1 — one query per batch)
const resultIds = results.map(r => r.id)
const followedByMe = await db
  .select({ followeeId: follows.followeeId })
  .from(follows)
  .where(and(eq(follows.followerId, actorUserId), inArray(follows.followeeId, resultIds)))

const friendsWith = await db
  .select({ userBId: friendships.userBId, userAId: friendships.userAId })
  .from(friendships)
  .where(
    or(
      and(eq(friendships.userAId, actorUserId), inArray(friendships.userBId, resultIds)),
      and(eq(friendships.userBId, actorUserId), inArray(friendships.userAId, resultIds))
    )
  )

// Build followState per result
const followedSet = new Set(followedByMe.map(f => f.followeeId))
const friendSet = new Set([
  ...friendsWith.filter(f => f.userAId === actorUserId).map(f => f.userBId),
  ...friendsWith.filter(f => f.userBId === actorUserId).map(f => f.userAId),
])

const enriched = results.map(r => ({
  ...r,
  followState: friendSet.has(r.id) ? 'friends' : followedSet.has(r.id) ? 'following' : 'none',
}))
```

### Pattern 7: Client-Side Debounced Search

**Web (Next.js Client Component):**

```typescript
// Debounce with useEffect + setTimeout — no extra library needed
const [query, setQuery] = useState('')
const [debouncedQuery, setDebouncedQuery] = useState('')

useEffect(() => {
  if (query.length < 2) { setDebouncedQuery(''); return }
  const timer = setTimeout(() => setDebouncedQuery(query), 300)
  return () => clearTimeout(timer)
}, [query])

const { data: results } = useQuery({
  queryKey: ['user-search', debouncedQuery],
  queryFn: () => fetch(`/api/v1/users/search?q=${encodeURIComponent(debouncedQuery)}`).then(r => r.json()),
  enabled: debouncedQuery.length >= 2,
  staleTime: 30_000,
})
```

**Recommendation:** 300ms debounce, minimum 2 characters. These are Claude's discretion per CONTEXT.md.

**Mobile (Expo):** Same pattern with `useAuth().getToken()` Bearer header:

```typescript
queryFn: async () => {
  const token = await getToken()
  const res = await fetch(
    `${API_BASE_URL}/api/v1/users/search?q=${encodeURIComponent(debouncedQuery)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.json()
}
```

### Pattern 8: Mobile Tab Addition for Search

The current mobile tab layout (`apps/mobile/app/(app)/(tabs)/_layout.tsx`) has `index` and `compose` tabs. Add a `search` tab:

```typescript
<Tabs.Screen name="search" options={{ title: 'Search' }} />
```

Create `apps/mobile/app/(app)/(tabs)/search.tsx` as the search screen. This follows the existing Expo Router file-based convention.

### Recommended Project Structure for Phase 3

```
apps/web/app/api/v1/
├── follows/
│   └── route.ts                    # POST + DELETE
├── likes/
│   └── route.ts                    # POST (toggle)
└── users/
    ├── route.ts                    # (existing: POST for user creation)
    └── search/
        └── route.ts                # GET ?q=

apps/web/app/(app)/
└── search/
    └── page.tsx                    # /search page (web)

apps/web/components/
├── review-card.tsx                 # (extend: add likeCount, isLikedByMe, onLike)
├── follow-button.tsx               # new: three-state Follow/Following/Friends button
└── user-search-card.tsx            # new: avatar + username + FollowButton

apps/mobile/app/(app)/(tabs)/
└── search.tsx                      # new: search tab screen

apps/mobile/components/
├── follow-button.tsx               # new: mobile three-state button
└── user-search-card.tsx            # new: mobile search result card

packages/shared/src/schemas/
└── index.ts                        # add: followSchema, likeSchema, userSearchSchema
```

### Anti-Patterns to Avoid

- **N+1 follow state queries:** Do NOT query `follows` per search result in a loop. Batch-fetch all follow states in one `inArray` query after getting results.
- **Transaction assumption:** Do NOT use `db.transaction()` — the Neon HTTP adapter does not support it. Use sequential awaited operations.
- **Bare UPDATE for userStats:** Do NOT use `db.update(userStats).set({...}).where(eq(userStats.userId, id))` — if no row exists yet, this silently no-ops. Use `INSERT ... ON CONFLICT DO UPDATE` (upsert).
- **Optimistic update without rollback:** Do NOT fire the like mutation without the `onError` rollback — users will see stale like counts after network failures.
- **Search on every keypress:** Do NOT fire the search API without debounce — Postgres ILIKE is relatively cheap but the round-trip latency creates poor UX.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent like insert | Custom EXISTS check + conditional INSERT | `.onConflictDoNothing()` on `likes` table | The unique index `likesUniqueIdx` already handles race conditions |
| Debounce on search input | Custom timer/ref debounce class | Simple `useEffect` + `setTimeout` (300ms) | Sufficient for the use case; no lib needed |
| Optimistic state management | Custom local state mirroring server state | TanStack Query `useMutation` `onMutate` snapshot | Already installed; handles concurrent mutations and rollback correctly |
| Follow state calculation | Store `followState` as a field on `follows` | Derive from `friendships` table read + `follows` table read | D-08: friendships table IS the source of truth for mutual state |
| Rate-limiting search endpoint | Custom sliding window counter | Keep it simple for Phase 3 | Not in scope; add if needed |

---

## Common Pitfalls

### Pitfall 1: `userStats` Row Missing on First Follow
**What goes wrong:** `db.update(userStats).set({ followerCount: sql`${userStats.followerCount} + 1` }).where(eq(userStats.userId, id))` silently succeeds (0 rows affected) when no `userStats` row exists. The count stays at 0 permanently.
**Why it happens:** The Clerk webhook and user onboarding flow do NOT insert a `userStats` row. Only a bare UPDATE is attempted.
**How to avoid:** Use `INSERT INTO user_stats ... ON CONFLICT (user_id) DO UPDATE SET follower_count = user_stats.follower_count + 1`. In Drizzle: `.onConflictDoUpdate({ target: userStats.userId, set: { followerCount: sql`...` } })`.
**Warning signs:** `userStats.followerCount` stays 0 after following; no error thrown.

### Pitfall 2: Duplicate Friendship Rows (No Unique Index on `friendships`)
**What goes wrong:** `friendships` table in `schema.ts` has no unique index on `(userAId, userBId)`. If the follow API is called twice in rapid succession (network retry, double-tap), two friendship rows are inserted. Follow state reads show 'friends' correctly but cleanup on unfollow only deletes one row — leaving a stale row.
**Why it happens:** `.onConflictDoNothing()` requires a unique constraint to trigger. Without one, it is a no-op guard.
**How to avoid:** Add a unique index on `friendships(userAId, userBId)` with enforced ordering convention (e.g., always store `min(a,b)` as `userAId`). Add this in Wave 0 of the plan as a schema migration.
**Warning signs:** `SELECT count(*) FROM friendships WHERE userAId = X AND userBId = Y` returns > 1.

### Pitfall 3: Feed Cleanup Performance on Large Follow Graphs
**What goes wrong:** The unfollow feed cleanup uses `inArray(feedItems.reviewId, reviewIds)` where `reviewIds` could be thousands of IDs for prolific reviewers. PostgreSQL has a practical limit around 65,535 parameters in a single query.
**Why it happens:** A user who has posted 1,000+ reviews will generate a 1,000-element `inArray` clause.
**How to avoid:** At MVP scale (hundreds of users, tens of reviews), this is fine. Add a note in the plan to chunk the `inArray` calls at 1,000 items if needed. For Phase 3, no action required.
**Warning signs:** `Error: bind message has X parameter formats but Y parameters` from Postgres.

### Pitfall 4: ReviewCard Like State Stale After Navigation
**What goes wrong:** The GET /api/v1/reviews query fetches `isLikedByMe` at load time. After liking then navigating away and back, the query re-fetches but the optimistic update is already applied — resulting in a flicker or double-toggle appearance.
**Why it happens:** `onSettled` calls `invalidateQueries`, which triggers a background refetch. If the component unmounts before the refetch completes, the stale data briefly appears on remount.
**How to avoid:** Set `staleTime: 60_000` on the reviews query so remount re-uses the cache (already includes the like from `onMutate`). The `onSettled` invalidation will update it in the background without a visible flicker.
**Warning signs:** Heart icon flickers from filled to outline then back to filled on navigation.

### Pitfall 5: `displayName` Null in Search Results
**What goes wrong:** The `users.displayName` column is nullable. The ILIKE search on `displayName` with `ilike(users.displayName, q)` will NOT match rows where `displayName IS NULL` — Postgres does not match NULL with ILIKE. Users with no display name are only found by username.
**Why it happens:** Postgres NULL propagation in boolean expressions.
**How to avoid:** The search behavior is correct as-is (search by username always works; displayName search only when set). No fix needed, but document that displayName search silently skips null rows. Do not add `IS NULL` handling unless product requires it.
**Warning signs:** User "john_doe" with no displayName not found when searching "john" — actually correct behavior; search finds by username substring fine.

### Pitfall 6: Mobile Search Tab Missing `getToken()` on Query Re-Fetches
**What goes wrong:** The `getToken()` call is inside the `queryFn`. If TanStack Query auto-refetches (window focus, stale time expiry), `getToken()` is called again correctly — this is fine. But if a developer caches the token outside the `queryFn` in a `useEffect`, the cached token may expire (Clerk tokens expire every 60 seconds by default in some configurations).
**Why it happens:** Clerk JWT tokens have short expiry. Caching them outside the fetch call leads to 401s on refetch.
**How to avoid:** Always call `getToken()` inside the `queryFn` — never cache the token in component state. The pattern from `apps/mobile/app/(app)/(tabs)/compose.tsx` is correct.
**Warning signs:** Search works on initial load, then returns 401 after a minute.

### Pitfall 7: Next.js 16 Route Params Are Promises
**What goes wrong:** If a social route has a dynamic segment (e.g., `/api/v1/follows/[userId]`), accessing `params.userId` without `await` returns a Promise object, not the string — silently causing queries to fail with `invalid input syntax for type uuid: [object Promise]`.
**Why it happens:** Next.js 16 breaking change — dynamic route `params` is an async Promise.
**How to avoid:** Destructure with `const { userId } = await params` in the route handler signature. This is already established in the Phase 2 PATCH/DELETE handlers. The follow/unlike routes for Phase 3 should NOT use dynamic segments — use query params or request body instead, which avoids this entirely.
**Warning signs:** Drizzle throws `invalid input syntax for type uuid`.

---

## Code Examples

### Follow API — Sequential Upsert Pattern

```typescript
// Source: Established project pattern (webhook handler + Phase 2 API routes)
// apps/web/app/api/v1/follows/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { follows, friendships, userStats } from '@/lib/schema'
import { eq, and, sql } from 'drizzle-orm'
import { resolveUserId } from '@/lib/queries'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { targetUserId } = await req.json()
  if (!targetUserId || targetUserId === actorUserId) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  // 1. Insert follow (idempotent)
  await db.insert(follows)
    .values({ followerId: actorUserId, followeeId: targetUserId })
    .onConflictDoNothing()

  // 2. Check reverse follow → friendship
  const [reverse] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, targetUserId), eq(follows.followeeId, actorUserId)))

  let followState: 'following' | 'friends' = 'following'
  if (reverse) {
    await db.insert(friendships)
      .values({ userAId: actorUserId, userBId: targetUserId })
      .onConflictDoNothing()
    followState = 'friends'
  }

  // 3. Upsert userStats (handles missing row — actor followingCount++)
  await db.insert(userStats)
    .values({ userId: actorUserId, followingCount: '1', followerCount: '0' })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: { followingCount: sql`${userStats.followingCount} + 1`, updatedAt: new Date() },
    })

  // 4. Upsert userStats (target followerCount++)
  await db.insert(userStats)
    .values({ userId: targetUserId, followerCount: '1', followingCount: '0' })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: { followerCount: sql`${userStats.followerCount} + 1`, updatedAt: new Date() },
    })

  return NextResponse.json({ followState })
}
```

### Like Toggle with Count

```typescript
// Source: schema.ts likesUniqueIdx + Drizzle sql template pattern
// apps/web/app/api/v1/likes/route.ts

const [existingLike] = await db
  .select({ id: likes.id })
  .from(likes)
  .where(and(eq(likes.userId, actorUserId), eq(likes.reviewId, reviewId)))

if (existingLike) {
  await db.delete(likes).where(eq(likes.id, existingLike.id))
} else {
  await db.insert(likes)
    .values({ userId: actorUserId, reviewId })
    .onConflictDoNothing()
}

const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(likes)
  .where(eq(likes.reviewId, reviewId))

return NextResponse.json({ liked: !existingLike, likeCount: count })
```

### `ilike` Import in Drizzle

```typescript
// Source: drizzle-orm — ilike is a named export from drizzle-orm
import { ilike, or, and, eq, inArray } from 'drizzle-orm'
```

### ReviewCard Like Button Extension (Web)

```typescript
// Extend ReviewCardProps interface:
interface ReviewCardProps {
  review: {
    id: string
    // ... existing fields ...
    likeCount: number        // new
    isLikedByMe: boolean     // new
  }
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void  // new
}

// Inside JSX — add like button row at bottom of card:
<div className="flex items-center gap-1 mt-2">
  <button
    type="button"
    onClick={() => onLike(review.id)}
    className="flex items-center gap-1 text-sm text-text-secondary hover:text-destructive transition-colors"
    aria-label={review.isLikedByMe ? 'Unlike review' : 'Like review'}
  >
    <Heart
      size={16}
      className={review.isLikedByMe ? 'fill-destructive text-destructive' : ''}
    />
    <span>{review.likeCount}</span>
  </button>
</div>
```

### GET /api/v1/reviews — Extend to Include Like Data

The existing GET handler in `apps/web/app/api/v1/reviews/route.ts` returns reviews without like data. It must be extended to include `likeCount` and `isLikedByMe` for the authenticated user. Add after the existing restaurant batch-fetch:

```typescript
// Fetch like counts and isLikedByMe for all reviews
const likeRows = await db
  .select({ reviewId: likes.reviewId, userId: likes.userId })
  .from(likes)
  .where(inArray(likes.reviewId, reviewIds))

const likeCountMap: Record<string, number> = {}
const likedByMeSet = new Set<string>()
for (const row of likeRows) {
  likeCountMap[row.reviewId] = (likeCountMap[row.reviewId] ?? 0) + 1
  if (row.userId === userId) likedByMeSet.add(row.reviewId)
}

// Include in result map:
const result = userReviews.map(r => ({
  ...r,
  tags: tagsMap[r.id] ?? [],
  restaurant: r.restaurantId ? (restaurantMap[r.restaurantId] ?? null) : null,
  likeCount: likeCountMap[r.id] ?? 0,
  isLikedByMe: likedByMeSet.has(r.id),
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `db.transaction()` for atomic writes | Sequential awaited operations (Neon HTTP adapter has no transaction support) | Phase 1 — neon-http adapter chosen | All multi-table writes must be carefully ordered, not wrapped in a transaction |
| TanStack Query v4 `onMutate` context | TanStack Query v5 — same API, slightly different type inference | v5.0 (2023) | No behavioral change; type-checking stricter |
| `auth()` synchronous (Clerk 6) | `await auth()` (Clerk 7 — async) | Clerk 7 (Phase 1 decision) | All route handlers must `await auth()` |
| Next.js dynamic params synchronous | `await params` (Next.js 16 — params is a Promise) | Next.js 16 (Phase 2 pattern) | All dynamic routes must `const { id } = await params` |

**Deprecated/outdated:**
- Standalone `index()` export for Drizzle indices: replaced by pgTable callback API. Already enforced in all existing tables in `schema.ts`.
- `getAuth()` from `@clerk/nextjs`: use `auth()` from `@clerk/nextjs/server` in Next.js 16 App Router.

---

## Open Questions

1. **`friendships` unique constraint — migration scope**
   - What we know: `schema.ts` has no unique index on `friendships(userAId, userBId)`. The `.onConflictDoNothing()` guard requires it to work correctly.
   - What's unclear: The CONTEXT.md says "no schema migration needed." But without this index, duplicate friendship rows are possible.
   - Recommendation: Add a schema migration in Wave 0 of Phase 3 Plan 1 (DDL addition, no data migration). The table is empty in dev. This is consistent with prior phase practice (Plan 01 in Phase 2 added `meal_date` column).

2. **Like count source — denormalized vs. COUNT query**
   - What we know: No `likeCount` column exists on `reviews`. Like count is currently computed via `COUNT(*)` on `likes` WHERE reviewId.
   - What's unclear: CONTEXT.md does not specify whether to denormalize a `likeCount` field onto `reviews` or `userStats`.
   - Recommendation: For Phase 3, use the COUNT query approach (simple, no denormalization). This may be revisited if feed performance becomes an issue in Phase 4. Denormalized count would require a separate increment/decrement step in the like toggle handler — adds complexity.

3. **userStats row initialization**
   - What we know: The Clerk webhook (`webhooks/clerk/route.ts`) and user onboarding (`/api/v1/users` POST) do NOT create `userStats` rows. The table is empty for all existing users.
   - What's unclear: None — confirmed by reading the webhook code.
   - Recommendation: Use upsert pattern universally in follow/unfollow handlers. Do NOT add userStats seeding to the webhook in this phase (out of scope).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely API + UI code changes with no new external tool dependencies. All required services (Neon Postgres, Clerk, Next.js dev server, Expo dev server) were established and verified in Phases 1 and 2.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` |
| Include pattern | `__tests__/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOCL-01 | Follow inserts `follows` row and increments `userStats` | unit (schema/Zod) + manual integration | `pnpm --filter web test:unit` | ❌ Wave 0 |
| SOCL-02 | Unfollow deletes `follows`, `friendships`, `feed_items` rows | unit (schema/Zod) + manual integration | `pnpm --filter web test:unit` | ❌ Wave 0 |
| SOCL-03 | Mutual follow detected and `friendships` row written | unit (schema/Zod) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| SOCL-04 | Like toggle inserts/deletes `likes` row; returns correct count + `liked` boolean | unit (schema/Zod) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| SOCL-05 | User search by username and displayName returns correct results | unit (schema/Zod) | `pnpm --filter web test:unit` | ❌ Wave 0 |

**Note on integration tests:** Route Handler integration tests (actual DB calls) require `DATABASE_URL` in the test environment. Following Phase 2 pattern, the plan should stub API-level tests as `it.todo()` and cover Zod schema validation inline.

### Schema/Zod Tests (testable without DB)

Add to `apps/web/__tests__/social.test.ts`:

```typescript
// SOCL-01/02: followSchema
const followSchema = z.object({ targetUserId: z.string().uuid() })
it('should accept valid UUID target', ...)
it('should reject non-UUID target', ...)

// SOCL-04: likeSchema
const likeSchema = z.object({ reviewId: z.string().uuid() })
it('should accept valid reviewId', ...)

// SOCL-05: userSearchSchema
const userSearchSchema = z.object({ q: z.string().min(2).max(100) })
it('should reject query shorter than 2 chars', ...)
```

### Sampling Rate
- **Per task commit:** `pnpm --filter web test:unit`
- **Per wave merge:** `pnpm --filter web test:unit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/__tests__/social.test.ts` — covers SOCL-01 through SOCL-05 (Zod schema validation)
- [ ] Schema migration: add unique index on `friendships(userAId, userBId)` (DDL)
- [ ] Update `packages/shared/src/schemas/index.ts` — add `followSchema`, `likeSchema`, `userSearchSchema`

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Use Next.js Route Handlers for all API | All social endpoints under `apps/web/app/api/v1/` |
| Do NOT use GraphQL | REST only — POST /follows, POST /likes, GET /users/search |
| Do NOT use Prisma — use Drizzle | All queries via `db` instance from `apps/web/lib/db.ts` |
| Use Zod for request validation | Add follow/like/search schemas to `packages/shared/src/schemas/index.ts` |
| `GOOGLE_PLACES_API_KEY` server-side only | Not relevant for Phase 3 |
| Mobile uses `useAuth().getToken()` Bearer header | All mobile social API calls must include `Authorization: Bearer <token>` |
| Drizzle-kit 0.31.10: pgTable callback API for indices | Any new index (friendships unique index) must use callback pattern |
| Do NOT use Redux for state | TanStack Query + React local state for UI state |
| CLAUDE.md enforces GSD workflow | No direct edits outside execute-phase workflow |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/lib/schema.ts` — exact table definitions, column names, existing indices (read directly)
- `apps/web/lib/queries.ts` — `resolveUserId`, `fanOutToFollowers` helper patterns (read directly)
- `apps/web/app/api/v1/reviews/route.ts` — established auth + Drizzle + response patterns (read directly)
- `apps/web/app/api/v1/webhooks/clerk/route.ts` — `onConflictDoUpdate` pattern; confirmed no `userStats` seed (read directly)
- `apps/mobile/app/(app)/(tabs)/compose.tsx` — `getToken()` Bearer auth pattern on mobile (read directly)
- `.planning/phases/03-social-graph/03-CONTEXT.md` — all locked decisions (read directly)
- `.planning/STATE.md` — Drizzle index pattern; neon-http adapter; Clerk 7 API (read directly)
- `CLAUDE.md` — project-wide constraints (read from system context)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — fan-out-on-write design rationale; social module boundaries (read directly)
- `.planning/research/PITFALLS.md` — social graph ambiguity pitfall (Pitfall 4); relevant patterns (read directly)
- TanStack Query v5 `useMutation` optimistic update pattern — consistent with training data (August 2025); v5 API stable

### Tertiary (LOW confidence — flag for validation)
- Neon HTTP adapter transaction support limitation: based on project pattern observation (no `db.transaction()` calls anywhere in codebase). Needs validation if a transaction-equivalent is actually available via `neon()` raw client.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and in use; no new dependencies
- Architecture: HIGH — follow/like/search are well-understood patterns; all tables pre-exist with correct indices (except friendships unique constraint gap)
- Pitfalls: HIGH — sourced directly from reading the actual codebase (userStats bootstrap gap, no `db.transaction()` usage confirmed)
- Optimistic UI pattern: HIGH — TanStack Query v5 stable API, already installed

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — stable dependencies, no fast-moving APIs)
