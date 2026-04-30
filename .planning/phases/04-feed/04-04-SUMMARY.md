---
phase: 04-feed
plan: "04"
subsystem: mobile
tags: [react-native, expo, flatlist, useInfiniteQuery, tanstack-query, cursor-pagination, pull-to-refresh, optimistic-update, wave-2]

dependency_graph:
  requires:
    - phase: 04-02
      provides: GET /api/v1/feed cursor-paginated endpoint
  provides:
    - Mobile FeedScreen with FlatList, useInfiniteQuery, pull-to-refresh, onEndReached pagination
    - 4-tab layout (Feed, Search, New Review, Profile)
    - Profile tab stub for Expo Router registration
  affects: [apps/mobile]

tech-stack:
  added: []
  patterns: [useInfiniteQuery-mobile, InfiniteData-optimistic-update-mobile, getToken-inside-queryFn, FlatList-virtualization]

key-files:
  created:
    - apps/mobile/app/(app)/(tabs)/profile.tsx
  modified:
    - apps/mobile/app/(app)/(tabs)/index.tsx
    - apps/mobile/app/(app)/(tabs)/_layout.tsx

key-decisions:
  - "Mobile feed uses FlatList (not ScrollView) for virtualization — required per RESEARCH.md Pitfall 6"
  - "getToken() called inside queryFn and mutationFn, never at component level — Clerk Expo pattern"
  - "Like mutation targets ['feed'] InfiniteData pages structure (not ['my-reviews'] flat array)"
  - "initialPageParam: null as string | null — TanStack Query v5 compliance"
  - "formatRelativeTime hand-rolled inline — mirrors apps/web/lib/utils.ts, no shared import needed for mobile"
  - "Apostrophes in React Native JSX use {'...'} expression syntax, not HTML &apos; entities"
  - "Tab title renamed from 'Home' to 'Feed' per D-02 decision"

patterns-established:
  - "FlatList with onRefresh/refreshing for pull-to-refresh pattern in mobile feed"
  - "useInfiniteQuery with getNextPageParam returning nextCursor for cursor pagination on mobile"
  - "Optimistic like update targeting InfiniteData pages structure (not flat array)"

requirements-completed: [FEED-01, FEED-02]

duration: 8min
completed: "2026-04-30"
---

# Phase 04 Plan 04: Mobile Feed (Wave 2) Summary

**Mobile home tab rewritten as FlatList feed with useInfiniteQuery(['feed']), pull-to-refresh, cursor pagination, per-card like optimistic updates, and author attribution using the GET /api/v1/feed API.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-30T09:43:00Z
- **Completed:** 2026-04-30T09:51:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote index.tsx from ScrollView/useQuery(['my-reviews'])/GET /api/v1/reviews to FlatList/useInfiniteQuery(['feed'])/GET /api/v1/feed
- Added pull-to-refresh (onRefresh/refreshing) and onEndReached pagination at 0.3 threshold
- Implemented FeedCard component with author avatar, @username, relative time, meal name, star rating, note, and like button
- Extended _layout.tsx from 3 tabs to 4: Feed, Search, New Review, Profile (renamed Home to Feed per D-02)
- Created profile.tsx stub so Expo Router registers the tab without crashing

## Task Commits

1. **Task 1: 4-tab layout and profile stub** - `9462dfc` (feat)
2. **Task 2: Rewrite index.tsx as FlatList feed** - `fe4019b` (feat)

## Files Created/Modified

- `apps/mobile/app/(app)/(tabs)/_layout.tsx` - Updated: 4 tabs, renamed Home to Feed, added Profile tab
- `apps/mobile/app/(app)/(tabs)/profile.tsx` - Created: stub ProfileScreen with "Profile coming soon" text
- `apps/mobile/app/(app)/(tabs)/index.tsx` - Rewritten: FlatList feed with useInfiniteQuery, pull-to-refresh, pagination, FeedCard, like mutation

## Decisions Made

- Mobile feed uses FlatList (not ScrollView) — virtualization required for potentially large feed lists
- getToken() called inside queryFn and mutationFn only, not at component level — matches existing compose.tsx and search.tsx patterns
- Like mutation targets ['feed'] InfiniteData pages structure, correctly separate from ['my-reviews'] flat array cache used by the reviews page
- initialPageParam: null as string | null — required by TanStack Query v5 (would type error without explicit type)
- formatRelativeTime hand-rolled inline in index.tsx — mirrors apps/web/lib/utils.ts logic without needing a shared package import
- Apostrophes in React Native Text components use `{'string with apostrophe'}` JSX expression syntax — HTML entities (&apos;) are not valid in React Native

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed HTML entity usage in React Native JSX**
- **Found during:** Task 2 (post-write review)
- **Issue:** Plan template used `&apos;` HTML entities in React Native Text content. React Native does not process HTML entities — they would render literally as "&apos;" in the app
- **Fix:** Changed `Couldn&apos;t` to `{"Couldn't"}` and `You&apos;re` to `{"You're"}` using JSX expression syntax
- **Files modified:** apps/mobile/app/(app)/(tabs)/index.tsx
- **Verification:** JSX expression syntax is correct React Native pattern
- **Committed in:** fe4019b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix necessary for correct text rendering in React Native. No scope creep.

## Issues Encountered

- Web test suite has 4 pre-existing failures (REVW-02, REVW-04, REVW-05, MEAL-03) documented across all prior Phase 4 summaries. These are out of scope for this plan and were not introduced by any changes here.

## Known Stubs

- `apps/mobile/app/(app)/(tabs)/profile.tsx` — Profile screen is a stub ("Profile coming soon"). This is intentional: Phase 5 (Profiles) will replace this with the full profile implementation. The stub satisfies the Expo Router tab registration requirement for this plan.

## Next Phase Readiness

- Full feed pipeline complete: API (04-02) + web UI (04-03) + mobile UI (04-04)
- Phase 4 Feed complete (all 4 plans done)
- Phase 5 Profiles can start: profile.tsx stub provides the tab mount point that Phase 5 will replace

## Self-Check: PASSED

- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — FOUND (verified: 4 tabs, Feed title, Profile tab)
- `apps/mobile/app/(app)/(tabs)/profile.tsx` — FOUND (verified: "Profile coming soon")
- `apps/mobile/app/(app)/(tabs)/index.tsx` — FOUND (verified: FlatList, useInfiniteQuery, no ScrollView)
- Commit `9462dfc` — FOUND
- Commit `fe4019b` — FOUND

---
*Phase: 04-feed*
*Completed: 2026-04-30*
