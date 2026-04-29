---
phase: 03-social-graph
status: issues_found
files_reviewed: 17
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
---

# Code Review: Phase 03 — Social Graph

## Summary

The social graph implementation is solid overall: all API routes are properly authenticated via Clerk, inputs are validated with Zod, and no raw SQL string interpolation was found. Two critical issues require attention — a race condition in the likes toggle that can cause double-like on concurrent taps, and a missing review ownership check in the likes route that allows any authenticated user to like any review without verifying the review exists (which is minor but could produce orphaned counts). Several warnings around stale optimistic state in FollowButton, unbounded tag counts, and type mismatches between API and mobile client round out the findings.

## Findings

### CR-01: Like toggle has a TOCTOU race condition
**Severity:** critical
**File:** apps/web/app/api/v1/likes/route.ts:26-38
**Issue:** The toggle logic does a SELECT then either DELETE or INSERT in two separate statements. Two simultaneous POST requests from the same user for the same review can both see `existingLike = undefined` and both insert a like row. Although `likesUniqueIdx` prevents the duplicate row, the second insert is silently swallowed by `onConflictDoNothing()`, meaning the server returns `liked: true` for both requests and the count is correct — but the client that "won" may show an incorrect optimistic state if the loser's response arrives later and overwrites it. More importantly, an unlike race can delete the row from one session while a second session still believes the like exists, leaving the UI desynced. The server-side count query corrects eventually, but the toggle direction (`liked: !existingLike`) is computed before any lock, so both callers return `liked: true` even though only one insert occurred.
**Fix:** Use a single upsert/delete with a serializable conflict: replace the SELECT+branch with an `INSERT ... ON CONFLICT DO UPDATE SET updated_at = now() RETURNING (xmax = 0) AS inserted` pattern, or wrap the toggle in a Postgres advisory lock keyed on `(userId, reviewId)`. At minimum, document the known eventual-consistency window and ensure the `onSettled` invalidation (already present in the client) is relied upon to correct state.

---

### CR-02: FollowButton (web) does not read server-returned followState — stale initialState drives UI permanently
**Severity:** critical
**File:** apps/web/components/follow-button.tsx:31, 35-42
**Issue:** `currentState` is set to `initialState` (the prop value) and never updated. After a successful follow/unfollow mutation the component label and click-handler logic continue to use the original prop value until the parent re-renders. The `onSuccess` handler calls `queryClient.invalidateQueries({ queryKey: ['user-search'] })`, which will trigger a refetch and pass a new `initialState` prop — but only if the parent `SearchPage` re-renders and the query refetch completes. During the window between mutation success and query invalidation completion, clicking the button again will send the wrong action (e.g., a second `follow` instead of `unfollow`). This can create duplicate follows that are silently absorbed by `onConflictDoNothing`, but the UI shows the wrong label.
**Fix:** Store follow state in local component state initialised from `initialState`, and update it optimistically from the mutation `onSuccess` response (`data.followState`). This is the standard TanStack Query optimistic pattern for components that own their state.

---

### WR-01: Unfollow does not decrement stats when the follow row never existed
**Severity:** warning
**File:** apps/web/app/api/v1/follows/route.ts:87-131
**Issue:** The DELETE handler decrements `followingCount` and `followerCount` unconditionally via `GREATEST(... - 1, 0)` even when no `follows` row matched the WHERE clause (i.e., the user was never following the target). A client bug or replay attack that calls DELETE twice will only floor at 0 due to GREATEST, so data corruption is bounded — but a spurious unfollow by a user who never followed will still fire two unnecessary upsert statements and could mislead stats if the `userStats` row happened to be zero already.
**Fix:** Check the number of rows deleted from `follows` (Drizzle `.returning()` or a prior SELECT) before decrementing stats. Only update `userStats` if a row was actually removed.

---

### WR-02: Friendship uniqueness index only covers one ordering — unfollow can miss the friendship row
**Severity:** warning
**File:** apps/web/app/api/v1/follows/route.ts:90-98 and apps/web/lib/schema.ts:83
**Issue:** `friendshipsUniqueIdx` is `UNIQUE(user_a_id, user_b_id)`. The POST handler always inserts with `userAId = actorUserId, userBId = targetUserId`. The DELETE handler issues two separate deletes (both orderings). If a friendship was written with `(A, B)` and then B unfollows A, the DELETE attempts `(B, A)` first — which doesn't match the stored `(A, B)` row — then tries `(A, B)` second, which does match. This works correctly today but is fragile. Additionally, the missing secondary index `(user_b_id)` on `friendships` means the second DELETE (or searches by `userBId`) performs a full table scan as the friend graph grows.
**Fix:** Add a `friendshipsBIdx: index('friendships_b_idx').on(table.userBId)` to the schema. Consider enforcing canonical ordering (min UUID first) at insert time to simplify queries, and update the DELETE to use a single `OR` condition.

---

### WR-03: likes route does not verify the reviewed resource exists before inserting
**Severity:** warning
**File:** apps/web/app/api/v1/likes/route.ts:36-38
**Issue:** The INSERT into `likes` references `reviewId` without first confirming the review exists and has not been soft-deleted (`deletedAt IS NULL`). The FK constraint prevents orphaned rows, but inserting a like against a `deletedAt`-set review is logically incorrect — the like count query on line 42 will then count likes against a deleted review. Additionally, no check ensures the `reviewId` belongs to a non-deleted review, so users can like reviews they should not be able to see.
**Fix:** Add a guard before the toggle: `SELECT id FROM reviews WHERE id = reviewId AND deletedAt IS NULL`. Return 404 if not found.

---

### WR-04: Mobile index.tsx rating field type mismatch — API returns string, code treats as number
**Severity:** warning
**File:** apps/mobile/app/(app)/(tabs)/index.tsx:10-17, 117-119
**Issue:** The `ReviewWithLike` interface declares `rating: number`, but the API (`/api/v1/reviews`) returns `rating` as a `numeric` Drizzle column serialized to a **string** (e.g., `"4.5"`). Lines 117-119 call `Math.floor(review.rating)` and `Math.ceil(review.rating)` — if `rating` is a string, `Math.floor("4.5")` returns `4` in JavaScript (coercion works), but `review.rating % 1 !== 0` on a string coerces to `NaN` in strict contexts and returns `false`, meaning the half-star is never rendered. TypeScript does not catch this because the interface is manually declared wrong.
**Fix:** Update the `ReviewWithLike` interface to `rating: string | null` (matching the Drizzle schema's `numeric` type), and parse it with `parseFloat(review.rating ?? '0')` before the star rendering logic.

---

### WR-05: reviewSchema does not enforce `rating` as required on creation — allows 0-star reviews
**Severity:** warning
**File:** packages/shared/src/schemas/index.ts:28
**Issue:** `rating` in `reviewSchema` is defined as `z.number().min(0.5).max(5).multipleOf(0.5)` with no `.optional()`. However, the POST handler in `route.ts` maps it with `input.rating?.toString() ?? null`, treating it as nullable. This mismatch means Zod will reject a missing `rating` (validation error), but the DB column has no NOT NULL constraint — so if someone bypasses Zod (or the schema later becomes `.optional()`), a null rating is inserted silently. More concretely, the `updateReviewSchema = reviewSchema.partial()` on line 36 makes `rating` optional for PATCH, which is correct, but the same partial schema should not be used for creation.
**Fix:** Keep `reviewSchema.rating` required (current behaviour is fine). Add a clear code comment that `rating` is intentionally required on creation and nullable only on partial update. Consider adding `NOT NULL` to the DB column if a rating is always required by product spec.

---

### WR-06: tags array allows up to 50 tags with no server-side duplicate removal beyond lowercase+trim
**Severity:** warning
**File:** apps/web/app/api/v1/reviews/route.ts:51-58 and packages/shared/src/schemas/index.ts:31
**Issue:** The Zod schema allows up to 50 tags (`z.array(z.string().max(50)).max(50)`), and the POST handler normalises each to `label.toLowerCase().trim()`. But there is no deduplication — a client can submit `["pizza", "Pizza", " pizza "]` and three identical rows will be inserted into `review_tags`. At retrieval time all three appear in the tags array, producing visible duplicates in the UI.
**Fix:** Deduplicate the normalised tag array before insert: `const uniqueTags = [...new Set(input.tags.map(t => t.toLowerCase().trim()))]`.

---

### WR-07: reviews/page.tsx sorts already-sorted data client-side — redundant and potentially incorrect
**Severity:** warning
**File:** apps/web/app/(app)/reviews/page.tsx:124-128
**Issue:** The API already returns reviews ordered by `desc(reviews.createdAt)`. The page then sorts the same array again using `new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()`. This is harmless but redundant, and creates a subtle bug: the page-side sort uses `createdAt` (ISO string from DB), but `[...reviews].sort(...)` creates a new array on every render, causing unnecessary reconciliation. If the API sort order ever changes or pagination is added, the client sort may silently override intended ordering.
**Fix:** Remove the client-side sort and trust the API-ordered response. If client sorting is needed for correctness, document why.

---

### IR-01: Web FollowButton and mobile FollowButton duplicate the FollowState type — no shared type
**Severity:** info
**File:** apps/web/components/follow-button.tsx:5, apps/mobile/components/follow-button.tsx:5, packages/shared/src/schemas/index.ts
**Issue:** `type FollowState = 'none' | 'following' | 'friends'` is defined identically in at least four places: web FollowButton, web UserSearchCard, web search page, mobile FollowButton, and mobile UserSearchCard. The shared package exports schemas but not this derived union type.
**Fix:** Export `export type FollowState = 'none' | 'following' | 'friends'` from `packages/shared/src/schemas/index.ts` (or a dedicated types file) and import it everywhere.

---

### IR-02: avatarUrl rendered via bare `<img>` tag — bypasses Next.js Image optimization
**Severity:** info
**File:** apps/web/components/user-search-card.tsx:25-28
**Issue:** Avatar images are rendered with a plain `<img src={user.avatarUrl}>` instead of Next.js `<Image>`. This skips automatic WebP conversion, lazy loading, and size optimization that the project's tech stack explicitly depends on (per CLAUDE.md).
**Fix:** Replace with `import Image from 'next/image'` and add Cloudflare R2 / Clerk CDN domains to `remotePatterns` in `next.config.js`. Set explicit `width` and `height` (40×40 in this case).

---

### IR-03: Mobile search.tsx uses React Native `Image` instead of `expo-image` for avatars
**Severity:** info
**File:** apps/mobile/components/user-search-card.tsx:1, 43-46
**Issue:** Avatar images use React Native's built-in `Image` component. The CLAUDE.md tech stack specifies `expo-image` for faster loading, progressive display, and caching.
**Fix:** Replace `import { Image } from 'react-native'` with `import { Image } from 'expo-image'`. The API surface is compatible for basic `source={{ uri }}` usage.

---

### IR-04: Test suite has no integration tests for the API routes — schema-only unit tests
**Severity:** info
**File:** apps/web/__tests__/social.test.ts
**Issue:** All five test cases exercise Zod schemas in isolation. There are no tests for the API route handlers themselves (auth bypass, self-follow prevention, toggle logic, stat decrement floors, search field filtering). The `unfollowSchema` tests are also redundant since `unfollowSchema` and `followSchema` are identical objects.
**Fix:** Add route handler tests using `msw` or a test database. At minimum, add a test asserting that the self-follow guard rejects `actorUserId === targetUserId` and that the user search response never includes `email` or `clerkId` fields.

---

## Clean Files

The following files had no findings:

- `apps/web/app/api/v1/users/search/route.ts` — auth, field selection, and batch follow-state lookup are all correct
- `apps/web/app/(app)/search/page.tsx` — debouncing, query key design, and enabled guard are correct
- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — trivial layout, no issues
- `apps/web/lib/schema.ts` — schema definitions are sound; unique indices are in place for follows, friendships, and likes
- `packages/shared/src/schemas/index.ts` — Zod schemas are correct and appropriately strict (UUID enforcement, length bounds)
