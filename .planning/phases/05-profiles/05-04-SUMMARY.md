---
phase: 05-profiles
plan: 04
subsystem: ui
tags: [profiles, web, react, tanstack-query, clerk, infinite-scroll, intersection-observer, user-search-card]
dependency_graph:
  requires:
    - 05-02 (GET /api/v1/users/[username] returns { user, stats }; GET /api/v1/users/[username]/reviews paginated)
    - 05-03 (GET /api/v1/users/[username]/followers and /following; proxy.ts /@username rewrite)
  provides:
    - Profile page at app/(app)/[username]/page.tsx with avatar, bio, stats, infinite-scroll reviews
    - Followers list page at app/(app)/[username]/followers/page.tsx
    - Following list page at app/(app)/[username]/following/page.tsx
  affects:
    - apps/web/app/(app)/profile/page.tsx (redirects to /@username, now has UI destination)
    - apps/mobile profile screens (Plan 05-06 — mobile counterpart)
tech-stack:
  added: []
  patterns:
    - useInfiniteQuery with IntersectionObserver sentinel (replicated from feed page, query key ['profile-reviews', username])
    - useQuery for profile data fetch with null-on-404 pattern (not throw on 404)
    - React.use(params) for async params in Client Components (Next.js 16)
    - Optimistic like mutation targeting ['profile-reviews', username] cache key (separate from ['feed'] and ['my-reviews'])
    - isOwner derived by comparing clerkUser?.username vs profile username (D-08, JWT-verified via Clerk)
    - Custom not-found UI (notFound() not callable in Client Components)

key-files:
  created:
    - apps/web/app/(app)/[username]/page.tsx
    - apps/web/app/(app)/[username]/followers/page.tsx
    - apps/web/app/(app)/[username]/following/page.tsx
  modified: []

key-decisions:
  - "Profile page is a single Client Component (not RSC + Client hybrid) — avoids streaming complexity without meaningful benefit at this scale"
  - "notFound() not callable in Client Components — rendered as custom 404 UI matching UI-SPEC copywriting"
  - "isOwner check via clerkUser?.username vs user.username (Clerk JWT-verified) — not spoofable; edit action still requires authenticated PATCH API"
  - "Like mutation targets ['profile-reviews', username] — separate cache from ['feed'] and ['my-reviews'] to prevent cross-page cache corruption"
  - "React.use(params) used in followers/following pages (Client Components with async params per Next.js 16)"

patterns-established:
  - "Profile review list: query key ['profile-reviews', username] for useInfiniteQuery"
  - "Followers list: query key ['followers', username]; following list: query key ['following', username]"
  - "Back navigation via plain <a href> to /@username (no router.push — avoids hydration mismatch in simple cases)"

requirements-completed:
  - PROF-03
  - PROF-04
  - PROF-05
  - PROF-06

duration: 2min
completed: 2026-04-30
---

# Phase 5 Plan 04: Web Profile Page and Follower/Following List Pages Summary

**Three web pages giving /@username URLs a UI: profile header with infinite-scroll review list, and dedicated follower/following list pages using UserSearchCard.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-30T20:07:28Z
- **Completed:** 2026-04-30T20:09:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Profile page at `app/(app)/[username]/page.tsx` renders avatar (80px), bio, stats row with tappable follower/following links, Edit Profile or FollowButton CTA, and infinite-scroll review list via useInfiniteQuery + IntersectionObserver
- Followers page at `app/(app)/[username]/followers/page.tsx` fetches `/api/v1/users/${username}/followers` and renders UserSearchCard list with empty state and back link
- Following page at `app/(app)/[username]/following/page.tsx` is structurally identical to followers page with different endpoint, query key, and empty state copy
- All three pages consistent with UI-SPEC design tokens, typography, color, and copywriting contracts

## Task Commits

Each task was committed atomically:

1. **Task 1: Profile page at app/(app)/[username]/page.tsx** - `14ca76d` (feat)
2. **Task 2: Follower and following list pages** - `6fc90d1` (feat)

## Files Created/Modified

- `apps/web/app/(app)/[username]/page.tsx` — Profile page: avatar, bio, stats row, Edit profile/FollowButton, infinite-scroll review list
- `apps/web/app/(app)/[username]/followers/page.tsx` — Followers list: UserSearchCard list, empty state, back link to profile
- `apps/web/app/(app)/[username]/following/page.tsx` — Following list: UserSearchCard list, empty state, back link to profile

## Decisions Made

- Profile page as a **single Client Component** (not RSC + Client hybrid): avoids RSC streaming complexity without meaningful benefit at MVP scale. Profile data is user-specific and requires auth context (isOwner check) — making it a Server Component would complicate the Clerk identity check.
- `notFound()` cannot be called in Client Components — rendered a custom not-found UI matching UI-SPEC copywriting ("Profile not found" / "This account doesn't exist or may have been removed.").
- Like optimistic mutation targets `['profile-reviews', username]` — keeps the profile review cache separate from `['feed']` and `['my-reviews']` to prevent cross-page cache corruption on toggle.
- `React.use(params)` in followers/following pages — correct pattern for unwrapping async `params` in Client Components in Next.js 16.

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

The following 4 test failures existed before this plan and are unchanged:
- `restaurants.test.ts > MEAL-03: should accept mealType homemade with no restaurantId`
- `reviews.test.ts > REVW-02: should accept note up to 2000 characters`
- `reviews.test.ts > REVW-04: should accept tags as array of strings`
- `reviews.test.ts > REVW-05: should accept mealDate in YYYY-MM-DD format`

## Known Stubs

None — all three pages fetch live data from the API endpoints built in Plans 02-03. No placeholder text, hardcoded empty values, or mock data in the rendering path.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 web pages complete — /@username renders a full profile page accessible via the proxy.ts rewrite from Plans 03
- Plans 05-05 (edit profile page) and 05-06 (mobile profile screens) can proceed in parallel
- The "Edit profile" button links to `/profile/edit` — that route is created by Plan 05-05

---
*Phase: 05-profiles*
*Completed: 2026-04-30*

## Self-Check: PASSED

- FOUND: apps/web/app/(app)/[username]/page.tsx
- FOUND: apps/web/app/(app)/[username]/followers/page.tsx
- FOUND: apps/web/app/(app)/[username]/following/page.tsx
- FOUND: .planning/phases/05-profiles/05-04-SUMMARY.md
- FOUND: commit 14ca76d (Task 1)
- FOUND: commit 6fc90d1 (Task 2)
