# Phase 6: Notifications & Location - Research

**Researched:** 2026-05-01
**Domain:** In-app notifications (TanStack Query polling, Drizzle INSERT/UPDATE patterns) + interactive maps (@vis.gl/react-google-maps, react-native-maps)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Notifications written inline in existing route handlers — after follow INSERT → INSERT notification; after like INSERT → INSERT notification. No new background infrastructure.
- **D-02:** Self-notifications skipped — if `actorId === userId`, skip the notification INSERT.
- **D-03:** Web: bell icon in top nav bar opens a dropdown/slide-down panel. No page navigation.
- **D-04:** Opening the panel fires `PATCH /api/v1/notifications/read-all` — all unread marked read in one request.
- **D-05:** Mobile: bell icon in Profile screen header (not a new tab). Tapping pushes `NotificationsScreen` onto the navigation stack.
- **D-06:** Each notification row: avatar + action text + relative time. Reuse feed card avatar/username/relative-time pattern.
- **D-07:** Red dot only (boolean `has_unread`) — no count badge. `GET /api/v1/notifications/unread` returns `{ hasUnread: boolean }`. Fetched on nav render, invalidated after `read-all`.
- **D-08:** Web map: `@vis.gl/react-google-maps` using existing `GOOGLE_PLACES_API_KEY`.
- **D-09:** Mobile map: `react-native-maps` (Google Maps on Android, Apple Maps on iOS). Requires Expo dev build (already in use).
- **D-10:** Always show all reviewed restaurants with coordinates. Restaurants reviewed by followed users get a visually distinct pin (different color/icon). No toggle.
- **D-11:** Restaurants with null lat/lng excluded from map, shown only in list view. No geocoding fallback.

### Claude's Discretion

- Specific pin color/icon differentiation (brand color vs. muted gray, or filled vs. outline pin)
- Map clustering for dense restaurant areas (use library's built-in clustering or skip for v1)
- Notification panel max height and overflow scroll behavior
- Relative time formatting implementation (library or custom — `formatRelativeTime` already exists in `lib/utils.ts`)
- API pagination for the notifications list (cursor-based, reuse Phase 4 pattern)

### Deferred Ideas (OUT OF SCOPE)

- Push notifications (NOTF-V2-01)
- Notification preferences (NOTF-V2-02)
- Restaurant aggregation pages (DISC-V2-01)
- Tag-based browse (DISC-V2-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | User receives in-app notification when someone follows them | D-01: INSERT into notifications after follow; `resolveUserId` for actor; reviewed likes route as model |
| NOTF-02 | User receives in-app notification when someone likes their review | D-01: INSERT into notifications after like; requires fetching review owner to write `userId`; D-02 skips self |
| NOTF-03 | User can view all notifications in notification center | Three API routes (GET list, GET unread, PATCH read-all); web dropdown + mobile NotificationsScreen |
| LOCN-01 | User can browse interactive map of reviewed restaurants | `@vis.gl/react-google-maps` on web; `react-native-maps` on mobile; `GET /api/v1/restaurants/map` endpoint |
| LOCN-02 | User can search reviewed restaurants by neighborhood/city and see list | `GET /api/v1/restaurants/reviewed?q=<city>` with ILIKE on `city`/`address` columns |
| LOCN-03 | Location browse prioritizes reviews from followed users, falling back to all | `reviewedByFollowed: boolean` flag on each restaurant in map/list endpoints; distinct pin color for followed |
</phase_requirements>

---

## Summary

Phase 6 delivers two independent capabilities that share no data dependencies with each other, enabling parallel implementation after schema work is complete.

**Notifications** wire up two existing event points (follow and like handlers) to the already-migrated `notifications` table. Three new API routes are needed: `GET /api/v1/notifications` (paginated list), `GET /api/v1/notifications/unread` (boolean check), and `PATCH /api/v1/notifications/read-all`. The TanStack Query polling pattern is already used in the feed; the same approach (query key invalidation) handles the unread badge. All schema, auth, and pagination patterns are directly inherited from prior phases — there is no new infrastructure. The key implementation detail is that the like notification requires fetching the review's `userId` before inserting (to know who to notify), and must skip insertion when `actorId === userId` (D-02).

**Location** introduces the only two new external library dependencies in this phase: `@vis.gl/react-google-maps` (web, v1.8.3) and `react-native-maps` (mobile, v1.27.2). The web map integrates cleanly with the existing `GOOGLE_PLACES_API_KEY` via `APIProvider`. The mobile map requires adding the `react-native-maps` plugin to `app.json` and a new EAS build (the dev build needs rebuilding when native config changes). Both maps consume a new `GET /api/v1/restaurants/map` endpoint that JOINs restaurants, reviews, users, and follows to compute the `reviewedByFollowed` boolean. Restaurants without `lat`/`lng` are excluded from the map query and only appear in the list search endpoint.

**Primary recommendation:** Implement in Wave order — Wave 0: Zod schemas + test stubs; Wave 1: three notification API routes + two restaurant/map API routes (parallel); Wave 2: web notification bell + web map page + mobile notification screen + mobile map screen (parallel).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Notification INSERT (follow event) | API / Backend | — | Server-side only; actor ID derived from Clerk session, never client |
| Notification INSERT (like event) | API / Backend | — | Same; requires fetching review owner server-side |
| Unread badge state | Frontend Server (SSR) query + Client | API | `GET /notifications/unread` fetched client-side via TanStack Query on nav render |
| Notification list | API / Backend + Client | — | Cursor-paginated API; client renders with TanStack Query |
| Mark-all-read | API / Backend | — | `PATCH` endpoint; client invalidates TanStack Query cache |
| Interactive map (web) | Browser / Client | — | Google Maps JS API requires browser context; `'use client'` mandatory |
| Map data | API / Backend | Database | `GET /api/v1/restaurants/map` server query with JOIN to compute `reviewedByFollowed` |
| Restaurant list search | API / Backend | Database | ILIKE query on `city`/`address`; optional `q` param |
| Map render (mobile) | React Native (device) | — | `react-native-maps` renders natively; no SSR concept |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vis.gl/react-google-maps` | 1.8.3 | Web interactive map | D-08 locked; uses existing `GOOGLE_PLACES_API_KEY`; React component wrapper for Google Maps JS API; App Router compatible with `'use client'` |
| `react-native-maps` | 1.27.2 | Mobile interactive map | D-09 locked; Google Maps (Android) + Apple Maps (iOS); Expo managed workflow supported via plugin |

[VERIFIED: npm registry — `@vis.gl/react-google-maps@1.8.3` is latest as of 2026-05-01]
[VERIFIED: npm registry — `react-native-maps@1.27.2` is latest as of 2026-05-01]

### Supporting (already installed — no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | ^5.100.5 | Unread badge polling, notification list | Already in both web and mobile; use `useQuery` + `invalidateQueries` for badge |
| `drizzle-orm` | ^0.45.2 | Notification INSERT, map JOIN query | Already installed; use existing patterns |
| `zod` | ^4.3.6 | New schemas for notification query params, map query params | Already installed; add `notificationQuerySchema`, `restaurantMapQuerySchema` to shared package |
| `formatRelativeTime` | n/a (hand-rolled) | Relative time in notification rows | Already in `apps/web/lib/utils.ts`; reuse; mobile can use same inline approach as feed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `formatRelativeTime` (existing) | `date-fns/formatDistanceToNow` | date-fns v4.1.0 is available but adds a dependency; the existing hand-rolled function already handles all needed cases (minutes/hours/days). Stick with existing. |
| Polling for unread badge | WebSocket / SSE | Polling is simpler, sufficient for MVP, and consistent with how the feed works. Push is deferred to NOTF-V2-01. |
| Map clustering (skip) | `@vis.gl/react-google-maps` MarkerClusterer | Library supports clustering but adds complexity. Skip for v1 per Claude's Discretion. |

**Installation (new packages only):**
```bash
# Web
cd apps/web && pnpm add @vis.gl/react-google-maps

# Mobile
cd apps/mobile && pnpm add react-native-maps
```

After adding `react-native-maps`, a new Expo dev build is required because the native plugin config in `app.json` changes.

---

## Architecture Patterns

### System Architecture Diagram

```
[Follow POST / Like POST]
        |
        v
[Existing route handler]
        |
        +-- INSERT follows/likes (existing)
        |
        +-- INSERT notifications (new)
            userId = review owner (or followee)
            actorId = current user
            type = 'follow' | 'like'
            SKIP if actorId === userId

[Nav render (web)]
        |
        v
[GET /api/v1/notifications/unread]  <-- TanStack Query, staleTime ~30s
        |
        v
{ hasUnread: boolean }
        |
        v
[Bell icon] -- red dot visible if hasUnread

[Bell click]
        |
        v
[Panel opens]
        |
        +-- GET /api/v1/notifications (cursor pagination, reuse feedQuerySchema)
        |       Returns: actor avatar, username, type, reviewId, restaurant name, createdAt
        |
        +-- PATCH /api/v1/notifications/read-all
                |
                v
        [invalidate 'notifications-unread' query] --> red dot disappears

[GET /api/v1/restaurants/map]
        |
        v
SELECT restaurants WHERE lat IS NOT NULL AND lng IS NOT NULL
JOIN reviews JOIN users
LEFT JOIN follows WHERE followerId = $me
        |
        v
{ id, name, lat, lng, reviewedByFollowed: boolean }[]
        |
        v
[Map component] -- all pins rendered; followed = brand color pin; others = muted pin

[GET /api/v1/restaurants/reviewed?q=<city>]
        |
        v
ILIKE restaurants.city || restaurants.address
        |
        v
{ id, name, city, address, lat, lng, reviewedByFollowed: boolean }[]
        |
        v
[List view] -- all results including null lat/lng
```

### Recommended Project Structure

```
apps/web/
├── app/(app)/
│   ├── map/
│   │   └── page.tsx                   # Web map page (Client Component — 'use client')
│   └── layout.tsx                     # Add bell icon here (or in nav component)
├── components/
│   └── notification-panel.tsx         # Bell + dropdown panel (Client Component)
└── app/api/v1/
    ├── notifications/
    │   ├── route.ts                   # GET (list, cursor-paginated)
    │   ├── unread/
    │   │   └── route.ts               # GET { hasUnread: boolean }
    │   └── read-all/
    │       └── route.ts               # PATCH — mark all read
    └── restaurants/
        ├── map/
        │   └── route.ts               # GET map pins with reviewedByFollowed
        └── reviewed/
            └── route.ts               # GET list with optional ?q= search

apps/mobile/
├── app/(app)/
│   └── notifications.tsx              # NotificationsScreen (pushed from profile)
└── (tabs)/
    └── profile.tsx                    # Add bell icon to header options

packages/shared/src/schemas/index.ts  # Add notificationQuerySchema, restaurantMapQuerySchema
```

### Pattern 1: Notification INSERT After Follow

```typescript
// Source: follows/route.ts existing pattern + notifications table schema
// After the follow INSERT succeeds (step 1 in existing POST handler):

// D-02: skip self-notification
if (targetUserId !== actorUserId) {
  await db.insert(notifications).values({
    userId: targetUserId,   // who receives the notification
    type: 'follow',
    actorId: actorUserId,   // who performed the action
    // reviewId: null for follow notifications
  })
}
```

### Pattern 2: Notification INSERT After Like

```typescript
// Source: likes/route.ts existing pattern
// The like handler must fetch the review owner before inserting.
// Only insert on like, not unlike (existingLike check already handles toggle).

// After the like INSERT (not unlike branch):
if (!existingLike) {
  // fetch review owner
  const [review] = await db
    .select({ userId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))

  // D-02: skip self-notification
  if (review && review.userId !== actorUserId) {
    await db.insert(notifications).values({
      userId: review.userId,
      type: 'like',
      actorId: actorUserId,
      reviewId,
    })
  }
}
```

### Pattern 3: Notification List Endpoint (cursor pagination)

```typescript
// Source: apps/web/app/api/v1/feed/route.ts — reuse exact same cursor pattern
// GET /api/v1/notifications

const whereClause = cursor
  ? and(
      eq(notifications.userId, userId),
      lt(notifications.createdAt, new Date(cursor))
    )
  : eq(notifications.userId, userId)

const rawRows = await db
  .select({ /* notification fields */ })
  .from(notifications)
  .where(whereClause)
  .orderBy(desc(notifications.createdAt))
  .limit(PAGE_SIZE + 1)

// hasMore detection, nextCursor, batch-fetch actor users — same as feed
```

### Pattern 4: PATCH read-all

```typescript
// Source: Drizzle docs — UPDATE WHERE
// PATCH /api/v1/notifications/read-all
await db
  .update(notifications)
  .set({ read: true })
  .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

return NextResponse.json({ ok: true })
```
[ASSUMED] — Drizzle `.update().set().where()` API. This is a standard Drizzle pattern observed consistently across prior phases; not verified against current Drizzle 0.45.x changelog in this session.

### Pattern 5: Map Data Query with `reviewedByFollowed`

```typescript
// GET /api/v1/restaurants/map
// All restaurants with coordinates; enrich with reviewedByFollowed

const followingIds = await db
  .select({ followeeId: follows.followeeId })
  .from(follows)
  .where(eq(follows.followerId, userId))

const followingSet = new Set(followingIds.map(f => f.followeeId))

// Get all restaurants with coordinates that have at least one review
const reviewedRestaurants = await db
  .selectDistinct({ id: restaurants.id, name: restaurants.name,
                    lat: restaurants.lat, lng: restaurants.lng,
                    reviewUserId: reviews.userId })
  .from(restaurants)
  .innerJoin(reviews, eq(reviews.restaurantId, restaurants.id))
  .where(
    and(
      isNotNull(restaurants.lat),
      isNotNull(restaurants.lng),
      isNull(reviews.deletedAt)
    )
  )

// Deduplicate by restaurant ID, set reviewedByFollowed
const restaurantMap = new Map()
for (const row of reviewedRestaurants) {
  const existing = restaurantMap.get(row.id)
  const isFollowed = followingSet.has(row.reviewUserId)
  if (!existing) {
    restaurantMap.set(row.id, { ...row, reviewedByFollowed: isFollowed })
  } else if (isFollowed && !existing.reviewedByFollowed) {
    // Upgrade to followed if any reviewer is followed
    existing.reviewedByFollowed = true
  }
}

return NextResponse.json(Array.from(restaurantMap.values()))
```

### Pattern 6: `@vis.gl/react-google-maps` — Web Map Component

```tsx
// Source: https://github.com/visgl/react-google-maps/blob/main/docs/guides/ssr-and-frameworks.md
// 'use client' is MANDATORY — Google Maps JS API requires browser context

'use client'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps'

export default function MapPage() {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        mapId={'<your-map-id>'}
        defaultZoom={12}
        defaultCenter={{ lat: 40.7128, lng: -74.006 }}
        gestureHandling={'greedy'}
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Followed restaurant — brand color pin */}
        <AdvancedMarker position={{ lat: pin.lat, lng: pin.lng }}>
          <Pin background={'#E85D4A'} glyphColor={'#fff'} borderColor={'#C24332'} />
        </AdvancedMarker>

        {/* Non-followed restaurant — muted pin */}
        <AdvancedMarker position={{ lat: pin.lat, lng: pin.lng }}>
          <Pin background={'#9CA3AF'} glyphColor={'#fff'} borderColor={'#6B7280'} />
        </AdvancedMarker>
      </Map>
    </APIProvider>
  )
}
```

[VERIFIED: Context7 /visgl/react-google-maps — APIProvider, Map, AdvancedMarker, Pin, InfoWindow patterns confirmed]

**IMPORTANT — API Key exposure:** `GOOGLE_PLACES_API_KEY` has no `NEXT_PUBLIC_` prefix (server-side only per STATE.md). The map component runs in the browser and needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. This requires either:
- Adding a separate `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var (duplicates the key value), OR
- Using the same key with `NEXT_PUBLIC_` prefix exposure accepted (standard for Maps JS API — it's a browser-side key by design)

The Google Maps JavaScript API key is browser-exposed by design (it appears in the page source). This is normal and expected. Restrict the key in Google Cloud Console by HTTP referrer (your domain). This is separate from the `GOOGLE_PLACES_API_KEY` used server-side for Places API calls.

**mapId:** `AdvancedMarker` requires a `mapId` on the parent `Map` component. This is a Google Cloud Console map ID (not the API key). Must be created in Cloud Console. Without it, AdvancedMarker renders nothing. [VERIFIED: Context7 AdvancedMarker docs — "requires a Map component with a valid mapId"]

### Pattern 7: `react-native-maps` — Mobile Map Component

```jsx
// Source: Context7 /react-native-maps/react-native-maps
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'

<MapView
  provider={PROVIDER_GOOGLE}  // Android; iOS uses Apple Maps by default (omit provider)
  style={StyleSheet.absoluteFillObject}
  initialRegion={{
    latitude: 40.7128,
    longitude: -74.006,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  {pins.map(pin => (
    <Marker
      key={pin.id}
      coordinate={{ latitude: parseFloat(pin.lat), longitude: parseFloat(pin.lng) }}
      pinColor={pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'}
      tracksViewChanges={false}  // CRITICAL: false prevents re-render jank on large pin sets
    >
      <Callout>
        <Text style={{ fontWeight: 'bold' }}>{pin.name}</Text>
      </Callout>
    </Marker>
  ))}
</MapView>
```

[VERIFIED: Context7 /react-native-maps/react-native-maps — MapView, Marker, Callout, pinColor confirmed]

**CRITICAL:** `lat` and `lng` are stored as `numeric` in Drizzle, returned as strings from the API. Must call `parseFloat()` before passing to `coordinate`.

### Pattern 8: Notification Bell with TanStack Query (Web)

```tsx
// Client Component in nav/layout — polls for unread badge
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'

function NotificationBell() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await fetch('/api/v1/notifications/unread')
      return res.json() as Promise<{ hasUnread: boolean }>
    },
    refetchInterval: 30_000,  // poll every 30s
    staleTime: 15_000,
  })

  const handleOpen = async () => {
    setOpen(true)
    await fetch('/api/v1/notifications/read-all', { method: 'PATCH' })
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
  }

  return (
    <button onClick={handleOpen}>
      <BellIcon />
      {data?.hasUnread && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500" />}
    </button>
  )
}
```

### Anti-Patterns to Avoid

- **Polling at nav level without staleTime:** Without `staleTime`, every navigation triggers a fresh fetch. Set `staleTime: 15_000` on the unread query.
- **Inserting notification before follow/like succeeds:** Always insert notification AFTER the primary operation succeeds, not before. If the primary fails, no spurious notification is created.
- **Using `GOOGLE_PLACES_API_KEY` directly in browser component:** That key has no `NEXT_PUBLIC_` prefix — it is undefined in browser. Expose a separate `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for the map component.
- **Missing `mapId` on `Map` component:** `AdvancedMarker` silently renders nothing without a Cloud Console map ID. The `mapId` prop on `<Map>` must be set for AdvancedMarker to work.
- **Forgetting `tracksViewChanges={false}` on mobile Marker:** Without this, React Native re-renders each marker on every state change, causing significant jank with many pins.
- **Passing raw numeric strings to `coordinate`:** `lat`/`lng` are returned as strings (Drizzle `numeric` type). Must `parseFloat()` before use in `react-native-maps`.
- **No `'use client'` on map page:** Google Maps JS API is browser-only. Next.js App Router will SSR the page and crash without `'use client'`.
- **Self-notification bypass missing on unlike:** The like toggle route: only INSERT notification on the LIKE branch (not the unlike branch). Self-check only needed when inserting.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map rendering (web) | Custom Google Maps JS API integration | `@vis.gl/react-google-maps` | Handles React lifecycle, SSR compatibility, event syncing, ref management — all non-trivial |
| Map rendering (mobile) | Custom native MapView | `react-native-maps` | Native module; requires Obj-C/Java bridging — cannot be hand-rolled |
| Marker pin styling | Custom SVG pin component | `Pin` component from `@vis.gl/react-google-maps` | `background`, `glyphColor`, `borderColor` props cover all needed styling |
| Relative time in notifications | New library install | `formatRelativeTime` from `apps/web/lib/utils.ts` | Already exists, already tested, covers all needed granularities |
| Cursor pagination | Custom offset/page system | Reuse `feedQuerySchema` pattern from Phase 4 | Identical contract; consistent API surface |

**Key insight:** Both map libraries are native/browser-level — there is no reasonable hand-rolled alternative. The notification patterns are pure Drizzle + existing route handler patterns; no new abstraction is needed.

---

## Common Pitfalls

### Pitfall 1: Missing `mapId` for AdvancedMarker
**What goes wrong:** `AdvancedMarker` renders nothing on the map. No error is thrown in the console.
**Why it happens:** Google Maps Advanced Markers require a Cloud Console "Map ID" registered with your API key. The `Map` component must receive `mapId` prop pointing to this ID.
**How to avoid:** Create a Map ID in Google Cloud Console (Maps Platform > Map Management). Pass it as `mapId` prop on `<Map>`. For development, use `mapId="DEMO_MAP_ID"` (Google provides this test ID but it may have restrictions).
**Warning signs:** Markers don't appear despite valid coordinates; no console errors.
[VERIFIED: Context7 — AdvancedMarker docs explicitly state mapId requirement]

### Pitfall 2: `GOOGLE_PLACES_API_KEY` Not Exposed to Browser
**What goes wrong:** `APIProvider apiKey={process.env.GOOGLE_PLACES_API_KEY}` evaluates to `undefined` in the browser. Map fails to load.
**Why it happens:** `GOOGLE_PLACES_API_KEY` has no `NEXT_PUBLIC_` prefix (intentional, per STATE.md). Next.js only exposes `NEXT_PUBLIC_` vars to client bundles.
**How to avoid:** Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<same key value>` to `.env.local`. Use this var in the `APIProvider`. The Maps JS API key is legitimately browser-exposed (unlike the server-side Places API key — different API surface).
**Warning signs:** Map container renders but shows "For development purposes only" watermark or fails entirely.

### Pitfall 3: `react-native-maps` Plugin Requires New EAS Dev Build
**What goes wrong:** Adding `react-native-maps` to `app.json` plugins and running `expo start` still uses the old dev build — the map screen crashes with a native module error.
**Why it happens:** Native modules require a native build. The Expo dev build bakes native code at build time. Changing plugin config requires rebuilding.
**How to avoid:** After adding the plugin to `app.json`, run `eas build --profile development --platform all` (or per-platform). Install the new build on device before testing the map.
**Warning signs:** `NativeModule: ReactNativeMaps is null` error in the Metro bundler output.
[VERIFIED: Context7 react-native-maps Expo installation docs]

### Pitfall 4: `numeric` Columns Return Strings
**What goes wrong:** `parseFloat(pin.lat)` — if skipped, passing `"40.7128"` (string) to `coordinate` on mobile causes a type error or incorrect rendering.
**Why it happens:** Drizzle maps `numeric`/`decimal` Postgres columns to TypeScript `string` (not `number`) to preserve precision.
**How to avoid:** Always `parseFloat(restaurant.lat!)` and `parseFloat(restaurant.lng!)` before passing to map coordinate objects. Both web (`@vis.gl` accepts `number`) and mobile (`react-native-maps` requires `number`) need this.

### Pitfall 5: Notification Bell in Server Layout vs. Client Component
**What goes wrong:** Placing the bell icon with `useQuery` directly in `app/(app)/layout.tsx` (a Server Component) causes a build error — hooks are not available in Server Components.
**Why it happens:** Next.js App Router layouts are Server Components by default.
**How to avoid:** Extract the bell icon + dropdown panel into a Client Component (`notification-panel.tsx` with `'use client'`). Import that into the layout. The layout itself stays as a Server Component.

### Pitfall 6: Notification INSERT on Unlike Branch
**What goes wrong:** A notification fires when a user unlikes a review.
**Why it happens:** The likes route has an if/else toggle. Notification INSERT must only be in the like branch (when `!existingLike`).
**How to avoid:** Place the notification INSERT inside `if (!existingLike) { ... }` block only. The unlike branch (`if (existingLike)`) must not touch notifications.

### Pitfall 7: `lat`/`lng` as `numeric` in WHERE Clause
**What goes wrong:** `WHERE lat IS NOT NULL` in Drizzle — use `isNotNull(restaurants.lat)` (Drizzle operator), not a raw SQL fragment, to avoid type mismatches.
**How to avoid:** Use `isNotNull()` from `drizzle-orm` (already imported in other routes).

---

## Code Examples

### Zod Schema for Notification Query (add to shared package)

```typescript
// packages/shared/src/schemas/index.ts — add to Phase 6 section
// Reuse feedQuerySchema shape exactly — same cursor pagination contract
export const notificationQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>

// Map query (no cursor needed for map pins — full dataset)
export const restaurantMapQuerySchema = z.object({
  // No params for map endpoint; list search uses a 'q' param
})

export const restaurantReviewedQuerySchema = z.object({
  q: z.string().max(100).optional(),  // neighborhood/city search
})
export type RestaurantReviewedQueryInput = z.infer<typeof restaurantReviewedQuerySchema>
```

### `app.json` Plugin Entry for `react-native-maps`

```json
// apps/mobile/app.json — add to "plugins" array
[
  "react-native-maps",
  {
    "iosGoogleMapsApiKey": "YOUR_IOS_MAPS_KEY",
    "androidGoogleMapsApiKey": "YOUR_ANDROID_MAPS_KEY"
  }
]
```

Note: iOS defaults to Apple Maps. `iosGoogleMapsApiKey` is only needed if forcing Google Maps on iOS (optional for MVP — Apple Maps is acceptable and avoids an extra key).
[VERIFIED: Context7 react-native-maps installation docs]

### Notification Row Type

```typescript
// Shape returned by GET /api/v1/notifications
interface NotificationRow {
  id: string
  type: 'follow' | 'like' | 'comment'
  read: boolean
  createdAt: string  // ISO 8601
  actor: {
    username: string
    avatarUrl: string | null
  }
  reviewId: string | null
  restaurantName: string | null  // populated when type === 'like'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `google-maps-react` (deprecated) | `@vis.gl/react-google-maps` | 2023+ | vis.gl is the Google-maintained successor; do not use old packages |
| `react-native-maps` with manual pod install | Expo plugin config in `app.json` | Expo SDK 47+ | Plugin config replaces manual `android/ios` directory edits in managed workflow |
| Polling with `setInterval` | TanStack Query `refetchInterval` | TanStack v4+ | Managed polling with automatic cleanup, background/focus awareness |

**Deprecated/outdated:**
- `google-maps-react`: Unmaintained since 2021; use `@vis.gl/react-google-maps` instead
- `@googlemaps/react-wrapper`: Lower-level; `@vis.gl/react-google-maps` is the recommended React integration
- Expo Go for testing maps: Maps require native modules; only works in dev build (already in use per Phase 1)

---

## Runtime State Inventory

Step 2.6: SKIPPED — This phase adds new routes and components. No rename/refactor/migration of existing named entities. Restaurants table already has `lat`/`lng` populated from Phase 2 Google Places integration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | Yes | v22.18.0 | — |
| `GOOGLE_PLACES_API_KEY` env var | `restaurants/search` (existing) | Assumed yes (used in Phase 2) | — | Route returns cached results gracefully |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Web map `APIProvider` | NOT SET (new) | — | Map fails to load — must add to env |
| Google Cloud Console Map ID | `AdvancedMarker` on web | NOT SET (new) | — | Use `"DEMO_MAP_ID"` for dev; production needs real Map ID |
| EAS dev build with `react-native-maps` | Mobile map | NOT BUILT (new native dep) | — | Must rebuild dev build after plugin added |
| `@vis.gl/react-google-maps` | Web map page | NOT INSTALLED | — | Install: `pnpm add @vis.gl/react-google-maps` |
| `react-native-maps` | Mobile map screen | NOT INSTALLED | — | Install: `pnpm add react-native-maps` |

**Missing dependencies that block execution:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — add to `.env.local` (and Vercel env vars)
- Google Cloud Console Map ID — create in Cloud Console for AdvancedMarker support
- New EAS dev build after `react-native-maps` plugin added to `app.json`

**Missing dependencies with install path:**
- `@vis.gl/react-google-maps@1.8.3` — `pnpm add @vis.gl/react-google-maps` in `apps/web`
- `react-native-maps@1.27.2` — `pnpm add react-native-maps` in `apps/mobile`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test` |
| Full suite command | `pnpm --filter web test` (all tests in `__tests__/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | `notificationQuerySchema` rejects invalid cursor | unit | `pnpm --filter web test -- --reporter=verbose` | ❌ Wave 0: `__tests__/notifications.test.ts` |
| NOTF-01 | Notification INSERT skipped when `actorId === userId` (D-02) | unit (logic) | Same | ❌ Wave 0 |
| NOTF-02 | Notification INSERT skipped on unlike branch | unit (logic) | Same | ❌ Wave 0 |
| NOTF-03 | `GET /api/v1/notifications/unread` returns `{ hasUnread: boolean }` | integration (manual) | curl against dev server | Manual |
| NOTF-03 | `PATCH /api/v1/notifications/read-all` sets `read = true` for all user rows | integration (manual) | curl against dev server | Manual |
| LOCN-01 | `GET /api/v1/restaurants/map` returns only restaurants with non-null lat/lng | integration (manual) | curl against dev server | Manual |
| LOCN-01 | `reviewedByFollowed` is `true` only for restaurants reviewed by followed users | integration (manual) | curl against dev server | Manual |
| LOCN-02 | `GET /api/v1/restaurants/reviewed?q=brooklyn` returns matching restaurants including null lat/lng | integration (manual) | curl against dev server | Manual |
| LOCN-02 | `restaurantReviewedQuerySchema` rejects `q` longer than 100 chars | unit | `pnpm --filter web test` | ❌ Wave 0 |
| LOCN-03 | Map endpoint returns `reviewedByFollowed: false` for all pins when user follows nobody | unit (logic) | Same | ❌ Wave 0 |
| E2E | Notification bell shows red dot after follow event | E2E (manual) | Manual: follow a user, check bell | Manual |
| E2E | Notification bell shows red dot after like event | E2E (manual) | Manual: like a review, check bell | Manual |
| E2E | Opening notification panel clears red dot | E2E (manual) | Manual: open panel, close, check dot gone | Manual |

### Wave 0 Gaps

- [ ] `apps/web/__tests__/notifications.test.ts` — unit tests for:
  - `notificationQuerySchema` (cursor validation, limit coercion — mirrors `feedQuerySchema` tests in `feed.test.ts`)
  - `restaurantReviewedQuerySchema` (q max length)
  - Self-notification skip logic (pure function extract from route handler, or logic-only test)
  - `reviewedByFollowed` computation helper (if extracted to a pure function)

*(Existing test infrastructure in `apps/web/__tests__/` with Vitest covers all unit tests. No new framework install needed.)*

### Sampling Rate

- **Per task commit:** `pnpm --filter web test`
- **Per wave merge:** `pnpm --filter web test` (full suite must be green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk `auth()` in all new route handlers — same pattern as every prior phase |
| V3 Session Management | no | Session managed by Clerk; no new session logic |
| V4 Access Control | yes | Notifications: `WHERE userId = $me` — user can only read their own notifications; `read-all` scoped to `$me` |
| V5 Input Validation | yes | Zod schemas on all new endpoints (notificationQuerySchema, restaurantReviewedQuerySchema) |
| V6 Cryptography | no | No new crypto; existing R2/Clerk handles all crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation on notifications | Spoofing / Elevation | `WHERE userId = $me` on all SELECT/UPDATE — never accept userId from request body |
| Bulk read-all without auth | Spoofing | `auth()` guard at top of PATCH handler — already established pattern |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` abuse | Tampering | Restrict key in Google Cloud Console by HTTP referrer (your production domain) |
| SQL injection via `q` param in restaurant search | Tampering | Zod validates `q` before use; Drizzle parameterizes all queries |
| Notification actor spoofing | Spoofing | `actorId` always derived from `resolveUserId(clerkId)` — never from request body |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle `.update().set().where()` API is unchanged in v0.45.x | Pattern 4 (PATCH read-all) | Low — this is Drizzle's core UPDATE API; API would need to verify against drizzle-kit 0.45.x changelog |
| A2 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` can be the same key value as `GOOGLE_PLACES_API_KEY` (different env var name, same key) | Pitfall 2 | Low — Google API keys are per-service restricted; using the same key for both Maps JS and Places API is common but should be verified against project's Google Cloud Console key restrictions |
| A3 | Apple Maps works out of the box on iOS with `react-native-maps` without providing `iosGoogleMapsApiKey` | app.json plugin section | Low — Apple Maps is the default iOS provider; skipping iosGoogleMapsApiKey just means iOS uses Apple Maps instead of Google Maps |
| A4 | `isNotNull` from `drizzle-orm` works correctly with `numeric` nullable columns in the WHERE clause | Pattern 5 (map query) | Low — standard Drizzle operator used throughout codebase |

---

## Open Questions

1. **Google Cloud Console Map ID availability**
   - What we know: `AdvancedMarker` requires a Map ID; `DEMO_MAP_ID` works for development
   - What's unclear: Is a Map ID already created in the project's Google Cloud Console account?
   - Recommendation: Plan a Wave 0 task to create a Map ID in Cloud Console. Use `DEMO_MAP_ID` for local dev to unblock implementation.

2. **iOS map provider choice (Apple Maps vs. Google Maps)**
   - What we know: `react-native-maps` defaults to Apple Maps on iOS; Google Maps on iOS requires `iosGoogleMapsApiKey`
   - What's unclear: Whether the project wants Google Maps on iOS (consistent cross-platform UX) or Apple Maps (no additional key needed)
   - Recommendation: Use Apple Maps on iOS for v1 (no key needed, familiar to iOS users). Plan adds `PROVIDER_GOOGLE` to Android only.

3. **Nav component location for bell icon (web)**
   - What we know: `app/(app)/layout.tsx` is a Server Component with no existing nav component
   - What's unclear: Whether a shared nav component already exists or needs to be created
   - Recommendation: Create a `NotificationBell` Client Component and import it into `app/(app)/layout.tsx`. The layout becomes a thin Server Component wrapper.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/visgl/react-google-maps` — APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, Next.js SSR guide
- Context7 `/react-native-maps/react-native-maps` — MapView, Marker, Callout, Expo plugin installation, PROVIDER_GOOGLE
- npm registry — `@vis.gl/react-google-maps@1.8.3` (latest, verified 2026-05-01)
- npm registry — `react-native-maps@1.27.2` (latest, verified 2026-05-01)
- `apps/web/lib/schema.ts` — notifications table structure, restaurants lat/lng, reviews table (read directly)
- `apps/web/app/api/v1/follows/route.ts` — exact follow insertion point (read directly)
- `apps/web/app/api/v1/likes/route.ts` — exact like insertion point (read directly)
- `apps/web/app/api/v1/feed/route.ts` — cursor pagination pattern to reuse (read directly)
- `apps/web/lib/utils.ts` — `formatRelativeTime` already exists and is tested
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API confirmed for Next.js 16.2.4

### Secondary (MEDIUM confidence)
- `apps/mobile/app.json` — Expo SDK 55, `newArchEnabled: true`, existing plugins — verified directly
- `apps/mobile/package.json` — `react-native: 0.85.2` (meets react-native-maps `>= 0.76.0` peer dep requirement) — verified directly

### Tertiary (LOW confidence)
- None — all critical claims verified with primary sources or codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries verified via npm registry; all API patterns verified via Context7
- Architecture: HIGH — all patterns derived from existing codebase code that was read directly
- Pitfalls: HIGH — verified against Context7 docs (mapId, tracksViewChanges, numeric strings) and Next.js docs (client directive requirement)
- Environment availability: HIGH — package.json and app.json read directly; both map libraries confirmed not yet installed

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (stable libraries; 30 days)
