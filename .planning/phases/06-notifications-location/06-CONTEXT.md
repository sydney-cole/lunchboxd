# Phase 6: Notifications & Location - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two capabilities:

1. **In-app notifications** — Follow and like events write notification rows into the existing `notifications` table. Users see a red-dot indicator on a bell icon and can open a notification center (web: dropdown panel in nav; mobile: NotificationsScreen pushed from the Profile header) to view all activity in avatar + text + relative-time format. Opening the panel marks all notifications read.

2. **Interactive restaurant map** — An interactive map showing all reviewed restaurants that have coordinates. Restaurants reviewed by followed users are visually highlighted (distinct pin style); all public-review restaurants are shown simultaneously. A text search (by neighborhood/city) filters the list view. Restaurants without coordinates (manual entries) appear in the list only, not on the map.

Push notifications (NOTF-V2-01), notification preferences (NOTF-V2-02), restaurant aggregation pages (DISC-V2-01), and tag-based browse (DISC-V2-02) are NOT in scope.

</domain>

<decisions>
## Implementation Decisions

### Notification Delivery
- **D-01:** Notifications are written **inline in the existing route handlers** — after the follow INSERT succeeds in `POST /api/v1/follows`, immediately INSERT a notification row; same pattern for `POST /api/v1/likes`. No new background infrastructure.
- **D-02:** **Self-notifications are skipped** — if `actorId === userId`, skip the notification INSERT. Standard social-app behavior.

### Notification Center — Web
- **D-03:** A **bell icon in the top nav bar** opens a **dropdown/slide-down panel** listing recent notifications. No page navigation — panel overlays the current page. Fits Instagram/Twitter conventions.
- **D-04:** Opening the panel fires **`PATCH /api/v1/notifications/read-all`** — all unread notifications are marked read in one request.

### Notification Center — Mobile
- **D-05:** A **bell icon in the top-right of the Profile screen header** (not a new tab). Tapping it pushes a **`NotificationsScreen`** onto the navigation stack. No change to the locked tab bar (Feed → Search → New Review → Profile).

### Notification Row Format
- **D-06:** Each notification row renders: **avatar + action text + relative time**. Example: `[avatar] @sarah followed you · 2h ago`. Same avatar + @username + relative-time pattern used in feed cards — no new components needed for the actor avatar/username portion.

### Unread Badge
- **D-07:** **Red dot only** (boolean `has_unread`) — no count badge. A `GET /api/v1/notifications/unread` endpoint returns `{ hasUnread: boolean }`. Fetched on nav render via TanStack Query. Invalidated after `read-all` fires.

### Map Library
- **D-08:** **Web:** `@vis.gl/react-google-maps` — uses the existing `GOOGLE_PLACES_API_KEY`. No new API key or billing account. Consistent with the restaurant data source.
- **D-09:** **Mobile:** `react-native-maps` — uses Google Maps on Android, Apple Maps on iOS. Requires Expo dev build (already in use from Phase 1). Supports custom markers and callouts.

### Map Filter Model
- **D-10:** **Always show all reviewed restaurants** with coordinates on the map. Restaurants reviewed by people the current user follows get a **visually distinct pin** (different color/icon). No toggle needed — denser map with social signal embedded. Satisfies LOCN-03 ("prioritize followed, fall back to all") without a mode switch.

### Restaurants Without Coordinates
- **D-11:** Restaurants with `null` lat/lng (manual entries, incomplete cache entries) are **excluded from the map** and shown only in the list view (LOCN-02). No geocoding fallback — clean separation between map and list.

### Claude's Discretion
- Specific pin color/icon differentiation between followed-user restaurants and general public restaurants (use brand color vs. muted gray, or filled vs. outline pin)
- Map clustering for dense restaurant areas (use the library's built-in clustering or skip for v1)
- Notification panel max height and overflow scroll behavior
- Relative time formatting implementation (library or custom)
- API pagination for the notifications list (cursor-based, reuse Phase 4 pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, core value, constraints
- `.planning/REQUIREMENTS.md` — NOTF-01, NOTF-02, NOTF-03, LOCN-01, LOCN-02, LOCN-03 are the requirements for this phase
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, dependencies on Phase 4 and Phase 5

### Schema & Queries
- `apps/web/lib/schema.ts` — `notifications` table (id, userId, type, actorId, reviewId, read, createdAt); `restaurants` table (lat, lng columns — nullable, populated from Google Places); `reviews` table (restaurantId — nullable for homemade)

### Existing API Routes (patterns to follow)
- `apps/web/app/api/v1/follows/route.ts` — follow/unfollow handler; add notification INSERT after follow INSERT
- `apps/web/app/api/v1/restaurants/search/route.ts` — Google Places integration pattern; shows how lat/lng is captured and stored
- `apps/web/app/api/v1/feed/route.ts` — cursor-based pagination pattern (`createdAt` cursor, `nextCursor: string | null`); reuse for notifications list

### Existing UI Components (reuse)
- `apps/web/components/review-card.tsx` — avatar + @username + relative-time pattern (D-06 row format reference)
- `apps/mobile/app/(app)/(tabs)/profile.tsx` — Profile screen; bell icon goes in this screen's header

### Auth Patterns
- `.planning/STATE.md` — Clerk 7 auth patterns; `resolveUserId()` usage; mobile Bearer token pattern
- Prior phases context: `.planning/phases/05-profiles/05-CONTEXT.md` — D-04 uploads, D-06 letter avatar fallback

### External Libraries
- Google Maps JS API (New) via `@vis.gl/react-google-maps` — uses existing `GOOGLE_PLACES_API_KEY`
- `react-native-maps` — mobile map; requires Expo dev build (already in use)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notifications` table in `apps/web/lib/schema.ts` — already migrated; schema covers all three event types (follow, like, comment)
- `restaurants.lat` / `restaurants.lng` — already populated by Google Places upsert in `restaurants/search/route.ts`; map can query these directly
- Feed card avatar + relative-time rendering — reuse for notification row format (D-06)
- `resolveUserId()` in `apps/web/lib/queries.ts` — required in all new authed API routes
- Cursor-based pagination from Phase 4 feed — reuse for `GET /api/v1/notifications` list

### Established Patterns
- API routes at `apps/web/app/api/v1/` — new routes: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread`, `PATCH /api/v1/notifications/read-all`
- Map data route: `GET /api/v1/restaurants/map` — returns restaurants with lat/lng (WHERE lat IS NOT NULL AND lng IS NOT NULL), enriched with `reviewedByFollowed: boolean`
- List/search route: `GET /api/v1/restaurants/reviewed?q=<city>` — returns all reviewed restaurants (with and without coordinates), filtered by search query
- Clerk `auth()` server-side in all API routes; `useUser()` / `getToken()` on mobile
- Mobile Bearer token: `getToken()` inside `queryFn` (not at hook level) — matches all prior mobile API calls

### Integration Points
- Follow handler (`POST /api/v1/follows`) → add notification INSERT after successful follow INSERT
- Like handler (`POST /api/v1/likes`) → add notification INSERT after successful like INSERT
- Nav component (web) → add bell icon with `has_unread` query; invalidate on `read-all`
- Profile screen (mobile) → add bell icon to header; push NotificationsScreen on tap
- Map page → new web route `app/(app)/map/page.tsx`; new mobile screen `app/(app)/(tabs)/map.tsx` or accessible via search tab

</code_context>

<specifics>
## Specific Ideas

- Notification row text: `@{actor} followed you`, `@{actor} liked your review of {restaurant}` (or `your homemade meal` if no restaurant)
- Red dot only — no number count — keeps the bell clean
- All restaurants on map always visible; followed-user restaurants get a distinct pin color (brand color vs. muted)
- Manual-entry restaurants appear in list search results only, never on map

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-notifications-location*
*Context gathered: 2026-05-01*
