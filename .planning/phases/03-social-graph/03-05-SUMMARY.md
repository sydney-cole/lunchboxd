---
phase: 03-social-graph
plan: 05
subsystem: web, social-graph
tags: [tanstack-query, follow-button, user-search, debounce, client-component]
dependency_graph:
  requires: [03-02, 03-04]
  provides: [search-page, follow-button-component, user-search-card-component]
  affects: [03-06, 03-07]
tech_stack:
  added: []
  patterns: [debounced-usequery, usemutation-optimistic-invalidate, three-state-button]
key_files:
  created:
    - apps/web/app/(app)/search/page.tsx
    - apps/web/components/follow-button.tsx
    - apps/web/components/user-search-card.tsx
  modified: []
decisions:
  - "FollowButton uses query invalidation (not optimistic update) — simpler and ensures follow state reflects server truth after mutation"
  - "300ms debounce + 2 char minimum in SearchPage — prevents rapid-fire API calls on every keystroke"
  - "staleTime: 30_000 on user-search query — prevents result flicker during navigation without stale data risk"
  - "UserSearchCard shows displayName as primary label and @username as secondary when displayName present — consistent with social app conventions"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
requirements: [SOCL-01, SOCL-02, SOCL-03, SOCL-05]
---

# Phase 3 Plan 05: Search Page and Follow Button UI Summary

**One-liner:** /search Client Component with 300ms debounced TanStack Query fetching user results, plus three-state FollowButton (Follow/Following/Friends) using useMutation against /api/v1/follows.

## What Was Built

**`apps/web/components/follow-button.tsx`** — Three-state follow button:
- Accepts `targetUserId` and `initialState` (`none | following | friends`)
- `useMutation` calls POST /api/v1/follows (follow) or DELETE /api/v1/follows (unfollow)
- Labels: "Follow" (none), "Following" (following), "Friends" (friends)
- Style: filled accent for "Follow", outline for "Following"/"Friends" with destructive hover hint
- Invalidates `['user-search']` query on success to refresh follow states in the results list

**`apps/web/components/user-search-card.tsx`** — Search result card:
- Renders circular avatar (image or initial letter fallback), display name / @username, and FollowButton
- No bio, review count, or any extra fields per D-03
- Hover border accent for visual affordance

**`apps/web/app/(app)/search/page.tsx`** — Search page:
- `'use client'` with controlled input and `useState` debounce pattern
- 300ms `setTimeout` debounce, 2 character minimum gate before firing query
- `useQuery` with `enabled: debouncedQuery.length >= 2` and `staleTime: 30_000`
- Fetches `/api/v1/users/search?q=...` and maps results to `UserSearchCard` components
- Handles loading state ("Searching..."), empty state ("No users found"), and results list

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FollowButton and UserSearchCard components | 5edfb39 | apps/web/components/follow-button.tsx, apps/web/components/user-search-card.tsx |
| 2 | Create /search page with debounced input and results list | 850cd73 | apps/web/app/(app)/search/page.tsx |

## Verification Results

- `grep "export function FollowButton"` — PASS (line 12)
- `grep "export function UserSearchCard"` — PASS (line 18)
- `grep "'use client'"` in follow-button.tsx — PASS
- `grep "useMutation"` in follow-button.tsx — PASS
- `grep "api/v1/follows"` in follow-button.tsx — PASS
- Three labels 'Friends', 'Following', 'Follow' in follow-button.tsx — PASS
- `grep "FollowButton"` import in user-search-card.tsx — PASS
- No `bio` or `reviewCount` in user-search-card.tsx — PASS
- `grep "'use client'"` in search/page.tsx — PASS
- `grep "export default function SearchPage"` — PASS
- `grep "useQuery"` in search/page.tsx — PASS
- `grep "setTimeout(() => setDebouncedQuery(query), 300)"` — PASS
- `grep "query.length < 2"` — PASS
- `grep "api/v1/users/search"` in search/page.tsx — PASS
- `grep "UserSearchCard"` in search/page.tsx — PASS
- `grep "staleTime: 30_000"` in search/page.tsx — PASS
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — social.test.ts 13/13 PASS; 4 pre-existing failures in restaurants.test.ts + reviews.test.ts (documented in deferred-items.md from 03-04, unrelated to this plan)

## Decisions Made

- Query invalidation on follow mutation instead of optimistic update — server-authoritative follow state is simpler and avoids stale UI on error
- `staleTime: 30_000` on user-search — prevents result flicker when navigating back to the search page within a session
- UserSearchCard shows `displayName ?? username` as primary text and `@username` as secondary when displayName is present — conventional social app display hierarchy

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three components are fully wired: FollowButton calls live API endpoints, UserSearchCard renders real user data, and SearchPage fetches from the real search API with proper auth (Clerk middleware handles redirect for unauthenticated users).

## Self-Check: PASSED

- `apps/web/components/follow-button.tsx` — FOUND
- `apps/web/components/user-search-card.tsx` — FOUND
- `apps/web/app/(app)/search/page.tsx` — FOUND
- Commit 5edfb39 — FOUND
- Commit 850cd73 — FOUND
- `pnpm --filter web type-check` — exit 0
