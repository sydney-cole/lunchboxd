---
phase: 03-social-graph
plan: 06
subsystem: web, ui, likes
tags: [tanstack-query, optimistic-update, like-toggle, review-card, social-graph]
dependency_graph:
  requires: [03-03]
  provides: [review-card-like-button, optimistic-like-mutation]
  affects: [03-07]
tech_stack:
  added: []
  patterns: [optimistic-update-with-rollback, tanstack-query-cancel-refetch]
key_files:
  created: []
  modified:
    - apps/web/components/review-card.tsx
    - apps/web/app/(app)/reviews/page.tsx
decisions:
  - "Like query key is 'my-reviews' (not 'reviews') — matches existing fetch key in reviews page to ensure optimistic updates hit the correct cache entry"
  - "staleTime: 60_000 added to reviews query to prevent like state flicker on back-navigation"
  - "Optimistic update uses onMutate snapshot + onError rollback pattern per TanStack Query docs"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
requirements: [SOCL-04]
---

# Phase 3 Plan 06: Like Button UI and Optimistic Mutations Summary

**One-liner:** ReviewCard now shows a Heart icon with like count; the reviews page wires a TanStack Query optimistic mutation that toggles like state instantly and rolls back on API error.

## What Was Built

Extended `apps/web/components/review-card.tsx`:
- Added `Heart` icon import from lucide-react
- Extended `ReviewCardProps` with `likeCount: number`, `isLikedByMe: boolean`, and `onLike: (id: string) => void`
- Added like button row at bottom of card body (below meal date, above card edge) with a top border separator
- Heart icon fills red (`fill-destructive text-destructive`) when `isLikedByMe` is true, outline otherwise
- `aria-label` toggles between "Like review" and "Unlike review" for accessibility
- All existing functionality preserved: kebab menu, edit/delete, photo thumbnail, star rating, body text with clamp, tags, meal date

Extended `apps/web/app/(app)/reviews/page.tsx`:
- Renamed `Review` interface to `ReviewWithLike` adding `likeCount` and `isLikedByMe` fields
- Added `staleTime: 60_000` to reviews query to prevent like state flicker on navigation
- Added `likeMutation` with full optimistic update pattern:
  - `onMutate`: cancels outgoing refetches, snapshots previous data, optimistically toggles `isLikedByMe` and adjusts `likeCount` by ±1
  - `onError`: restores previous snapshot on API failure (rollback)
  - `onSettled`: invalidates `['my-reviews']` query to sync server state
- Passed `onLike={(id) => likeMutation.mutate({ reviewId: id })}` to each ReviewCard

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ReviewCard props and add like button with Heart icon | 268f44f | apps/web/components/review-card.tsx |
| 2 | Wire optimistic like mutation into the reviews page | 43b94fe | apps/web/app/(app)/reviews/page.tsx |

## Verification Results

- `grep "Heart" apps/web/components/review-card.tsx` — PASS
- `grep "onLike\|likeCount\|isLikedByMe" apps/web/components/review-card.tsx` — PASS
- `grep "useMutation\|previousReviews\|api/v1/likes" apps/web/app/(app)/reviews/page.tsx` — PASS
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — auth.test.ts 11/11 PASS, social.test.ts 13/13 PASS (4 pre-existing failures in restaurants.test.ts and reviews.test.ts are out of scope — documented in 03-01-SUMMARY.md and 03-03-SUMMARY.md)

## Decisions Made

- The existing query key in the reviews page is `['my-reviews']` (not `['reviews']` as suggested in the plan template). The optimistic mutation uses `['my-reviews']` to match — corrected in implementation.
- `staleTime: 60_000` added to the reviews query per plan requirement to prevent like state flicker when users navigate away and return.
- Standard TanStack Query optimistic pattern: cancelQueries → snapshot → setQueryData → return context; rollback in onError; invalidate in onSettled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Query key adjusted from `['reviews']` to `['my-reviews']`**
- **Found during:** Task 2
- **Issue:** Plan template showed `queryKey: ['reviews']` in the mutation code, but the actual reviews page uses `queryKey: ['my-reviews']` for the fetch. Using `['reviews']` would cause the optimistic update to target a non-existent cache entry, silently failing.
- **Fix:** Used `['my-reviews']` consistently in `cancelQueries`, `getQueryData`, `setQueryData`, and `invalidateQueries`.
- **Files modified:** apps/web/app/(app)/reviews/page.tsx
- **Commit:** 43b94fe

### Pre-existing Test Failures (Out of Scope — Not Fixed)

The same 4 pre-existing failures documented in 03-01-SUMMARY.md and 03-03-SUMMARY.md remain:
- MEAL-03, REVW-02, REVW-04, REVW-05 (in restaurants.test.ts and reviews.test.ts)

These failures exist before any Phase 03 changes and are not caused by this plan's changes.

## Known Stubs

None. The like button is fully wired to the optimistic mutation which calls the real `/api/v1/likes` endpoint.

## Self-Check: PASSED

- `apps/web/components/review-card.tsx` — FOUND, contains Heart import, likeCount, isLikedByMe, onLike, fill-destructive
- `apps/web/app/(app)/reviews/page.tsx` — FOUND, contains likeMutation, previousReviews, onMutate, onError, onSettled, onLike prop
- Commit 268f44f — FOUND
- Commit 43b94fe — FOUND
