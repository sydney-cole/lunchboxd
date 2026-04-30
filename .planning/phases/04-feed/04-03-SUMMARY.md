---
phase: 04-feed
plan: "03"
subsystem: feed
tags: [feed, infinite-scroll, review-card, useInfiniteQuery, IntersectionObserver, wave-2]
dependency_graph:
  requires: [04-01, 04-02, formatRelativeTime, GET /api/v1/feed]
  provides: [ReviewCard with showAuthor, FeedPage at /, infinite scroll]
  affects: [apps/web/components/review-card.tsx, apps/web/app/(app)/page.tsx]
tech_stack:
  added: []
  patterns: [useInfiniteQuery, IntersectionObserver, optimistic-InfiniteData-update, fan-out-on-read-ui]
key_files:
  created:
    - apps/web/app/(app)/page.tsx
  modified:
    - apps/web/components/review-card.tsx
  deleted:
    - apps/web/app/page.tsx
decisions:
  - showAuthor prop is optional and defaults to undefined — existing reviews page is backward compatible (kebab menu still shows when isOwnReview is undefined)
  - isOwnReview !== false gate on kebab menu — false hides it (other users' feed cards), undefined shows it (own reviews page)
  - Feed like mutation targets ['feed'] queryKey with InfiniteData pages structure — NOT ['my-reviews'] flat array
  - initialPageParam set to null as string | null — required by TanStack Query v5 API
  - IntersectionObserver threshold 0.1 fires at 10% sentinel visibility — triggers fetchNextPage before user hits hard bottom
  - app/page.tsx scaffold deleted — Next.js App Router automatically serves app/(app)/page.tsx at / via route group
  - Unescaped apostrophes replaced with &apos; entity — avoids Next.js JSX lint errors
metrics:
  duration_seconds: 112
  completed_date: "2026-04-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
  files_deleted: 1
---

# Phase 04 Plan 03: Feed Wave 2 Web UI Summary

**One-liner:** ReviewCard extended with optional showAuthor/author attribution row and FeedPage at / delivering infinite scroll via useInfiniteQuery + IntersectionObserver against GET /api/v1/feed.

## What Was Built

### ReviewCard extensions (apps/web/components/review-card.tsx)

Added three optional props while preserving full backward compatibility with the existing reviews page:

- `showAuthor?: boolean` — when true and `review.author` is present, renders an author attribution row as the first child inside the card body
- `isOwnReview?: boolean` — controls kebab menu visibility: `false` hides it (other users' cards in feed), `undefined` shows it (existing call sites unaffected)
- `review.createdAt?: string | Date` — used in the author row for relative time display via `formatRelativeTime`
- `review.author?: { username: string; avatarUrl: string | null } | null` — author data for attribution row

Author row renders: avatar (img if avatarUrl, else initials div) + `@username · Xm/Xh/Xd` relative timestamp.

Import added: `import { formatRelativeTime } from '@/lib/utils'`

### FeedPage (apps/web/app/(app)/page.tsx)

Full client component implementing the primary feed UI:

**Data fetching:**
- `useInfiniteQuery<FeedResponse>({ queryKey: ['feed'], initialPageParam: null, getNextPageParam: (p) => p.nextCursor })`
- TanStack Query v5 compliant (initialPageParam required)
- `staleTime: 60_000` consistent with existing patterns

**Infinite scroll:**
- `useRef<HTMLDivElement>(null)` sentinel div at list bottom
- `IntersectionObserver({ threshold: 0.1 })` attached in `useEffect`
- Fires `fetchNextPage()` when `hasNextPage && !isFetchingNextPage`
- No "Load more" button per D-06

**Like mutation (optimistic):**
- Targets `['feed']` queryKey — separate cache entry from `['my-reviews']` (per Pitfall 3)
- Updates `InfiniteData.pages[].items[]` structure (not flat array)
- Full rollback on error via context snapshot

**UI states:**
- Loading: centered `Loader2` spinner
- Error: "Couldn't load your feed" message
- Empty: `UtensilsCrossed` icon + "Nothing here yet" + link to `/search`
- End-of-feed: "You're all caught up." when `!hasNextPage && allItems.length > 0`
- Paginating: `Loader2` spinner below list while fetching next page

**Auth:** Protected by existing `app/(app)/layout.tsx` auth guard — no changes needed.

### Scaffold deletion

`apps/web/app/page.tsx` (default Next.js scaffold) deleted. Next.js App Router automatically serves `app/(app)/page.tsx` at the root `/` URL via route groups (parenthesized directories don't affect URL paths).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 74a77d2 | feat | Extend ReviewCard with showAuthor prop and author attribution row |
| de857ea | feat | Create FeedPage with infinite scroll at / and delete scaffold |

## Deviations from Plan

**1. [Rule 1 - Bug] Escaped apostrophes in JSX strings**
- **Found during:** Task 2 implementation
- **Issue:** Unescaped `'` in JSX text ("Couldn't", "You're") triggers Next.js/ESLint lint warnings and potential build errors
- **Fix:** Replaced with `&apos;` HTML entity in both strings
- **Files modified:** apps/web/app/(app)/page.tsx
- **Commit:** de857ea (included inline)

Otherwise plan executed as written.

## Known Stubs

None — both implementations are fully functional:
- ReviewCard author row renders real data when showAuthor={true} and review.author is provided
- FeedPage fetches live data from GET /api/v1/feed
- Like mutation performs real optimistic updates against the feed cache

## Self-Check: PASSED
