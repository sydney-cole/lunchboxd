# Phase 4: Feed - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the social feed — a paginated, chronological list of reviews from people the current user follows, visible on the home page (web) and the home tab (mobile). The fan-out-on-write infrastructure already exists (feedItems table, fanOutToFollowers(), unfollow cleanup); this phase builds the API endpoint and the UI that surfaces it.

New capabilities (notifications, profiles, discovery, algorithmic ranking) are NOT in scope. The feed is chronological only.

</domain>

<decisions>
## Implementation Decisions

### Feed Placement
- **D-01:** Web feed lives at `/` (the home page after login). The root route renders the feed directly — no redirect to `/feed`.
- **D-02:** Mobile feed is the first tab (home tab) in the tab bar. Tab order: Feed → Search → New Review → Profile.

### Pagination
- **D-03:** Feed API uses **cursor-based pagination** using `feedItems.createdAt` as the cursor. Query: `WHERE owner_user_id = $me AND created_at < $cursor ORDER BY created_at DESC LIMIT 20`. No offset/page-number approach.
- **D-04:** API shape: `GET /api/v1/feed` (first page, no cursor), `GET /api/v1/feed?cursor=<ISO8601>&limit=20` (subsequent pages). Response: `{ items: [...], nextCursor: string | null }`.
- **D-05:** Page size: **20 reviews per page**.
- **D-06:** Web uses **infinite scroll** via TanStack Query's `useInfiniteQuery`. Items append to the list as the user scrolls to the bottom — no "Load more" button.

### Feed Card Design
- **D-07:** Extend the existing `ReviewCard` component with an optional **`showAuthor` prop**. When `true`, renders author attribution at the top of the card. The feed always passes `showAuthor={true}`; the "my reviews" page continues to pass `showAuthor={false}` (or omit it).
- **D-08:** Author attribution format: **avatar + @username + relative time** (e.g., `📷 @sarah · 2h ago`). No display name — username is sufficient for the card.

### Refresh Behavior
- **D-09:** **Web:** Feed loads on mount only. No auto-poll, no background refetch interval. User sees new items by navigating away and back (TanStack Query's default window-focus refetch handles this).
- **D-10:** **Mobile:** Pull-to-refresh via FlatList/ScrollView's `onRefresh` prop. Triggers a manual refetch of the feed query. Same cursor-based fetch, just resets to the first page.

### Claude's Discretion
- Intersection observer implementation for infinite scroll trigger (use `IntersectionObserver` API or a library like `react-intersection-observer`)
- Visual loading skeleton or spinner while fetching next page
- Empty state design (suggested: "Follow someone to see their reviews here" with a link to `/search`)
- Like button behavior on feed cards (reuse existing like mutation from Phase 3 — should work unchanged)
- FlatList vs ScrollView choice on mobile for the feed list
- Relative time formatting library or implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, core value, constraints
- `.planning/REQUIREMENTS.md` — FEED-01 (chronological feed) and FEED-02 (paginated, loads more on scroll) are the requirements for this phase
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, dependency on Phase 3
- `.planning/STATE.md` — All locked stack decisions; accumulated context from Phases 1–3; fan-out-on-write decision is listed as non-negotiable

### Prior Phase Artifacts
- `.planning/phases/03-social-graph/03-CONTEXT.md` — D-06: no backfill on follow; feed_items cleanup on unfollow; feed_items table details
- `.planning/phases/02-reviews-meals/02-03-PLAN.md` — fanOutToFollowers() call site in review POST route; fan-out implementation to reference

### Schema & Queries
- `apps/web/lib/schema.ts` — `feedItems` table definition; `feedItemsOwnerIdx` on `ownerUserId`; `reviews`, `users`, `restaurants`, `likes` tables needed for feed JOIN
- `apps/web/lib/queries.ts` — `fanOutToFollowers()` implementation; `resolveUserId()` helper

### Existing UI Components
- `apps/web/components/ReviewCard.tsx` (or equivalent path) — existing ReviewCard to extend with `showAuthor` prop; like button integration already present from Phase 3
- `CLAUDE.md` — Tech stack decisions; "Use Client Components for the feed (real-time feel, infinite scroll)"; TanStack Query v5 usage patterns

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/queries.ts` — `fanOutToFollowers()` writes `feed_items`; `resolveUserId()` converts Clerk ID to internal UUID — reuse both
- `apps/web/lib/schema.ts` — `feedItems` table ready; `feedItemsOwnerIdx` on `ownerUserId` — the feed query (`WHERE owner_user_id = $me ORDER BY created_at DESC`) hits this index
- `apps/web/components/ReviewCard` — exists from Phase 2, updated with like button in Phase 3; extend with `showAuthor` prop (no new component needed)
- TanStack Query `useInfiniteQuery` — already installed; used for reviews list in Phase 2; same pattern for feed

### Established Patterns
- API routes under `apps/web/app/api/v1/` — new feed endpoint: `GET /api/v1/feed`
- Clerk auth: `auth()` server-side in API routes to get `userId`; `useUser()` client-side
- Mobile API calls: Clerk `getToken()` Bearer header (no cookies on mobile) — same pattern as all prior mobile API calls
- No `db.transaction()` — Neon HTTP adapter; sequential awaits only
- TanStack query key convention: string array (e.g., `['feed']`) — follow existing pattern from `['my-reviews']`, `['user-search']`

### Integration Points
- Feed API (`GET /api/v1/feed`) → queries `feed_items JOIN reviews JOIN users JOIN restaurants` where `feed_items.owner_user_id = $me`, ordered by `feed_items.created_at DESC`, cursor paginated
- ReviewCard on feed page → `showAuthor={true}` passes author user object; like button mutation uses same `['my-reviews']`-adjacent key (new: `['feed']`)
- Mobile feed tab → FlatList with `onRefresh` + `onEndReached` for pull-to-refresh and pagination; same Clerk Bearer auth as compose/search screens

</code_context>

<specifics>
## Specific Ideas

- Feed card author row format: avatar image + `@username` + `· 2h ago` (relative time) in a single row above the review content
- Tab bar on mobile: [Feed] [Search] [New Review] [Profile] — feed is leftmost (index 0)
- Web root `/` renders feed directly (authenticated); unauthenticated users redirected to `/sign-in` by Clerk middleware (already configured)
- Cursor field: `feedItems.createdAt` (ISO 8601 timestamp) — passed as query param, compared with `lt()` in Drizzle query

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-feed*
*Context gathered: 2026-04-29*
