# Phase 4: Feed - Research

**Researched:** 2026-04-29
**Domain:** Cursor-based pagination, TanStack Query useInfiniteQuery, fan-out-on-write read path, IntersectionObserver, React Native FlatList
**Confidence:** HIGH

## Summary

The fan-out-on-write infrastructure is fully in place: `feedItems` table, `feedItemsOwnerIdx`, and `fanOutToFollowers()` all exist and are functioning. This phase is entirely about the *read path* — the `GET /api/v1/feed` endpoint and its two consumers (web infinite scroll, mobile pull-to-refresh + pagination).

The API pattern is identical to the existing `/api/v1/reviews` GET, extended with cursor logic. The Drizzle `lt()` operator handles cursor comparison. TanStack Query v5's `useInfiniteQuery` is already installed and the required options (`initialPageParam`, `getNextPageParam`) are confirmed in the installed version (^5.100.5). On mobile, the current home tab (`index.tsx`) already fetches reviews using `useQuery` + Clerk `getToken()` Bearer auth — this pattern just needs to be adapted to the feed endpoint with pagination.

The `ReviewCard` web component needs a `showAuthor` prop added. The mobile home tab needs to be restructured from a `ScrollView`-based "my reviews" list to a `FlatList`-based feed. The tab bar needs a "Profile" tab added (index 3), per D-02.

**Primary recommendation:** Build the feed in three sequential steps: (1) API endpoint with cursor logic + Drizzle JOIN, (2) web FeedPage at `/` with `useInfiniteQuery` + IntersectionObserver sentinel, (3) mobile FlatList feed with `onRefresh` + `onEndReached`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Web feed lives at `/` (the home page after login). The root route renders the feed directly — no redirect to `/feed`.
- **D-02:** Mobile feed is the first tab (home tab) in the tab bar. Tab order: Feed → Search → New Review → Profile.
- **D-03:** Feed API uses cursor-based pagination using `feedItems.createdAt` as the cursor. Query: `WHERE owner_user_id = $me AND created_at < $cursor ORDER BY created_at DESC LIMIT 20`.
- **D-04:** API shape: `GET /api/v1/feed` (first page, no cursor), `GET /api/v1/feed?cursor=<ISO8601>&limit=20` (subsequent pages). Response: `{ items: [...], nextCursor: string | null }`.
- **D-05:** Page size: 20 reviews per page.
- **D-06:** Web uses infinite scroll via TanStack Query's `useInfiniteQuery`. Items append — no "Load more" button.
- **D-07:** Extend the existing `ReviewCard` component with an optional `showAuthor` prop. When `true`, renders author attribution at the top. Feed always passes `showAuthor={true}`; "my reviews" page continues to pass `showAuthor={false}` or omit it.
- **D-08:** Author attribution format: avatar + @username + relative time (e.g., `@sarah · 2h ago`).
- **D-09:** Web: feed loads on mount only. No auto-poll. TanStack Query default window-focus refetch handles it.
- **D-10:** Mobile: pull-to-refresh via FlatList/ScrollView's `onRefresh` prop. Triggers manual refetch, resets to first page.

### Claude's Discretion
- Intersection observer implementation for infinite scroll trigger (use `IntersectionObserver` API or a library like `react-intersection-observer`)
- Visual loading skeleton or spinner while fetching next page
- Empty state design (suggested: "Follow someone to see their reviews here" with a link to `/search`)
- Like button behavior on feed cards (reuse existing like mutation from Phase 3 — should work unchanged)
- FlatList vs ScrollView choice on mobile for the feed list
- Relative time formatting library or implementation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-01 | User sees a chronological feed of reviews from people they follow | `feedItems` table + `feedItemsOwnerIdx` enable `WHERE owner_user_id = $me ORDER BY created_at DESC`; fan-out already populates rows on review POST; JOIN to reviews/users/restaurants provides full card data |
| FEED-02 | Feed is paginated and loads more on scroll | TanStack Query v5 `useInfiniteQuery` with `initialPageParam`/`getNextPageParam` confirmed available; cursor param (`?cursor=ISO8601`) drives Drizzle `lt(feedItems.createdAt, cursor)` filter; mobile uses `FlatList.onEndReached` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 (installed) | Cursor query via `lt()`, multi-table JOIN | Already in use; `lt` confirmed exported from `drizzle-orm` |
| @tanstack/react-query | ^5.100.5 (installed) | `useInfiniteQuery` for web infinite scroll | Already installed; v5 API confirmed in installed type defs |
| @clerk/nextjs | ^7.2.7 (installed) | `auth()` in API route for user ID extraction | Already in use across all API routes |
| @clerk/expo | ^3.2.4 (installed) | `getToken()` Bearer header in mobile queryFn | Already in use in `index.tsx` and `search.tsx` |
| React Native FlatList | bundled with RN 0.85.2 | Mobile feed list with `onRefresh`/`onEndReached` | Built-in; appropriate for large lists vs ScrollView (virtualization) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-intersection-observer | 10.0.3 (not installed, optional) | IntersectionObserver wrapper for infinite scroll sentinel | Only if native `IntersectionObserver` API is insufficient; native API available in all modern browsers and Next.js targets |
| date-fns / dayjs | 4.1.0 / 1.11.20 (neither installed) | Relative time formatting ("2h ago") | For `showAuthor` relative time; a small hand-rolled formatter is sufficient and avoids a new dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `IntersectionObserver` | `react-intersection-observer` | Library adds a clean React ref-based API; native works fine with a `useEffect` + ref; no install needed |
| Hand-rolled relative time | `date-fns/formatDistanceToNow` | date-fns is not installed; hand-rolling "Xm ago / Xh ago / Xd ago" is ~10 lines and covers feed use case |
| FlatList | ScrollView + manual pagination | FlatList virtualizes the list (important as feed grows); ScrollView renders all items at once |

**Installation (if using react-intersection-observer):**
```bash
cd apps/web && npm install react-intersection-observer
```
Recommendation: use native `IntersectionObserver` with `useEffect` + a sentinel `<div ref>` — no new dependency needed.

---

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── page.tsx                         # Feed page (replaces placeholder home)
│   └── api/v1/feed/
│       └── route.ts                     # GET /api/v1/feed
├── components/
│   └── review-card.tsx                  # Extend with showAuthor prop
packages/shared/src/
│   └── schemas/index.ts                 # Add feedQuerySchema (cursor, limit)
apps/mobile/app/(app)/(tabs)/
│   ├── _layout.tsx                      # Add Profile tab (4th tab)
│   └── index.tsx                        # Rewrite to feed with FlatList
```

### Pattern 1: Cursor-Based Feed API (Drizzle)

**What:** `GET /api/v1/feed` accepts optional `?cursor=ISO8601` and returns `{ items, nextCursor }`. Uses `lt(feedItems.createdAt, cursor)` for cursor comparison.

**When to use:** First page has no cursor; subsequent pages send `nextCursor` from prior response.

**Key constraint:** `feedItems.createdAt` is typed as a Drizzle `timestamp` column. When comparing against an ISO 8601 string from a query param, pass `new Date(cursor)` to `lt()` to ensure Postgres receives a proper timestamp comparison, not a string comparison.

**Example:**
```typescript
// Source: drizzle-orm installed at /node_modules/drizzle-orm — lt confirmed in conditions.d.ts
import { db } from '@/lib/db'
import { feedItems, reviews, users, restaurants, likes, reviewTags } from '@/lib/schema'
import { eq, lt, and, isNull, desc, inArray } from 'drizzle-orm'

// In GET handler:
const { userId: clerkId } = await auth()
const userId = await resolveUserId(clerkId)

const cursor = searchParams.get('cursor')   // ISO 8601 or null
const limit = 20

const whereClause = cursor
  ? and(
      eq(feedItems.ownerUserId, userId),
      lt(feedItems.createdAt, new Date(cursor))
    )
  : eq(feedItems.ownerUserId, userId)

// Step 1: get feed item rows (limit + 1 to detect hasNextPage)
const feedRows = await db
  .select({ reviewId: feedItems.reviewId, feedCreatedAt: feedItems.createdAt })
  .from(feedItems)
  .where(whereClause)
  .orderBy(desc(feedItems.createdAt))
  .limit(limit + 1)

const hasMore = feedRows.length > limit
const pageRows = feedRows.slice(0, limit)
const nextCursor = hasMore ? pageRows[pageRows.length - 1].feedCreatedAt.toISOString() : null

// Step 2: batch-fetch review data (same pattern as GET /reviews)
const reviewIds = pageRows.map(r => r.reviewId)
// ... inArray selects for reviews, users, restaurants, likes, reviewTags
```

**Why limit+1 trick:** Avoids a COUNT query; fetch one extra, if it exists there are more pages.

### Pattern 2: TanStack Query v5 useInfiniteQuery (Web)

**What:** `useInfiniteQuery` with `initialPageParam: null` and `getNextPageParam` returning `nextCursor` from each page's response.

**Critical v5 breaking change:** TanStack Query v5 requires `initialPageParam` to be explicitly set (previously inferred as `undefined`). Omitting it causes a TypeScript error and runtime warning.

**Example:**
```typescript
// Source: TanStack Query v5 type defs at /node_modules/@tanstack/react-query
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: async ({ pageParam }) => {
    const url = pageParam
      ? `/api/v1/feed?cursor=${encodeURIComponent(pageParam)}&limit=20`
      : '/api/v1/feed'
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to load feed')
    return res.json() as Promise<{ items: FeedItem[]; nextCursor: string | null }>
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 60_000,
})

// Flatten pages for rendering
const allItems = data?.pages.flatMap(page => page.items) ?? []
```

### Pattern 3: Infinite Scroll Sentinel (Web)

**What:** A `<div ref={sentinelRef}>` at the bottom of the list triggers `fetchNextPage()` when it enters the viewport.

**Example:**
```typescript
// Source: MDN IntersectionObserver API — no library needed
const sentinelRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    { threshold: 0.1 }
  )
  const el = sentinelRef.current
  if (el) observer.observe(el)
  return () => { if (el) observer.unobserve(el) }
}, [hasNextPage, isFetchingNextPage, fetchNextPage])

// In JSX:
// {allItems.map(item => <ReviewCard key={item.id} ... />)}
// <div ref={sentinelRef} />
// {isFetchingNextPage && <Loader2 ... />}
```

### Pattern 4: Mobile FlatList Feed

**What:** `FlatList` with `onRefresh`/`refreshing` for pull-to-refresh and `onEndReached`/`onEndReachedThreshold` for pagination. Uses `useInfiniteQuery` same as web but mobile-specific fetch with Bearer token.

**Why FlatList over ScrollView:** FlatList virtualizes the list (only renders visible items). ScrollView renders all items at once — problematic as feed grows. Current `index.tsx` uses ScrollView; this phase should upgrade to FlatList.

**Example:**
```typescript
// Source: React Native docs, Expo SDK 55 bundled RN 0.85.2
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  refetch,
  isLoading,
} = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: async ({ pageParam }) => {
    const token = await getToken()  // CRITICAL: inside queryFn
    const url = pageParam
      ? `${API_BASE_URL}/api/v1/feed?cursor=${encodeURIComponent(pageParam)}&limit=20`
      : `${API_BASE_URL}/api/v1/feed`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Failed to load feed')
    return res.json()
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})

const allItems = data?.pages.flatMap(p => p.items) ?? []

<FlatList
  data={allItems}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <FeedCard item={item} />}
  refreshing={isLoading}
  onRefresh={() => refetch()}
  onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
  onEndReachedThreshold={0.3}
  ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
  ListEmptyComponent={<EmptyFeedState />}
/>
```

### Pattern 5: ReviewCard showAuthor Prop Extension

**What:** Add optional `showAuthor?: boolean` prop and `author` sub-object to `ReviewCard`. Prop is optional and defaults to `false` so existing call sites (reviews page) are unaffected.

**Example:**
```typescript
// Extend existing ReviewCardProps in apps/web/components/review-card.tsx
interface ReviewCardProps {
  review: {
    // ... existing fields ...
    author?: {
      username: string
      avatarUrl: string | null
    }
  }
  showAuthor?: boolean    // defaults to false
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
}

// At top of card when showAuthor is true:
{showAuthor && review.author && (
  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
    {review.author.avatarUrl ? (
      <img src={review.author.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
    ) : (
      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
        <span className="text-[10px] text-accent font-medium">
          {review.author.username.charAt(0).toUpperCase()}
        </span>
      </div>
    )}
    <span className="text-[13px] text-text-secondary">
      @{review.author.username} · {formatRelativeTime(review.createdAt)}
    </span>
  </div>
)}
```

### Pattern 6: Relative Time (Hand-Rolled)

**What:** A small pure utility — no library dependency. Covers the feed use case (seconds, minutes, hours, days).

```typescript
// Source: custom — no library needed for this range
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
```

Place in `apps/web/lib/utils.ts` (or inline in review-card.tsx). Use same logic on mobile.

### Pattern 7: Web Root Page Replacement

**What:** The current `apps/web/app/page.tsx` is the default Next.js scaffold (unrelated to Lunchboxd). It must be replaced with the feed page.

**Key detail:** `page.tsx` lives outside `(app)/` so it bypasses the `(app)/layout.tsx` auth check. The feed page must either be moved into `(app)/` or add its own auth guard. The simplest approach: move feed logic to `(app)/page.tsx` (or create `(app)/page.tsx`) and redirect the root `/` to `/(app)` — but since root `/` should be the feed per D-01, the cleanest solution is to add an auth redirect directly in `app/page.tsx` or move it under `(app)/`.

**Recommended:** Create `apps/web/app/(app)/page.tsx` as the feed page. The `(app)/layout.tsx` already handles auth redirect to `/sign-in` for unauthenticated users. Update (or replace) `apps/web/app/page.tsx` to redirect to `/(app)` or remove it in favor of the `(app)/page.tsx` — the Next.js App Router will serve `(app)/page.tsx` as the root `/` route since route groups don't affect URL paths.

**Verified:** `(app)/layout.tsx` uses `await auth()` + `redirect('/sign-in?expired=true')` for unauthenticated users — the feed will be protected automatically.

### Pattern 8: Mobile Tab Bar — Adding Profile Tab

**What:** Current `_layout.tsx` has 3 tabs (Home/Search/New Review). D-02 requires adding Profile as the 4th tab.

```typescript
// Update apps/mobile/app/(app)/(tabs)/_layout.tsx
<Tabs screenOptions={{ headerShown: false }}>
  <Tabs.Screen name="index" options={{ title: 'Feed' }} />
  <Tabs.Screen name="search" options={{ title: 'Search' }} />
  <Tabs.Screen name="compose" options={{ title: 'New Review' }} />
  <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
</Tabs>
```

A `profile.tsx` stub must be created in the tabs directory for Expo Router to register the tab without crashing. It can be a minimal placeholder — full Profile implementation is Phase 5.

### Anti-Patterns to Avoid

- **Cursor as offset/page number:** Offset pagination skips and duplicates items when new reviews are posted during scroll. Use cursor = `feedItems.createdAt`.
- **String cursor comparison in Postgres:** Passing ISO 8601 string directly to `lt()` without `new Date()` wrapping can cause lexicographic string comparison instead of temporal comparison.
- **Fetching `data.pages` length to detect "has more":** Use `hasNextPage` from `useInfiniteQuery` — it reads from `getNextPageParam` return value.
- **N+1 for author data:** Batch-fetch user data for all review IDs in a page using `inArray(users.id, authorIds)` — same pattern as the existing restaurants/likes batch fetches in GET /reviews.
- **`db.transaction()` for feed cleanup:** Already locked — Neon HTTP adapter does not support transactions. Sequential awaits only.
- **`getToken()` outside queryFn/mutationFn:** Must be called *inside* the query function on mobile, not at component level. Already documented in existing code comments.
- **`queryKey: ['feed']` vs `queryKey: ['my-reviews']`:** Feed and my-reviews are separate queries with separate cache entries. Like mutations on feed cards must invalidate `['feed']`, not `['my-reviews']`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Has next page" detection | Manual length checks | `hasNextPage` from `useInfiniteQuery` | Built in; reads from `getNextPageParam` return — reliable and reactive |
| Cursor pagination boilerplate | Custom pagination class | Drizzle `lt()` + `limit+1` trick | Drizzle handles parameterization; limit+1 avoids COUNT query |
| Pull-to-refresh (mobile) | Custom gesture handlers | FlatList `onRefresh` + `refreshing` | Built into React Native FlatList; handles RefreshControl natively |
| InfiniteData flattening | Manual `reduce()` | `data.pages.flatMap(p => p.items)` | TanStack Query stores paginated data as `InfiniteData<T>`; `.pages` is the array of page responses |
| Bearer token injection | Custom auth wrapper | `getToken()` inside queryFn | Clerk Expo pattern — same as search.tsx and compose.tsx |

**Key insight:** The entire feed read path is composition of existing patterns — the only net-new code is the API endpoint's cursor WHERE clause and the `useInfiniteQuery` wrapper.

---

## Common Pitfalls

### Pitfall 1: Cursor Timestamp Precision Collision
**What goes wrong:** Two reviews created at the exact same millisecond get the same cursor value. Pagination skips one of them — one item missing from feed.
**Why it happens:** Cursor is `feedItems.createdAt` — if two fan-out rows land in the same millisecond, `lt(createdAt, cursor)` excludes both on the next page.
**How to avoid:** At MVP scale (no viral growth), this is extremely unlikely. Document as a known edge case. For robustness, a compound cursor `(createdAt, id)` could be used, but that complicates the query and query param. Not needed for Phase 4.
**Warning signs:** User reports a missing review that should be in their feed.

### Pitfall 2: TanStack Query v5 — Missing initialPageParam
**What goes wrong:** TypeScript error and runtime warning: `"Missing 'initialPageParam' in useInfiniteQuery"`.
**Why it happens:** TanStack Query v5 made `initialPageParam` required (was optional/inferred in v4). Training data may reference v4 patterns.
**How to avoid:** Always include `initialPageParam: null as string | null` when using cursor strings.
**Warning signs:** TypeScript compilation error on `useInfiniteQuery` call.

### Pitfall 3: Like Mutation Query Key Mismatch
**What goes wrong:** Like button on feed card optimistically updates `['my-reviews']` cache but feed is keyed `['feed']` — like count does not update visually on feed.
**Why it happens:** Phase 3 like mutation targets `['my-reviews']`. Feed uses `['feed']`. Different TanStack Query cache entries.
**How to avoid:** Feed like mutation must cancel/update/invalidate `['feed']` query key, not `['my-reviews']`.
**Warning signs:** Like count on feed cards does not change on click; count on my-reviews page works correctly.

### Pitfall 4: Web Root Route Auth Gap
**What goes wrong:** `apps/web/app/page.tsx` is outside `(app)/` group and bypasses the auth layout. Unauthenticated users see the feed page.
**Why it happens:** Next.js route groups (`(app)`) only apply layout nesting, not URL prefixing. `app/page.tsx` and `app/(app)/page.tsx` both resolve to `/` — but `app/page.tsx` takes precedence when both exist.
**How to avoid:** Either (a) move feed to `app/(app)/page.tsx` and delete `app/page.tsx`, or (b) add `await auth()` + redirect directly in `app/page.tsx`. Option (a) is cleaner.
**Warning signs:** Feed visible without logging in; no redirect to sign-in.

### Pitfall 5: Empty Feed vs No Following
**What goes wrong:** New users see an empty feed with no explanation. They don't know they need to follow people.
**Why it happens:** Feed query returns zero items when user follows no one.
**How to avoid:** Distinguish empty state: "You're not following anyone yet. [Find people to follow →]" linking to `/search`.
**Warning signs:** User confusion; high bounce rate on home page for new accounts.

### Pitfall 6: Mobile ScrollView Not Virtualizing
**What goes wrong:** As feed grows, mobile renders all items in memory simultaneously. App becomes slow / crashes.
**Why it happens:** Current `index.tsx` uses `ScrollView` which renders all children eagerly. Fine for `my-reviews` (bounded by user's own posts) but wrong for a social feed.
**How to avoid:** Use `FlatList` — it virtualizes items outside the viewport.
**Warning signs:** App performance degrades as follow count grows.

### Pitfall 7: feedItems.createdAt is set from review.createdAt
**What goes wrong:** If `fanOutToFollowers()` passes the wrong `createdAt`, cursor pagination breaks (items out of order or wrong page boundaries).
**Why it happens:** `feedItems.createdAt` is set from `review.createdAt` passed at fan-out time (confirmed in `queries.ts`). The feed API should order by `feedItems.createdAt`, not `reviews.createdAt`.
**How to avoid:** Feed query uses `ORDER BY feed_items.created_at DESC` — already set in the cursor query. Do not accidentally order by `reviews.createdAt`.
**Warning signs:** Feed items appear out of order for users who followed someone after that person had already posted.

---

## Code Examples

### Feed API Route Skeleton
```typescript
// apps/web/app/api/v1/feed/route.ts
// Source: mirrors GET /api/v1/reviews pattern; cursor logic is new
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedItems, reviews, users, restaurants, likes, reviewTags } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, lt, and, isNull, desc, inArray } from 'drizzle-orm'

const PAGE_SIZE = 20

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')  // ISO 8601 string or null

  const whereClause = cursor
    ? and(
        eq(feedItems.ownerUserId, userId),
        lt(feedItems.createdAt, new Date(cursor))
      )
    : eq(feedItems.ownerUserId, userId)

  // Fetch PAGE_SIZE + 1 to detect if more pages exist
  const rawRows = await db
    .select({ reviewId: feedItems.reviewId, feedCreatedAt: feedItems.createdAt })
    .from(feedItems)
    .where(whereClause)
    .orderBy(desc(feedItems.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rawRows.length > PAGE_SIZE
  const pageRows = rawRows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1].feedCreatedAt.toISOString()
    : null

  if (pageRows.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const reviewIds = pageRows.map(r => r.reviewId)

  // Batch-fetch all associated data (no N+1)
  const [reviewRows, tagRows, likeRows] = await Promise.all([
    db.select().from(reviews).where(and(inArray(reviews.id, reviewIds), isNull(reviews.deletedAt))),
    db.select().from(reviewTags).where(inArray(reviewTags.reviewId, reviewIds)),
    db.select({ reviewId: likes.reviewId, likeUserId: likes.userId }).from(likes).where(inArray(likes.reviewId, reviewIds)),
  ])

  // Fetch restaurants and authors
  const restaurantIds = reviewRows.map(r => r.restaurantId).filter((id): id is string => id !== null)
  const authorIds = [...new Set(reviewRows.map(r => r.userId))]
  const [restaurantRows, authorRows] = await Promise.all([
    restaurantIds.length > 0
      ? db.select({ id: restaurants.id, name: restaurants.name, address: restaurants.address }).from(restaurants).where(inArray(restaurants.id, restaurantIds))
      : Promise.resolve([]),
    db.select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, authorIds)),
  ])

  // Build maps
  const reviewMap = Object.fromEntries(reviewRows.map(r => [r.id, r]))
  const tagsMap: Record<string, string[]> = {}
  for (const tag of tagRows) {
    if (!tagsMap[tag.reviewId]) tagsMap[tag.reviewId] = []
    tagsMap[tag.reviewId].push(tag.label)
  }
  const likeCountMap: Record<string, number> = {}
  const likedByMeSet = new Set<string>()
  for (const row of likeRows) {
    likeCountMap[row.reviewId] = (likeCountMap[row.reviewId] ?? 0) + 1
    if (row.likeUserId === userId) likedByMeSet.add(row.reviewId)
  }
  const restaurantMap = Object.fromEntries(restaurantRows.map(r => [r.id, r]))
  const authorMap = Object.fromEntries(authorRows.map(u => [u.id, u]))

  // Shape items in feed order (pageRows preserves feedCreatedAt DESC order)
  const items = pageRows
    .map(row => {
      const review = reviewMap[row.reviewId]
      if (!review) return null
      return {
        id: review.id,
        body: review.body,
        rating: review.rating,
        photoUrl: review.photoUrl,
        mealType: review.mealType,
        mealDate: review.mealDate,
        createdAt: review.createdAt,
        feedCreatedAt: row.feedCreatedAt.toISOString(),
        tags: tagsMap[review.id] ?? [],
        restaurant: review.restaurantId ? (restaurantMap[review.restaurantId] ?? null) : null,
        likeCount: likeCountMap[review.id] ?? 0,
        isLikedByMe: likedByMeSet.has(review.id),
        author: authorMap[review.userId] ?? null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ items, nextCursor })
}
```

### Zod Schema for Feed Query Params
```typescript
// Add to packages/shared/src/schemas/index.ts — Phase 4 section
export const feedQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type FeedQueryInput = z.infer<typeof feedQuerySchema>
```

### Relative Time Utility
```typescript
// apps/web/lib/utils.ts (new file or add to existing)
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely code changes. No external tools, services, or CLIs are introduced. All dependencies (Drizzle, TanStack Query, Clerk, Expo) are already installed and confirmed available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed in `apps/web/vitest.config.ts`) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npm run test` |
| Full suite command | `cd apps/web && npm run test` |
| Test include pattern | `__tests__/**/*.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-01 | feedQuerySchema rejects invalid cursor format | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |
| FEED-01 | feedQuerySchema accepts null cursor (first page) | unit | same | ❌ Wave 0 |
| FEED-02 | feedQuerySchema coerces limit to number, enforces max 100 | unit | same | ❌ Wave 0 |
| FEED-02 | formatRelativeTime returns "just now" for sub-minute diff | unit | same | ❌ Wave 0 |
| FEED-02 | formatRelativeTime returns "2h" for 2-hour diff | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npm run test`
- **Per wave merge:** `cd apps/web && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/__tests__/feed.test.ts` — covers feedQuerySchema validation (FEED-01, FEED-02) and formatRelativeTime unit tests (FEED-02)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4: `pageParam` defaulted to `undefined`, no `initialPageParam` required | v5: `initialPageParam` required, must be explicitly declared | v5.0.0 (2023) | All `useInfiniteQuery` calls must include `initialPageParam` |
| TanStack Query v4: `data.pages[n].data` (nested) | v5: `data.pages[n]` is the direct page response | v5.0.0 (2023) | Page response is accessed directly, not via `.data` sub-key |
| React Native ScrollView for lists | FlatList for virtualized lists | Long-standing RN guidance | FlatList mandatory for feeds that grow beyond a few dozen items |

**Deprecated/outdated:**
- TanStack Query v4 `useInfiniteQuery` signature: `pageParam` was inferred; v5 requires explicit `initialPageParam`
- `data.pages[n].data` pattern: v5 returns page response directly as `data.pages[n]`

---

## Open Questions

1. **Cursor collision edge case**
   - What we know: Two feed items with identical `createdAt` values would produce an incorrect cursor boundary (one item skipped)
   - What's unclear: At what user/review volume does this become a real problem
   - Recommendation: Document as known limitation; not worth compound cursor complexity in Phase 4

2. **Like mutation on feed cards — separate mutation or shared?**
   - What we know: Phase 3 like mutation targets `['my-reviews']`; feed uses `['feed']`
   - What's unclear: Whether the same `onLike` handler can be reused with a different query key or needs a new mutation
   - Recommendation: Create a separate `likeFeedMutation` in `FeedPage` that targets `['feed']` instead of `['my-reviews']`; both call the same API endpoint

3. **Profile tab stub on mobile**
   - What we know: D-02 requires 4 tabs; Profile tab is Phase 5
   - What's unclear: Whether a blank stub causes Expo Router warnings
   - Recommendation: Create `apps/mobile/app/(app)/(tabs)/profile.tsx` as a minimal `<View><Text>Profile coming soon</Text></View>` — Expo Router requires a file to exist for each registered tab screen

---

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/web/lib/schema.ts` — confirmed `feedItems` table, `feedItemsOwnerIdx`, `createdAt` column type
- Codebase: `apps/web/lib/queries.ts` — confirmed `fanOutToFollowers()` implementation
- Codebase: `apps/web/components/review-card.tsx` — confirmed current `ReviewCardProps` shape
- Codebase: `apps/web/app/(app)/reviews/page.tsx` — confirmed TanStack Query patterns, `useInfiniteQuery` already installed
- Codebase: `apps/mobile/app/(app)/(tabs)/index.tsx` — confirmed mobile `getToken()` + Bearer pattern
- Installed package: `node_modules/drizzle-orm` — `lt` confirmed in `sql/expressions/conditions.d.ts`
- Installed package: `node_modules/@tanstack/react-query` — `useInfiniteQuery`, `initialPageParam`, `getNextPageParam` confirmed in type defs
- Codebase: `apps/web/vitest.config.ts` — test framework confirmed as Vitest, include pattern `__tests__/**/*.test.ts`

### Secondary (MEDIUM confidence)
- `packages/shared/src/schemas/index.ts` — established pattern for adding new Zod schemas to shared package (Phase 3 schemas are the template)
- `apps/web/app/api/v1/reviews/route.ts` — batch-fetch pattern for reviews + tags + restaurants + likes confirmed; cursor pagination is new extension of this

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and confirmed in codebase
- Architecture: HIGH — patterns verified directly from existing API routes and components
- Pitfalls: HIGH — cursor collision and query key mismatch verified from code analysis; v5 breaking change verified from type defs

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable libraries; no fast-moving dependencies introduced)
