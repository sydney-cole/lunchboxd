# Phase 4: Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 04-feed
**Areas discussed:** Feed page placement, Pagination mechanism, Feed card design, Refresh behavior

---

## Feed Page Placement

### Web placement

| Option | Description | Selected |
|--------|-------------|----------|
| Home page / | Feed is the landing page after login. Most social apps make feed the home screen. | ✓ |
| Dedicated /feed route | Feed at /feed; home (/) stays as marketing landing or redirects to /reviews. | |

**User's choice:** Home page /
**Notes:** Feed renders directly at the root route for authenticated users.

### Mobile placement

| Option | Description | Selected |
|--------|-------------|----------|
| Home tab (first tab) | Feed is the default tab on open — most natural for a social app. | ✓ |
| Second tab after Home/Discover | Feed is secondary; useful for a future discover tab as default. | |
| You decide | Claude picks idiomatic Expo Router tab placement. | |

**User's choice:** Home tab (first tab)
**Notes:** Tab order: Feed → Search → New Review → Profile.

---

## Pagination Mechanism

### API pagination strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-based | Use last item's createdAt as cursor. No drift when new reviews post between page loads. | ✓ |
| Offset-based | Simple ?page=1&limit=20. Familiar but items can shift when new reviews are inserted. | |

**User's choice:** Cursor-based
**Notes:** `feedItems.createdAt` is the cursor field. Response shape: `{ items: [...], nextCursor: string | null }`.

### Load more UX

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite scroll | Auto-load next page as user approaches bottom via useInfiniteQuery. | ✓ |
| 'Load more' button | Explicit button at bottom. Simpler, user-controlled. | |
| You decide | Claude picks based on existing reviews page. | |

**User's choice:** Infinite scroll (useInfiniteQuery)

### Page size

| Option | Description | Selected |
|--------|-------------|----------|
| 20 per page | Standard for social feeds. Fills screen with context to spare. | ✓ |
| 10 per page | Lighter initial load but more frequent fetches. | |
| You decide | Claude picks based on card height and viewport. | |

**User's choice:** 20 per page

---

## Feed Card Design

### Author attribution approach

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing ReviewCard | Add `showAuthor` prop to ReviewCard. Feed passes true; my-reviews passes false. | ✓ |
| New FeedCard component | Separate component optimized for feed — more flexibility but doubles card surface area. | |
| You decide | Claude picks least-duplication approach. | |

**User's choice:** Extend existing ReviewCard with `showAuthor` prop

### Author info format

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + @username + relative time | e.g. 📷 @sarah · 2h ago. Enough context without crowding. | ✓ |
| Avatar + display name + @username | e.g. Sarah Chen (@sarah). Full identity, no time context at a glance. | |
| You decide | Claude picks based on existing card layout. | |

**User's choice:** Avatar + @username + relative time

---

## Refresh Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Load on open only | Feed loads on mount. No auto-refresh. User navigates away and back to see new items. | |
| Auto-poll every 30–60s | TanStack Query refetchInterval. New items prepend. Risk of scroll jump. | |
| Pull-to-refresh (mobile) + load-on-open (web) | Mobile gets PTR; web stays load-on-mount. Best native feel per platform. | ✓ |

**User's choice:** Pull-to-refresh on mobile, load-on-open on web
**Notes:** Mobile uses FlatList/ScrollView `onRefresh`. Web relies on TanStack Query's default window-focus refetch.

---

## Claude's Discretion

- Intersection observer implementation for infinite scroll trigger
- Loading skeleton or spinner between page fetches
- Empty state design ("Follow someone to see their reviews here" + link to /search)
- Like button behavior on feed cards (reuse existing Phase 3 mutation)
- FlatList vs ScrollView choice on mobile
- Relative time formatting

## Deferred Ideas

None — discussion stayed within phase scope.
