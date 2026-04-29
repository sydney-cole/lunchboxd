---
phase: 03-social-graph
verified: 2026-04-29T00:00:00Z
status: passed
score: 21/21 must-haves verified
re_verification: false
---

# Phase 3: Social Graph Verification Report

**Phase Goal:** Build the social graph — follow/unfollow, mutual friend detection, likes, user search — for both web and mobile
**Verified:** 2026-04-29
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | friendships table has a unique index on (userAId, userBId) | ✓ VERIFIED | `friendshipsUniqueIdx: uniqueIndex('friendships_unique_idx').on(table.userAId, table.userBId)` at schema.ts line 83 |
| 2 | Zod schemas exist for follow, like, and user search request validation | ✓ VERIFIED | `followSchema`, `likeSchema`, `userSearchSchema` all present in packages/shared/src/schemas/index.ts lines 49–67 |
| 3 | Unit tests validate all social Zod schemas | ✓ VERIFIED | apps/web/__tests__/social.test.ts has 75 lines, 13 tests covering all four schemas |
| 4 | POST /api/v1/follows creates a follow, detects mutual follows, upserts userStats | ✓ VERIFIED | follows/route.ts POST: .onConflictDoNothing() follow insert, reverse follow check, friendship upsert, userStats onConflictDoUpdate |
| 5 | DELETE /api/v1/follows removes follow, cleans up friendships and feed_items, decrements userStats | ✓ VERIFIED | follows/route.ts DELETE: deletes follows, both directions of friendships, two-step feed_items cleanup, GREATEST floor decrement |
| 6 | Self-follow is rejected with 400 | ✓ VERIFIED | `if (targetUserId === actorUserId)` returns 400 at follows/route.ts line 26 |
| 7 | Unauthenticated requests return 401 | ✓ VERIFIED | Both POST and DELETE in follows/route.ts check `!clerkId` and return 401; same pattern in likes and search routes |
| 8 | POST /api/v1/likes toggles like state, returns { liked, likeCount } | ✓ VERIFIED | likes/route.ts checks existingLike, deletes or inserts, returns `{ liked: !existingLike, likeCount: count }` |
| 9 | GET /api/v1/reviews includes likeCount and isLikedByMe per review | ✓ VERIFIED | reviews/route.ts GET builds likeCountMap and likedByMeSet via batch inArray query, maps to result at lines 131–132 |
| 10 | GET /api/v1/users/search returns users matching username or displayName via ILIKE | ✓ VERIFIED | users/search/route.ts uses ilike(users.username, searchTerm) and ilike(users.displayName, searchTerm) with OR |
| 11 | Search results include followState: 'none' | 'following' | 'friends' | ✓ VERIFIED | Batch follow-state enrichment via followedSet and friendSet, maps to followState in enriched result |
| 12 | Search results do not expose email or clerkId | ✓ VERIFIED | SELECT clause explicitly lists only id, username, displayName, avatarUrl — verified grep for email/clerkId in SELECT context returns no hits |
| 13 | Web /search page renders a text input and shows user results | ✓ VERIFIED | apps/web/app/(app)/search/page.tsx is a 'use client' component with input and results list |
| 14 | Search has 300ms debounce and 2 character minimum | ✓ VERIFIED | `setTimeout(() => setDebouncedQuery(query), 300)` and `if (query.length < 2)` in search/page.tsx |
| 15 | FollowButton shows three states and calls /api/v1/follows | ✓ VERIFIED | follow-button.tsx has labels 'Follow', 'Following', 'Friends', useMutation calling '/api/v1/follows' |
| 16 | ReviewCard displays like button with optimistic toggle and rollback | ✓ VERIFIED | review-card.tsx has Heart icon with fill-destructive, aria-label; reviews/page.tsx has onMutate snapshot, onError rollback, onSettled invalidate |
| 17 | Mobile has a Search tab in the tab bar | ✓ VERIFIED | apps/mobile/app/(app)/(tabs)/_layout.tsx line 7: `<Tabs.Screen name="search" options={{ title: 'Search' }} />` |
| 18 | Mobile search uses debounce and Bearer auth | ✓ VERIFIED | apps/mobile/app/(app)/(tabs)/search.tsx has 300ms setTimeout, query.length < 2 gate, getToken() inside queryFn with Authorization: `Bearer ${token}` |
| 19 | Mobile FollowButton calls API with Bearer auth | ✓ VERIFIED | apps/mobile/components/follow-button.tsx: getToken() inside mutationFn, Authorization: `Bearer ${token}` at line 26 |
| 20 | Mobile ReviewCard displays like button with optimistic UI | ✓ VERIFIED | apps/mobile/app/(app)/(tabs)/index.tsx has Ionicons heart/heart-outline, likeMutation with onMutate, onError rollback, onSettled invalidate |
| 21 | getToken() called inside queryFn/mutationFn — never cached | ✓ VERIFIED | All mobile API calls in search.tsx, follow-button.tsx, and index.tsx call getToken() fresh on every request inside the fn |

**Score:** 21/21 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/lib/schema.ts` | ✓ VERIFIED | friendshipsUniqueIdx present at line 83 |
| `packages/shared/src/schemas/index.ts` | ✓ VERIFIED | followSchema, unfollowSchema, likeSchema, userSearchSchema all exported |
| `apps/web/__tests__/social.test.ts` | ✓ VERIFIED | 75 lines, 13 tests, imports from @lunchboxd/shared |
| `apps/web/app/api/v1/follows/route.ts` | ✓ VERIFIED | 135 lines, exports POST and DELETE |
| `apps/web/app/api/v1/likes/route.ts` | ✓ VERIFIED | 48 lines, exports POST with toggle logic |
| `apps/web/app/api/v1/reviews/route.ts` | ✓ VERIFIED | Exports POST and GET; GET includes likeCountMap, likedByMeSet, fanOutToFollowers preserved |
| `apps/web/app/api/v1/users/search/route.ts` | ✓ VERIFIED | 85 lines, exports GET, ILIKE search, batch follow-state |
| `apps/web/app/(app)/search/page.tsx` | ✓ VERIFIED | 71 lines, 'use client', debounced useQuery, UserSearchCard |
| `apps/web/components/follow-button.tsx` | ✓ VERIFIED | 69 lines, exports FollowButton, useMutation, three labels |
| `apps/web/components/user-search-card.tsx` | ✓ VERIFIED | 50 lines, exports UserSearchCard, imports FollowButton, no bio or reviewCount |
| `apps/web/components/review-card.tsx` | ✓ VERIFIED | Heart icon imported, likeCount/isLikedByMe/onLike props, fill-destructive styling |
| `apps/mobile/components/follow-button.tsx` | ✓ VERIFIED | 72 lines, exports FollowButton, @clerk/expo, getToken inside mutationFn, Bearer auth |
| `apps/mobile/components/user-search-card.tsx` | ✓ VERIFIED | 74 lines, exports UserSearchCard, imports FollowButton |
| `apps/mobile/app/(app)/(tabs)/search.tsx` | ✓ VERIFIED | 98 lines, exports SearchScreen, debounce, getToken inside queryFn |
| `apps/mobile/app/(app)/(tabs)/_layout.tsx` | ✓ VERIFIED | Contains name="search" tab |
| `apps/mobile/app/(app)/(tabs)/index.tsx` | ✓ VERIFIED | Full reviews feed with Ionicons heart, likeMutation, optimistic pattern |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/schemas/index.ts` | `apps/web/__tests__/social.test.ts` | `import { followSchema, likeSchema, userSearchSchema }` | ✓ WIRED | Line 2 of social.test.ts |
| `apps/web/app/api/v1/follows/route.ts` | `packages/shared/src/schemas/index.ts` | `followSchema.safeParse` | ✓ WIRED | Lines 18 and 79 |
| `apps/web/app/api/v1/follows/route.ts` | `apps/web/lib/schema.ts` | follows, friendships, userStats, feedItems, reviews | ✓ WIRED | All tables imported and used |
| `apps/web/app/api/v1/follows/route.ts` | `apps/web/lib/queries.ts` | resolveUserId | ✓ WIRED | Imported and called at lines 14, 75 |
| `apps/web/app/api/v1/likes/route.ts` | `packages/shared/src/schemas/index.ts` | `likeSchema.safeParse` | ✓ WIRED | Line 18 |
| `apps/web/app/api/v1/likes/route.ts` | `apps/web/lib/schema.ts` | likes table insert/delete | ✓ WIRED | Lines 33, 36 |
| `apps/web/app/api/v1/reviews/route.ts` | `apps/web/lib/schema.ts` | likes table join for likeCount and isLikedByMe | ✓ WIRED | likes imported, batch query at lines 116–125 |
| `apps/web/app/api/v1/users/search/route.ts` | `apps/web/lib/schema.ts` | users, follows, friendships | ✓ WIRED | All imported and used in queries |
| `apps/web/app/api/v1/users/search/route.ts` | `packages/shared/src/schemas/index.ts` | userSearchSchema | ✓ WIRED | Line 5 import, line 18 .safeParse |
| `apps/web/app/(app)/search/page.tsx` | `/api/v1/users/search` | TanStack useQuery with debounced query | ✓ WIRED | `/api/v1/users/search?q=` at line 34 |
| `apps/web/components/follow-button.tsx` | `/api/v1/follows` | TanStack useMutation | ✓ WIRED | `/api/v1/follows` at line 17 |
| `apps/web/components/review-card.tsx` | `apps/web/app/(app)/reviews/page.tsx` | onLike prop callback | ✓ WIRED | onLike passed at reviews/page.tsx line 179 |
| `apps/web/app/(app)/reviews/page.tsx` | `/api/v1/likes` | TanStack useMutation with optimistic update | ✓ WIRED | `/api/v1/likes` at line 61 |
| `apps/mobile/app/(app)/(tabs)/search.tsx` | `/api/v1/users/search` | TanStack useQuery with Bearer auth | ✓ WIRED | Line 39 |
| `apps/mobile/components/follow-button.tsx` | `/api/v1/follows` | TanStack useMutation with Bearer auth | ✓ WIRED | Line 22 |
| `apps/mobile/app/(app)/(tabs)/index.tsx` | `/api/v1/likes` | TanStack useMutation with Bearer auth | ✓ WIRED | Line 42 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/web/app/(app)/search/page.tsx` | `results` | GET /api/v1/users/search → DB ilike query | DB query present | ✓ FLOWING |
| `apps/web/components/follow-button.tsx` | `followMutation` response | POST/DELETE /api/v1/follows → DB insert/delete | DB ops present | ✓ FLOWING |
| `apps/web/components/review-card.tsx` | `likeCount`, `isLikedByMe` | Passed via props from reviews/page.tsx → GET /api/v1/reviews | Batch likes query in reviews route | ✓ FLOWING |
| `apps/web/app/(app)/reviews/page.tsx` | `reviews` (ReviewWithLike[]) | GET /api/v1/reviews → DB select with likeCountMap | DB queries present, likeCount mapped | ✓ FLOWING |
| `apps/mobile/app/(app)/(tabs)/index.tsx` | `reviews` | GET /api/v1/reviews with Bearer auth | Same API as web, DB-backed | ✓ FLOWING |
| `apps/mobile/app/(app)/(tabs)/search.tsx` | `results` | GET /api/v1/users/search with Bearer auth | Same API as web, DB-backed | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — server not running; all behaviors verified via static code inspection. No runnable entry points in this verification context.

---

### Requirements Coverage

| Requirement | Description | Plans Claiming | Status | Evidence |
|-------------|-------------|---------------|--------|----------|
| SOCL-01 | User can follow another user (asymmetric) | 03-01, 03-02, 03-05, 03-07 | ✓ SATISFIED | POST /api/v1/follows implemented and wired to web + mobile FollowButton |
| SOCL-02 | User can unfollow a user | 03-01, 03-02, 03-05, 03-07 | ✓ SATISFIED | DELETE /api/v1/follows implemented and wired to web + mobile FollowButton |
| SOCL-03 | Mutual follows detected and displayed as friends | 03-01, 03-02, 03-05, 03-07 | ✓ SATISFIED | Reverse follow check in POST handler writes friendships; followState returns 'friends'; UserSearchCard/FollowButton show 'Friends' label |
| SOCL-04 | User can like a review | 03-01, 03-03, 03-06, 03-07 | ✓ SATISFIED | POST /api/v1/likes toggle implemented; ReviewCard like button wired on web and mobile with optimistic UI |
| SOCL-05 | User can search for other users by username or display name | 03-01, 03-04, 03-05, 03-07 | ✓ SATISFIED | GET /api/v1/users/search ILIKE on username and displayName; /search page and mobile search.tsx wired to this API |

**All 5 requirements satisfied. No orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/mobile/app/(app)/(tabs)/index.tsx` | 11 | `rating: number` in interface but API returns numeric strings from Drizzle | ℹ️ Info | `Math.floor(review.rating)` may behave correctly if JS coerces string to number, but the type contract is inaccurate — does not block functionality at runtime |

No blockers. No stubs. No placeholder returns. No TODO/FIXME in Phase 3 files.

---

### Human Verification Required

#### 1. Follow button state persistence after mutation

**Test:** On the web /search page, search for a user, click "Follow", then navigate away and return to the search page and search the same user again.
**Expected:** The button should show "Following" (or "Friends" if mutual) because TanStack Query invalidates and refetches on mutation success.
**Why human:** State invalidation and re-fetch behavior requires a live browser session.

#### 2. Optimistic like rollback behavior

**Test:** On the reviews page, throttle the network to Slow 3G or offline, click a heart icon, observe the instant toggle, then observe the rollback when the request fails.
**Expected:** Heart fills instantly on click, then reverts to previous state when API call fails.
**Why human:** Error-path optimistic rollback requires a live network environment.

#### 3. Mobile search Bearer auth

**Test:** On the mobile Expo app (development build), navigate to the Search tab, type 2+ characters.
**Expected:** Results appear. If no results, "No users found" message appears. No 401 errors in logs.
**Why human:** Requires a running Expo development build with a valid Clerk session and EXPO_PUBLIC_API_URL configured.

#### 4. Mobile like button on home tab

**Test:** On the mobile home tab, tap the heart icon on a review.
**Expected:** Heart fills red instantly (optimistic), like count increments. On re-open of the app, count reflects server state.
**Why human:** Requires running Expo dev build with network access to the API.

---

### Gaps Summary

No gaps. All 21 observable truths verified. All 16 artifacts exist, are substantive, and are wired. All 5 requirement IDs (SOCL-01 through SOCL-05) are fully satisfied. No anti-patterns that block the phase goal.

**Notable observation from implementation:** The mobile `index.tsx` types `rating` as `number` (line 11) while the Drizzle numeric column returns a string at runtime. The star rendering uses `Math.floor(review.rating)` which works via JavaScript coercion, but the TypeScript interface is inaccurate. This is an info-level issue, not a blocker.

**Notable implementation decision (documented in 03-06-SUMMARY.md):** The reviews page uses query key `['my-reviews']`, not `['reviews']` as shown in the plan template. This was correctly caught and applied consistently in the optimistic mutation. The verification confirms the key matches across all references in reviews/page.tsx.

---

_Verified: 2026-04-29_
_Verifier: Claude (gsd-verifier)_
