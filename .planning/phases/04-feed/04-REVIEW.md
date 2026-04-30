---
phase: 04-feed
status: issues_found
depth: standard
files_reviewed: 9
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
reviewed_at: 2026-04-30T00:00:00Z
---

# Code Review: Phase 04 — Feed

## Summary

Nine files were reviewed covering the feed API route, web feed page, mobile feed screen, shared schemas, the review card component, and utility functions. The feed architecture is solid — fan-out-on-write, batch queries, optimistic like updates, and cursor pagination are all implemented correctly. Two critical issues were found: the feed route leaks `likeCount` data by loading all likes for a page of reviews from the database rather than using an aggregate, and the `onError` rollback in the web feed page silently drops the type guard that `InfiniteFeedData` provides. Several warnings relate to missing error handling, a subtle off-by-one risk in star rendering, and unguarded `img` tags that bypass Next.js image optimisation. Info-level notes cover duplicated type definitions, an incomplete test suite, and a placeholder profile screen that references a tab that does not exist yet.

---

## Findings

### CR-01: Like count loaded from full like rows — unbounded memory and query cost

**File:** `apps/web/app/api/v1/feed/route.ts:57-65`
**Severity:** critical
**Issue:** The route fetches every `likes` row for the current page of `reviewIds` in order to compute both `likeCount` and `isLikedByMe`. For reviews with thousands of likes this returns an arbitrarily large result set into Node.js memory on every feed request. There is no aggregate at the database level; the count is computed by iterating all rows in JavaScript. As like counts grow this will cause significant memory pressure and slow queries.
**Fix:** Split the query into two separate queries: (1) a SQL aggregate `COUNT(*) GROUP BY review_id` for `likeCount`, and (2) a targeted `WHERE review_id IN (...) AND user_id = $userId` query limited to the authenticated user's own like rows for `isLikedByMe`. This bounds both queries to O(page_size) results regardless of total like count.

---

### CR-02: `onError` rollback in web feed page casts to wrong type and silently no-ops

**File:** `apps/web/app/(app)/page.tsx:121-124`
**Severity:** critical
**Issue:** The `onError` handler calls `queryClient.setQueryData(['feed'], context.previousData)` where `context.previousData` is typed as `InfiniteFeedData | undefined`. However the `queryClient.setQueryData` overload here receives the value without the generic type parameter, so TypeScript accepts it without checking the shape. If `previousData` is `undefined` the rollback silently no-ops, leaving the cache in the optimistically-mutated state permanently after a failed like. Users will see an incorrect like count with no rollback. The mobile version (`apps/mobile/app/(app)/(tabs)/index.tsx:208-212`) has the same pattern but is less severe because it uses the correct `InfiniteData<FeedResponse>` type.
**Fix:** Add a null guard before the set: `if (context?.previousData) { queryClient.setQueryData<InfiniteFeedData>(['feed'], context.previousData) }`. The generic parameter ensures the cached shape is correctly typed. This matches the pattern already used on the mobile side.

---

### WR-01: `refreshing` prop uses `isLoading || isFetching` — causes spinner on every background refetch

**File:** `apps/mobile/app/(app)/(tabs)/index.tsx:253`
**Severity:** warning
**Issue:** The `FlatList` `refreshing` prop is set to `isLoading || isFetching`. `isFetching` is `true` whenever TanStack Query is performing any background refetch (e.g., window focus refetch, stale-time expiry). This causes the pull-to-refresh spinner to appear without any user gesture, which is surprising and looks like a bug to end users.
**Fix:** Use a dedicated `isRefetching` boolean: `const isRefetching = isFetching && !isFetchingNextPage && !isLoading`. Pass `refreshing={isRefetching}` to prevent the spinner appearing for background fetches that are not user-initiated pull-to-refresh actions.

---

### WR-02: Star rendering produces incorrect output for ratings above 5 or negative values

**File:** `apps/mobile/app/(app)/(tabs)/index.tsx:102-104`
**Severity:** warning
**Issue:** The star rendering expression `'★'.repeat(Math.floor(ratingValue)) + (ratingValue % 1 !== 0 ? '½' : '') + '☆'.repeat(5 - Math.ceil(ratingValue))` is not clamped. If `ratingValue` is `0` (the default when `item.rating` is null), `Math.ceil(0)` is `0` so `5 - 0 = 5` empty stars render correctly. However if an unexpected value like `5.5` arrives (a data integrity failure), `'☆'.repeat(5 - 6)` becomes `'☆'.repeat(-1)` which throws a `RangeError: Invalid count value` in React Native and crashes the FeedCard render.
**Fix:** Clamp `ratingValue` to `[0, 5]` before rendering: `const ratingValue = Math.min(5, Math.max(0, item.rating ? parseFloat(item.rating) : 0))`.

---

### WR-03: Unguarded `<img>` tags in `review-card.tsx` bypass Next.js image optimisation

**File:** `apps/web/components/review-card.tsx:83-89, 97-101`
**Severity:** warning
**Issue:** Both the meal photo thumbnail and the author avatar use bare `<img>` tags rather than Next.js `<Image>`. This bypasses automatic WebP conversion, lazy loading, and CDN caching that `next/image` provides. For a photo-heavy social feed this is a meaningful performance regression. It also means Cloudflare R2 / Cloudflare Images (specified in the tech stack as the CDN delivery layer) is not leveraged for resizing.
**Fix:** Replace `<img>` with `next/image` `<Image>` for both the meal photo and avatar. Set `fill` or explicit `width`/`height` props. Add the Cloudflare R2 domain to `remotePatterns` in `next.config.ts` if not already present.

---

### WR-04: Feed API does not include `follows`-based filtering — returns author's own reviews only

**File:** `apps/web/app/api/v1/feed/route.ts:28-34`
**Severity:** warning
**Issue:** The `whereClause` filters `feedItems.ownerUserId = userId`. The `feedItems` table is fan-out-on-write and already stores one row per follower per review (see `queries.ts:fanOutToFollowers`), so this is architecturally correct. However the route comment reads `// Build WHERE clause: owner = me AND (if cursor) createdAt < cursor` which is accurate. The issue is that the route does **not** include `follows`-joined filtering — meaning if the fan-out job is delayed or skipped (e.g., a new user who had zero followers when a review was posted), the feed will silently appear empty with no indication that content exists. There is no fallback or gap-fill query.
**Fix:** This is acceptable for MVP if fan-out is synchronous (which it currently is). Document the assumption explicitly in the route. If fan-out is ever moved to a background job, a read-time fallback query against `reviews` joined to `follows` will be needed.

---

### WR-05: `feedQuerySchema` accepts `cursor: null` but the route never handles the null branch explicitly

**File:** `apps/web/app/api/v1/feed/route.ts:17-24` / `packages/shared/src/schemas/index.ts:71-74`
**Severity:** warning
**Issue:** The schema marks `cursor` as `z.string().datetime().optional().nullable()`. When `searchParams.get('cursor')` returns `null` (no param supplied), the code passes `undefined` (via `?? undefined`) to the schema. The schema then returns `cursor: undefined` in `parsed.data`. The `whereClause` builder checks `if (cursor)` which is falsy for both `null` and `undefined` — so this works today. However the test in `feed.test.ts:11-13` explicitly tests `cursor: null` passing validation, which means `null` is a supported value. If a client passes `?cursor=` (empty string), `searchParams.get('cursor')` returns `""`, which `feedQuerySchema` will reject as not a valid datetime — correct behaviour, but the error message `"Invalid query params"` returned to the client is opaque.
**Fix:** Low priority. Consider mapping the empty string to `undefined` before parsing: `cursor: searchParams.get('cursor') || undefined`. Add a note in the schema that `null` is only valid when the object is constructed programmatically, not from URL params.

---

### IN-01: `FeedItem` and `FeedAuthor` interfaces are duplicated across web and mobile

**File:** `apps/web/app/(app)/page.tsx:9-35` and `apps/mobile/app/(app)/(tabs)/index.tsx:17-43`
**Severity:** info
**Issue:** The `FeedItem`, `FeedAuthor`, and `FeedResponse` interfaces are defined identically in both the web page component and the mobile feed screen. Any API shape change requires updating two separate files. The `packages/shared` package already exists for exactly this purpose.
**Fix:** Export these types from `packages/shared/src/schemas/index.ts` (or a new `packages/shared/src/types/feed.ts`) and import them in both consumers.

---

### IN-02: Test suite covers schema and `formatRelativeTime` but has no route-level or integration tests

**File:** `apps/web/__tests__/feed.test.ts`
**Severity:** info
**Issue:** The test file only covers `feedQuerySchema` validation and `formatRelativeTime`. There are no tests for the feed route handler itself (e.g., unauthenticated request returns 401, soft-deleted reviews are excluded, cursor pagination returns correct pages, likes count is accurate). The soft-delete filter (`isNull(reviews.deletedAt)`) in particular is a security-relevant correctness property that has no test coverage.
**Fix:** Add route-level tests using `msw` or Next.js `createRequest`/`createResponse` test utilities, or an integration test against a test database. At minimum cover: (1) 401 when not authenticated, (2) soft-deleted reviews excluded, (3) pagination cursor returns the next page correctly.

---

### IN-03: `formatRelativeTime` has no year in output for dates older than 7 days

**File:** `apps/web/lib/utils.ts:10` and `apps/mobile/app/(app)/(tabs)/index.tsx:56`
**Severity:** info
**Issue:** For dates older than 7 days, `formatRelativeTime` returns `"Apr 30"` with no year. A review posted on April 30 of a previous year will be indistinguishable from one posted today. Both the web and mobile implementations share this behaviour (the mobile version is a hand-rolled copy).
**Fix:** Add the year when the review's year differs from the current year: `const d = new Date(isoString); const opts = d.getFullYear() !== new Date().getFullYear() ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }; return d.toLocaleDateString('en-US', opts)`.

---

### IN-04: `profile.tsx` is a stub screen but is registered as a visible tab with no placeholder UX

**File:** `apps/mobile/app/(app)/(tabs)/profile.tsx` and `apps/mobile/app/(app)/(tabs)/_layout.tsx:9`
**Severity:** info
**Issue:** The Profile tab is registered in `_layout.tsx` and shows "Profile coming soon" as plain centered text. This is acceptable for Phase 04 scaffolding, but users tapping the Profile tab in a testable build receive no actionable affordance (no link to a roadmap, no login state display, no skeleton). The `search` and `compose` tab screens referenced in `_layout.tsx` lines 7-8 are not present in the reviewed files, suggesting additional missing screens.
**Fix:** Replace the stub text with a minimal placeholder that includes the current user's username pulled from `useAuth()` (already imported in `index.tsx`) to validate the auth context works end-to-end on mobile. Confirm `search.tsx` and `compose.tsx` exist or add them as stubs to avoid Expo Router route-not-found errors.

---

## Clean Areas

- **Auth enforcement**: The feed API route correctly checks `auth()` before any DB access and returns 401 immediately. No auth bypass path exists.
- **Cursor pagination**: The `PAGE_SIZE + 1` trick to detect `hasMore` without a `COUNT(*)` query is correctly implemented. The cursor is a serialised ISO timestamp which is unguessable and ordered.
- **Optimistic like updates**: Both web and mobile correctly implement `onMutate` / `onError` rollback / `onSettled` invalidation. The `cancelQueries` call before mutation prevents race conditions with in-flight requests.
- **Soft-delete filtering**: `isNull(reviews.deletedAt)` is applied in the batch review fetch, so deleted reviews are correctly excluded from the feed response.
- **Batch queries**: The route uses `Promise.all` to issue review, tag, like, restaurant, and author queries concurrently rather than sequentially, with no N+1 patterns.
- **Schema validation**: `feedQuerySchema` correctly coerces `limit` from string to number, enforces `max(100)`, and validates `cursor` as an ISO 8601 datetime.
- **Accessibility**: Both the web `ReviewCard` and the mobile `FeedCard` provide meaningful `aria-label` / `accessibilityLabel` values on the like button that reflect current liked state.
- **Fan-out correctness**: `queries.ts:fanOutToFollowers` inserts a feed row for the author themselves as well as all followers, so the author sees their own review in their own feed immediately.
- **Index coverage**: The `feedItems` table has `feedItemsOwnerIdx` on `ownerUserId`; the `follows` table has indices on both `followerId` and `followeeId`. The feed query uses `ownerUserId` as the leading filter so the index is utilised.
