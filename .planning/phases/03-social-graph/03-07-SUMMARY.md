---
phase: 03-social-graph
plan: 07
subsystem: mobile, ui, social-graph
tags: [expo, tanstack-query, optimistic-update, follow-button, user-search, like-toggle, bearer-auth, clerk-expo]
dependency_graph:
  requires: [03-02, 03-03, 03-04]
  provides: [mobile-search-tab, mobile-follow-button, mobile-user-search-card, mobile-like-button]
  affects: []
tech_stack:
  added: []
  patterns: [bearer-auth-gettoken-inside-queryfn, debounced-input-300ms, optimistic-update-with-rollback, three-state-follow-button]
key_files:
  created:
    - apps/mobile/components/follow-button.tsx
    - apps/mobile/components/user-search-card.tsx
    - apps/mobile/app/(app)/(tabs)/search.tsx
  modified:
    - apps/mobile/app/(app)/(tabs)/_layout.tsx
    - apps/mobile/app/(app)/(tabs)/index.tsx
decisions:
  - "Mobile auth uses @clerk/expo useAuth().getToken() — import is '@clerk/expo' not '@clerk/clerk-expo' (matches existing compose.tsx pattern)"
  - "FollowButton uses StyleSheet inline styles instead of NativeWind className — compose.tsx uses StyleSheet, NativeWind className strings may not be configured in this Expo project"
  - "UserSearchCard uses inline style objects — consistent with FollowButton and compose.tsx styling approach"
  - "Home tab index.tsx upgraded from placeholder to full reviews feed — plan intended like button addition but required building the review list first"
  - "getToken() called inside both queryFn and mutationFn throughout — never cached in component state (Pitfall 6)"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
requirements: [SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05]
---

# Phase 3 Plan 07: Mobile Social UI Summary

**One-liner:** Mobile Expo app now has a Search tab with debounced user search and three-state FollowButton, plus a home tab reviews feed with Ionicons heart like button and optimistic toggle using Bearer auth via Clerk getToken().

## What Was Built

### Task 1: Search tab, FollowButton, and UserSearchCard

**`apps/mobile/components/follow-button.tsx`** — Three-state follow button:
- Accepts `targetUserId` and `initialState` ('none' | 'following' | 'friends')
- `useMutation` with `getToken()` called inside `mutationFn` (never cached)
- POST /api/v1/follows for follow, DELETE for unfollow via Bearer auth
- Invalidates `['user-search']` query on success
- Visual states: blue filled for "Follow", outlined for "Following"/"Friends"

**`apps/mobile/components/user-search-card.tsx`** — Search result card:
- Shows circular avatar (image or initial letter fallback)
- Displays displayName + @username or just username
- Inline FollowButton on right side

**`apps/mobile/app/(app)/(tabs)/search.tsx`** — Search screen:
- Text input with 300ms debounce and 2 character minimum
- `useQuery` with `getToken()` inside `queryFn` for GET /api/v1/users/search
- `staleTime: 30_000` prevents result flicker
- Loading state, empty state, and results list

**`apps/mobile/app/(app)/(tabs)/_layout.tsx`** — Updated tab bar:
- Added `<Tabs.Screen name="search" options={{ title: 'Search' }} />` between Home and New Review

### Task 2: Like button on home tab ReviewCard

**`apps/mobile/app/(app)/(tabs)/index.tsx`** — Upgraded from placeholder to full reviews feed:
- Fetches reviews from GET /api/v1/reviews with Bearer auth
- `useQuery` with `queryKey: ['my-reviews']` and `staleTime: 60_000`
- `useMutation` for like toggle via POST /api/v1/likes with full optimistic pattern:
  - `onMutate`: cancels queries, snapshots previous data, optimistically toggles `isLikedByMe` and adjusts `likeCount` by ±1
  - `onError`: restores snapshot on API failure (rollback)
  - `onSettled`: invalidates `['my-reviews']` to sync server state
- Ionicons `heart` (filled, red) / `heart-outline` (gray) icon with like count
- Loading state, error state, empty state, and review cards

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create mobile FollowButton, UserSearchCard, and search tab screen | 2bb5845 | apps/mobile/components/follow-button.tsx, apps/mobile/components/user-search-card.tsx, apps/mobile/app/(app)/(tabs)/search.tsx, apps/mobile/app/(app)/(tabs)/_layout.tsx |
| 2 | Add like button to mobile home tab ReviewCard with optimistic UI | 4dd7e82 | apps/mobile/app/(app)/(tabs)/index.tsx |

## Verification Results

- `grep "export function FollowButton"` — PASS (follow-button.tsx line 14)
- `grep "export function UserSearchCard"` — PASS (user-search-card.tsx line 16)
- `grep "export default function SearchScreen"` — PASS (search.tsx line 19)
- `grep 'name="search"' _layout.tsx` — PASS (line 7)
- `grep "getToken" follow-button.tsx` — PASS, inside mutationFn (lines 15, 21)
- `grep "Bearer" follow-button.tsx` — PASS (line 26)
- `grep "getToken" search.tsx` — PASS, inside queryFn (lines 20, 37)
- `grep "setTimeout.*setDebouncedQuery" search.tsx` — PASS (line 29)
- `grep "query.length < 2" search.tsx` — PASS (line 25)
- `grep "likeMutation\|api/v1/likes\|onMutate\|onError\|heart\|likeCount" index.tsx` — PASS (all present)
- `pnpm --filter web test:unit` — 4 pre-existing failures (MEAL-03, REVW-02, REVW-04, REVW-05, documented in 03-01-SUMMARY.md and 03-03-SUMMARY.md); auth.test.ts 11/11 PASS, social.test.ts 13/13 PASS. No new failures introduced.

## Decisions Made

- **`@clerk/expo` import** — Used `import { useAuth } from '@clerk/expo'` to match the existing pattern in `compose.tsx`. The plan referenced `@clerk/clerk-expo` but the installed package in this project is `@clerk/expo`.
- **StyleSheet over NativeWind** — Used React Native `StyleSheet.create()` and inline style objects throughout, matching the compose.tsx pattern. NativeWind `className` strings require configuration that may not be present in this Expo project.
- **Home tab full build** — The plan asked to add a like button to the existing ReviewCard in index.tsx, but index.tsx was a placeholder "Coming soon" screen with no reviews. Built a complete reviews feed to fulfill the intent: display reviews with like button.
- **`['my-reviews']` query key** — Consistent with the web reviews page (03-06-SUMMARY.md decision) and the plan's optimistic update template. The like mutation targets the same key to hit the correct cache entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import path corrected from `@clerk/clerk-expo` to `@clerk/expo`**
- **Found during:** Task 1
- **Issue:** Plan specified `import { useAuth } from '@clerk/clerk-expo'` but compose.tsx uses `import { useAuth } from '@clerk/expo'`
- **Fix:** Used `@clerk/expo` consistent with existing mobile code
- **Files modified:** apps/mobile/components/follow-button.tsx, apps/mobile/app/(app)/(tabs)/search.tsx, apps/mobile/app/(app)/(tabs)/index.tsx

**2. [Rule 2 - Missing Critical Functionality] Replaced placeholder home screen with real reviews feed**
- **Found during:** Task 2
- **Issue:** index.tsx was a "Coming soon" placeholder with no review list. Adding a like button to a placeholder screen is meaningless; the plan's intent was a working like button on actual reviews.
- **Fix:** Built complete reviews fetch + card list before adding like mutation
- **Files modified:** apps/mobile/app/(app)/(tabs)/index.tsx

**3. [Rule 1 - Bug] StyleSheet used instead of NativeWind className**
- **Found during:** Task 1
- **Issue:** Plan provided NativeWind `className="px-4 py-1.5..."` strings. Existing compose.tsx uses `StyleSheet.create()` — NativeWind may not be configured in this project. Using unsupported className strings would silently break styling.
- **Fix:** Used StyleSheet inline styles throughout, matching existing mobile styling pattern

## Known Stubs

None. All API calls are wired to real endpoints with Bearer auth. Like, follow, and search functionality uses actual TanStack Query mutations/queries.

## Self-Check: PASSED
