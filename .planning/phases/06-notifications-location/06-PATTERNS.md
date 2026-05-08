# Phase 6: Notifications & Location - Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/api/v1/notifications/route.ts` | route | CRUD / request-response | `apps/web/app/api/v1/feed/route.ts` | exact (cursor-paginated GET, same auth/query pattern) |
| `apps/web/app/api/v1/notifications/unread/route.ts` | route | request-response | `apps/web/app/api/v1/restaurants/search/route.ts` | role-match (simple GET, auth guard, JSON response) |
| `apps/web/app/api/v1/notifications/read-all/route.ts` | route | request-response | `apps/web/app/api/v1/follows/route.ts` | role-match (mutating route, auth guard, Drizzle write) |
| `apps/web/app/api/v1/restaurants/map/route.ts` | route | request-response | `apps/web/app/api/v1/feed/route.ts` | role-match (authed GET, multi-table JOIN, batch data) |
| `apps/web/app/api/v1/restaurants/reviewed/route.ts` | route | request-response | `apps/web/app/api/v1/restaurants/search/route.ts` | exact (ILIKE search, same auth/response pattern) |
| `apps/web/app/api/v1/follows/route.ts` (modified) | route | CRUD | self | exact (add notification INSERT inline) |
| `apps/web/app/api/v1/likes/route.ts` (modified) | route | CRUD | self | exact (add notification INSERT inline in like branch) |
| `apps/web/app/(app)/map/page.tsx` | component | request-response | `apps/web/app/(app)/page.tsx` | role-match (Client Component, useQuery, TanStack) |
| `apps/web/components/notification-panel.tsx` | component | event-driven | `apps/web/components/review-card.tsx` | partial (Client Component, avatar + relative-time row pattern) |
| `apps/web/app/(app)/layout.tsx` (modified) | config / layout | — | self | exact (add NotificationBell import) |
| `apps/mobile/app/(app)/notifications.tsx` | component | request-response | `apps/mobile/app/(app)/(tabs)/index.tsx` | exact (FlatList + useInfiniteQuery + getToken() pattern) |
| `apps/mobile/app/(app)/(tabs)/profile.tsx` (modified) | component | — | self | exact (add bell icon to header) |
| `packages/shared/src/schemas/index.ts` (modified) | utility | — | self | exact (add notificationQuerySchema, restaurantReviewedQuerySchema) |

---

## Pattern Assignments

### `apps/web/app/api/v1/notifications/route.ts` (route, CRUD / cursor-paginated GET)

**Analog:** `apps/web/app/api/v1/feed/route.ts`

**Imports pattern** (lines 1-8):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications, users } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { notificationQuerySchema } from '@lunchboxd/shared'
import { eq, lt, and, desc, inArray, isNull } from 'drizzle-orm'
```

**Auth pattern** (feed/route.ts lines 10-14):
```typescript
const { userId: clerkId } = await auth()
if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const userId = await resolveUserId(clerkId)
if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
```

**Query param parse pattern** (feed/route.ts lines 16-25):
```typescript
const { searchParams } = new URL(req.url)
const parsed = notificationQuerySchema.safeParse({
  cursor: searchParams.get('cursor') ?? undefined,
  limit: searchParams.get('limit') ?? undefined,
})
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
}
const { cursor, limit } = parsed.data
const PAGE_SIZE = limit ?? 20
```

**Core cursor pagination pattern** (feed/route.ts lines 29-48):
```typescript
// Scope WHERE to current user's notifications only (V4 access control)
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

const hasMore = rawRows.length > PAGE_SIZE
const pageRows = rawRows.slice(0, PAGE_SIZE)
const nextCursor = hasMore
  ? pageRows[pageRows.length - 1].createdAt.toISOString()
  : null
```

**Batch-fetch actor users** (feed/route.ts lines 57-83 pattern — adapt for actors):
```typescript
// After getting pageRows, collect actorIds and batch-fetch users (no N+1)
const actorIds = [...new Set(pageRows.map(r => r.actorId).filter(Boolean))]
const actorRows = actorIds.length > 0
  ? await db.select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, actorIds))
  : []
const actorMap = Object.fromEntries(actorRows.map(u => [u.id, u]))
```

**Response shape pattern** (feed/route.ts line 130):
```typescript
return NextResponse.json({ items, nextCursor })
```

---

### `apps/web/app/api/v1/notifications/unread/route.ts` (route, request-response)

**Analog:** `apps/web/app/api/v1/restaurants/search/route.ts`

**Imports pattern** (search/route.ts lines 1-6):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
```

**Auth + simple query pattern** (search/route.ts lines 8-13):
```typescript
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // resolveUserId is also required (search route omits it because it doesn't need the internal UUID)
  // For notifications, use resolveUserId() to get userId for the WHERE clause
```

**Response shape** — returns `{ hasUnread: boolean }`:
```typescript
// Use Drizzle to check for any unread notification for this user
// Use limit(1) — only need to know if at least one exists
return NextResponse.json({ hasUnread: rows.length > 0 })
```

---

### `apps/web/app/api/v1/notifications/read-all/route.ts` (route, request-response / mutating PATCH)

**Analog:** `apps/web/app/api/v1/follows/route.ts`

**Auth pattern** (follows/route.ts lines 11-15):
```typescript
const { userId: clerkId } = await auth()
if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const actorUserId = await resolveUserId(clerkId)
if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
```

**Drizzle UPDATE pattern** (follows/route.ts Drizzle style, adapted from RESEARCH.md Pattern 4):
```typescript
// PATCH /api/v1/notifications/read-all
// Scope UPDATE to current user's rows only — never accept userId from body (V4 access control)
await db
  .update(notifications)
  .set({ read: true })
  .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

return NextResponse.json({ ok: true })
```

---

### `apps/web/app/api/v1/restaurants/map/route.ts` (route, request-response / multi-table JOIN)

**Analog:** `apps/web/app/api/v1/feed/route.ts` (multi-table JOIN with batch data assembly)

**Imports pattern** (feed/route.ts lines 1-7):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, users, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and, isNotNull, isNull } from 'drizzle-orm'
```

**Auth pattern** (feed/route.ts lines 10-14 — identical):
```typescript
const { userId: clerkId } = await auth()
if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const userId = await resolveUserId(clerkId)
if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
```

**Core JOIN + deduplication pattern** (RESEARCH.md Pattern 5):
```typescript
// Step 1: fetch follower set
const followingIds = await db
  .select({ followeeId: follows.followeeId })
  .from(follows)
  .where(eq(follows.followerId, userId))
const followingSet = new Set(followingIds.map(f => f.followeeId))

// Step 2: all restaurants with coordinates + at least one review (non-deleted)
const reviewedRestaurants = await db
  .selectDistinct({
    id: restaurants.id, name: restaurants.name,
    lat: restaurants.lat, lng: restaurants.lng,
    reviewUserId: reviews.userId,
  })
  .from(restaurants)
  .innerJoin(reviews, eq(reviews.restaurantId, restaurants.id))
  .where(and(isNotNull(restaurants.lat), isNotNull(restaurants.lng), isNull(reviews.deletedAt)))

// Step 3: deduplicate by restaurant ID, upgrade reviewedByFollowed if any reviewer is followed
const restaurantMap = new Map<string, { id: string; name: string; lat: string; lng: string; reviewedByFollowed: boolean }>()
for (const row of reviewedRestaurants) {
  const existing = restaurantMap.get(row.id)
  const isFollowed = followingSet.has(row.reviewUserId)
  if (!existing) {
    restaurantMap.set(row.id, { id: row.id, name: row.name!, lat: row.lat!, lng: row.lng!, reviewedByFollowed: isFollowed })
  } else if (isFollowed && !existing.reviewedByFollowed) {
    existing.reviewedByFollowed = true
  }
}

return NextResponse.json(Array.from(restaurantMap.values()))
```

---

### `apps/web/app/api/v1/restaurants/reviewed/route.ts` (route, request-response / ILIKE search)

**Analog:** `apps/web/app/api/v1/restaurants/search/route.ts`

**Imports pattern** (search/route.ts lines 1-6):
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { restaurantReviewedQuerySchema } from '@lunchboxd/shared'
import { ilike, or, eq, isNull, and } from 'drizzle-orm'
```

**ILIKE search pattern** (search/route.ts lines 16-17):
```typescript
// q param validated by Zod schema (max 100 chars) before use in ILIKE
// restaurants.city || restaurants.address — cover both fields (D-11: no geocoding, list includes null lat/lng)
const q = req.nextUrl.searchParams.get('q') ?? ''
// if q provided, filter with ILIKE on city OR address
// Include all reviewed restaurants in results (lat/lng may be null — D-11)
```

**Key difference from search route:** this route returns restaurants that have at least one review (INNER JOIN on reviews), not all restaurants. Restaurants with null lat/lng are included in list but excluded from map endpoint.

---

### `apps/web/app/api/v1/follows/route.ts` (modified — add notification INSERT inline)

**Source:** self — `apps/web/app/api/v1/follows/route.ts`

**Insertion point** (after line 31 — after the follow INSERT succeeds):
```typescript
// After: await db.insert(follows).values(...).onConflictDoNothing()

// D-01: notification INSERT inline — after successful follow INSERT
// D-02: skip self-notification
if (targetUserId !== actorUserId) {
  await db.insert(notifications).values({
    userId: targetUserId,   // who receives the notification
    type: 'follow',
    actorId: actorUserId,   // who performed the action
    // reviewId defaults to null for follow notifications
  })
}
```

**Schema reference** (schema.ts lines 105-113):
```typescript
// notifications table columns:
// userId: uuid — who receives it
// type: text — 'follow' | 'like' | 'comment'
// actorId: uuid — who triggered it
// reviewId: uuid | null — null for follow notifications
// read: boolean — default false
```

---

### `apps/web/app/api/v1/likes/route.ts` (modified — add notification INSERT in like branch only)

**Source:** self — `apps/web/app/api/v1/likes/route.ts`

**Existing toggle structure** (likes/route.ts lines 31-38):
```typescript
if (existingLike) {
  // Unlike branch — DO NOT insert notification here
  await db.delete(likes).where(eq(likes.id, existingLike.id))
} else {
  // Like branch — insert notification AFTER the like INSERT
  await db.insert(likes).values({ userId: actorUserId, reviewId }).onConflictDoNothing()

  // D-01/D-02: notification INSERT — like branch only, skip self
  const [review] = await db
    .select({ userId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
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

---

### `apps/web/app/(app)/map/page.tsx` (component, Client Component)

**Analog:** `apps/web/app/(app)/page.tsx` (Client Component, TanStack Query, data fetching)

**'use client' + imports pattern** (page.tsx line 1-6):
```typescript
'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
// Map-specific imports:
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
```

**TanStack Query fetch pattern** (page.tsx lines 53-66):
```typescript
const { data, isLoading, isError } = useQuery({
  queryKey: ['restaurants-map'],
  queryFn: async () => {
    const res = await fetch('/api/v1/restaurants/map')
    if (!res.ok) throw new Error('Failed to load map data')
    return res.json() as Promise<MapPin[]>
  },
  staleTime: 60_000,
})
```

**Loading/error states pattern** (page.tsx lines 134-152):
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-text-secondary" />
    </div>
  )
}

if (isError) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-[20px] font-semibold text-text-primary mb-2">...</p>
      </div>
    </div>
  )
}
```

**Map render pattern** (RESEARCH.md Pattern 6):
```tsx
// APIProvider wraps entire page — process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (not GOOGLE_PLACES_API_KEY)
// mapId REQUIRED on Map component for AdvancedMarker to render
<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
  <Map mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID!} defaultZoom={12} defaultCenter={{ lat: 40.7128, lng: -74.006 }} gestureHandling="greedy" style={{ width: '100%', height: '100%' }}>
    {pins.map(pin => (
      <AdvancedMarker key={pin.id} position={{ lat: parseFloat(pin.lat), lng: parseFloat(pin.lng) }}>
        {/* Followed = brand color; general = muted */}
        <Pin
          background={pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'}
          glyphColor="#fff"
          borderColor={pin.reviewedByFollowed ? '#C24332' : '#6B7280'}
        />
      </AdvancedMarker>
    ))}
  </Map>
</APIProvider>
```

**CRITICAL:** `lat`/`lng` are `numeric` columns in Drizzle — returned as strings from the API. Always `parseFloat()` before passing to map coordinate objects.

---

### `apps/web/components/notification-panel.tsx` (component, Client Component / event-driven)

**Analog:** `apps/web/components/review-card.tsx` (Client Component, avatar + relative-time row) + `apps/web/app/(app)/page.tsx` (TanStack Query client pattern)

**'use client' + imports pattern** (review-card.tsx line 1):
```typescript
'use client'

import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatRelativeTime } from '@/lib/utils'
```

**Avatar + relative-time row pattern** (review-card.tsx lines 94-114):
```tsx
{/* Notification row — mirrors author row in ReviewCard */}
<div className="flex items-center gap-2 p-3">
  {notification.actor.avatarUrl ? (
    <img
      src={notification.actor.avatarUrl}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      alt=""
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] text-accent font-medium">
        {notification.actor.username.charAt(0).toUpperCase()}
      </span>
    </div>
  )}
  <span className="text-[13px] text-text-secondary flex-1">
    @{notification.actor.username} {actionText} · {formatRelativeTime(notification.createdAt)}
  </span>
</div>
```

**TanStack Query polling pattern** (RESEARCH.md Pattern 8):
```tsx
const queryClient = useQueryClient()
const { data } = useQuery({
  queryKey: ['notifications-unread'],
  queryFn: async () => {
    const res = await fetch('/api/v1/notifications/unread')
    return res.json() as Promise<{ hasUnread: boolean }>
  },
  refetchInterval: 30_000,
  staleTime: 15_000,  // anti-pattern avoided: staleTime prevents re-fetch on every navigation
})

const handleOpen = async () => {
  setOpen(true)
  await fetch('/api/v1/notifications/read-all', { method: 'PATCH' })
  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
}
```

**Red dot pattern** (D-07 — boolean only, no count):
```tsx
<button onClick={handleOpen} className="relative">
  <Bell size={20} className="text-text-secondary hover:text-text-primary" />
  {data?.hasUnread && (
    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500" aria-label="Unread notifications" />
  )}
</button>
```

---

### `apps/web/app/(app)/layout.tsx` (modified — add NotificationBell Client Component)

**Source:** self — `apps/web/app/(app)/layout.tsx`

**Current layout** (layout.tsx lines 1-22):
```typescript
// Server Component — stays as Server Component
// Add NotificationBell import — Client Component imported into Server Component is valid
import { NotificationBell } from '@/components/notification-panel'

// Add to return JSX alongside children:
return (
  <>
    <nav className="...">
      <NotificationBell />
    </nav>
    {children}
  </>
)
```

**Key rule:** `NotificationBell` must be a separate Client Component (`'use client'`) — hooks (`useQuery`) cannot be used in Server Components. The layout.tsx itself must NOT add `'use client'`.

---

### `apps/mobile/app/(app)/notifications.tsx` (component, CRUD / infinite list)

**Analog:** `apps/mobile/app/(app)/(tabs)/index.tsx` (FlatList + useInfiniteQuery + Bearer token + avatar row)

**Imports pattern** (index.tsx lines 1-13):
```typescript
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet, Image,
} from 'react-native'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
```

**Bearer token pattern — getToken() inside queryFn** (index.tsx lines 152-162):
```typescript
// CRITICAL: getToken() inside queryFn — not at component level
queryFn: async ({ pageParam }) => {
  const token = await getToken()
  const url = pageParam
    ? `${API_BASE_URL}/api/v1/notifications?cursor=${encodeURIComponent(pageParam as string)}`
    : `${API_BASE_URL}/api/v1/notifications`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load notifications')
  return res.json() as Promise<NotificationsResponse>
},
initialPageParam: null as string | null,
getNextPageParam: (lastPage) => lastPage.nextCursor,
staleTime: 30_000,
```

**Avatar + relative-time row pattern — mobile** (index.tsx lines 75-94):
```tsx
// Notification row mirrors FeedCard author row
{item.actor && (
  <View style={rowStyles.authorRow}>
    {item.actor.avatarUrl ? (
      <Image source={{ uri: item.actor.avatarUrl }} style={rowStyles.avatar} />
    ) : (
      <View style={rowStyles.avatarFallback}>
        <Text style={rowStyles.avatarInitial}>
          {item.actor.username.charAt(0).toUpperCase()}
        </Text>
      </View>
    )}
    <Text style={rowStyles.authorText}>
      @{item.actor.username} {actionText} · {formatRelativeTime(item.createdAt)}
    </Text>
  </View>
)}
```

**formatRelativeTime inline pattern** (index.tsx lines 46-57):
```typescript
// Hand-rolled — mirrors apps/web/lib/utils.ts; do NOT import a library
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

**FlatList + pagination footer pattern** (index.tsx lines 242-280):
```tsx
<FlatList
  data={allItems}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <NotificationRow item={item} />}
  onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
  onEndReachedThreshold={0.3}
  ListFooterComponent={
    isFetchingNextPage
      ? <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 16 }} />
      : !hasNextPage && allItems.length > 0
        ? <Text style={{ textAlign: 'center', color: colors.textSecondary, paddingVertical: 16 }}>All caught up.</Text>
        : null
  }
/>
```

**Mark-all-read on screen mount** — fire PATCH on screen focus (mirrors web panel open behavior):
```typescript
// useEffect on mount: fire read-all, then invalidate 'notifications-unread'
// mutationFn uses getToken() inside — same mutationFn pattern as likeMutation in index.tsx lines 171-183
```

---

### `apps/mobile/app/(app)/(tabs)/profile.tsx` (modified — add bell icon to header)

**Source:** self — `apps/mobile/app/(app)/(tabs)/profile.tsx`

**Current profile tab** (profile.tsx lines 1-18):
```typescript
// Renders ProfileContent — bell icon must be added to Profile screen's header options
// ProfileContent is rendered by expo-router Stack; use headerRight in Stack.Screen options
```

**Header button pattern** (from `apps/mobile/app/(app)/_layout.tsx` Stack pattern):
```tsx
// In the tabs _layout.tsx or via Stack.Screen in ProfileContent:
// Add headerRight to the profile tab screen options
<Tabs.Screen
  name="profile"
  options={{
    title: 'Profile',
    headerRight: () => (
      <Pressable onPress={() => router.push('/(app)/notifications')} style={{ marginRight: 16 }}>
        <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
        {hasUnread && (
          <View style={badgeStyle} />
        )}
      </Pressable>
    ),
  }}
/>
```

**useRouter for navigation** (from profile/[username].tsx line 11):
```typescript
import { useRouter } from 'expo-router'
const router = useRouter()
// router.push('/(app)/notifications')
```

---

### `packages/shared/src/schemas/index.ts` (modified — add Phase 6 schemas)

**Analog:** self — existing feedQuerySchema pattern (schemas/index.ts lines 71-75)

**feedQuerySchema pattern to copy exactly** (schemas/index.ts lines 71-75):
```typescript
export const feedQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type FeedQueryInput = z.infer<typeof feedQuerySchema>
```

**New schemas to add** (RESEARCH.md Code Examples):
```typescript
// --- Phase 6: Notifications & Location schemas ---

// Identical contract to feedQuerySchema — cursor-paginated notifications list
export const notificationQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>

// Restaurant list search — optional q param validated before ILIKE
export const restaurantReviewedQuerySchema = z.object({
  q: z.string().max(100).optional(),
})
export type RestaurantReviewedQueryInput = z.infer<typeof restaurantReviewedQuerySchema>
```

**Import style** (schemas/index.ts line 1):
```typescript
import { z } from 'zod/v4'
// Note: project uses 'zod/v4' import path — NOT 'zod' directly
```

---

## Shared Patterns

### Authentication (applies to ALL new API routes)
**Source:** `apps/web/app/api/v1/follows/route.ts` lines 10-15 and `apps/web/app/api/v1/feed/route.ts` lines 10-14

```typescript
// Web API routes (server-side)
const { userId: clerkId } = await auth()
if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const userId = await resolveUserId(clerkId)
if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
```

```typescript
// Mobile (client-side) — getToken() inside queryFn/mutationFn only
const token = await getToken()
// passed as: headers: { Authorization: `Bearer ${token}` }
```

### Zod Validation (applies to all API routes with params)
**Source:** `apps/web/app/api/v1/feed/route.ts` lines 16-24

```typescript
const parsed = someSchema.safeParse({ ...params })
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
}
```

### Drizzle isNotNull (applies to map route WHERE clause)
**Source:** `apps/web/app/api/v1/feed/route.ts` (uses `isNull` for soft-delete), `apps/web/lib/schema.ts` (lat/lng are nullable numeric)
```typescript
import { isNotNull, isNull } from 'drizzle-orm'
// Use isNotNull(restaurants.lat) — not raw SQL — to satisfy Drizzle type system
// Use isNull(reviews.deletedAt) for soft-delete filter (same pattern as feed route)
```

### Error Handling (applies to all route handlers)
**Source:** `apps/web/app/api/v1/restaurants/search/route.ts` lines 40-42

```typescript
try {
  // primary logic
} catch {
  // return cached / empty / error JSON — never throw to Next.js error boundary
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

### Client Component 'use client' Directive (applies to web map page and notification panel)
**Source:** `apps/web/app/(app)/page.tsx` line 1 and `apps/web/components/review-card.tsx` line 1

```typescript
'use client'
// Required for: any component using hooks (useQuery, useState, useEffect)
// Required for: Google Maps JS API (browser-only — RESEARCH.md Pitfall 5 / Anti-Pattern)
// The layout.tsx that imports these STAYS as a Server Component — no 'use client' needed there
```

### Colors / Design Tokens (applies to all mobile components)
**Source:** `apps/mobile/app/(app)/(tabs)/index.tsx` line 13

```typescript
import { colors } from '@lunchboxd/shared'
// colors.bg, colors.surface, colors.border, colors.accent, colors.textPrimary, colors.textSecondary, colors.destructive
```

### Notification Row Text Format (applies to notification-panel.tsx and notifications.tsx)
**Source:** CONTEXT.md D-06, specifics section:
```typescript
// type === 'follow': "@{actor} followed you"
// type === 'like'  : "@{actor} liked your review of {restaurantName}" OR "your homemade meal" if no restaurant
const actionText = notification.type === 'follow'
  ? 'followed you'
  : `liked your review of ${notification.restaurantName ?? 'your homemade meal'}`
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

| File | Note |
|------|------|
| `apps/web/app/(app)/map/page.tsx` | `@vis.gl/react-google-maps` usage has no existing analog — use RESEARCH.md Pattern 6 for the APIProvider/Map/AdvancedMarker/Pin code shape |
| `apps/mobile/app/(app)/notifications.tsx` (mobile map screen) | `react-native-maps` usage has no existing analog — use RESEARCH.md Pattern 7 for MapView/Marker/Callout shape. Note: mobile map screen is a separate concern from the notifications screen |

---

## Critical Implementation Notes

1. **`zod/v4` import path** — `packages/shared/src/schemas/index.ts` uses `import { z } from 'zod/v4'`. All new schemas must use this path, not `'zod'`.

2. **`numeric` columns return strings** — `restaurants.lat` and `restaurants.lng` are `numeric` in Drizzle and return as TypeScript `string`. Always call `parseFloat()` before passing to map coordinates on both web (`@vis.gl` expects `number`) and mobile (`react-native-maps` expects `number`).

3. **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a new env var** — distinct from `GOOGLE_PLACES_API_KEY` (server-only). Must be added to `.env.local` and Vercel before the web map page works.

4. **`mapId` on `<Map>` component is required** — `AdvancedMarker` silently renders nothing without it. Use `"DEMO_MAP_ID"` for local dev; create a real Map ID in Google Cloud Console for production.

5. **`tracksViewChanges={false}` on mobile `<Marker>`** — prevents re-render jank on large pin sets. Always set this.

6. **Notification INSERT must be AFTER primary operation** — if the follow/like INSERT fails (DB error), the notification must not be created. Place the notification INSERT after the primary operation succeeds.

7. **Self-notification check is `actorId !== userId`** — only applies when inserting. The unlike branch of likes/route.ts must never touch notifications.

---

## Metadata

**Analog search scope:** `apps/web/app/api/v1/`, `apps/web/components/`, `apps/web/app/(app)/`, `apps/mobile/app/(app)/`, `packages/shared/src/schemas/`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-01
