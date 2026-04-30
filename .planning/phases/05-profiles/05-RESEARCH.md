# Phase 5: Profiles - Research

**Researched:** 2026-04-30
**Domain:** Next.js 16 App Router dynamic routes, Clerk 7 auth, TanStack Query v5 infinite scroll, Expo Router v4 screen navigation, Cloudflare R2 upload reuse
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Web profiles use `/@username` routing — e.g., `lunchboxd.com/@sarah`. This is the social-app convention (Twitter/Instagram style) and is the cleanest URL form.
- **D-02:** Own profile redirects: `/profile` → `/@<current-user-username>` (web). The Profile tab (mobile) renders the current user's own profile screen directly — not a hub/menu.
- **D-03:** Viewing another user's profile on mobile pushes a new `ProfileScreen('username')` onto the navigation stack. Feed card author names, search result user names, and follower/following list entries all link to `/@username` (web) or push `ProfileScreen` (mobile).
- **D-04:** Avatars are stored in **Cloudflare R2** via the existing `POST /api/v1/uploads` endpoint — same pipeline as meal photos from Phase 2. No new upload infrastructure needed.
- **D-05:** After upload, the returned URL is saved via `PATCH /api/v1/users/me { avatarUrl }` — a new endpoint this phase adds.
- **D-06:** Users without an avatar show an **initial/letter avatar** — first letter of username in a colored circle. This pattern is already established in mobile FeedCard; use it consistently across web and mobile.
- **D-07:** Editing lives on a **separate `/profile/edit` page** (web) and a separate Edit Profile screen (mobile). The profile view page shows an [Edit Profile] button that navigates to the edit page/screen.
- **D-08:** The [Edit Profile] button is shown **only when viewing your own profile** (viewer's userId matches profile owner's userId). When viewing someone else's profile, show a [Follow] button instead (reuse the existing `FollowButton` component from Phase 3).
- **D-09:** The edit page/screen has two fields: **bio** (textarea) and **avatar** (upload). Display name editing is Claude's discretion — include it if `displayName` is already in the schema (it is), skip if it complicates the plan.
- **D-10:** Tapping a follower/following count navigates to a **separate page/screen** (not a modal). Web routes: `/@username/followers` and `/@username/following`. Mobile: new `FollowersScreen` / `FollowingScreen` pushed onto the stack.
- **D-11:** Each list entry uses the **existing `UserSearchCard` component** (web) which already renders follow state and `FollowButton`. On mobile, use the same pattern as the user search screen. Zero new components needed for list items.

### Claude's Discretion

- Display name field on the edit page (include if straightforward given schema already has `displayName`)
- Review history pagination on profile — infinite scroll (reuse `useInfiniteQuery` pattern) or full list (simpler)
- Profile page layout ordering (avatar + bio + stats row + review list)
- Mobile `ProfileScreen` reuse — same component for own profile tab and pushed "other user" screen, parameterized by username

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | User can set a profile avatar (photo) | R2 upload reused from Phase 2 via `POST /api/v1/uploads`; `PATCH /api/v1/users/me` saves `avatarUrl` |
| PROF-02 | User can write a profile bio | `users.bio` column already in schema; `PATCH /api/v1/users/me` saves `bio`; textarea on edit page |
| PROF-03 | User's profile displays their reviews in reverse chronological order | New `GET /api/v1/users/[username]/reviews` with `ORDER BY createdAt DESC`; `useInfiniteQuery` on web; FlatList on mobile |
| PROF-04 | User can view another user's public profile | `GET /api/v1/users/[username]` returns public user data; `/@username` route on web; `ProfileScreen(username)` on mobile |
| PROF-05 | User can see their follower count and following count on their profile | `userStats.followerCount` / `userStats.followingCount` already maintained by Phase 3 |
| PROF-06 | User can browse their followers list and following list | `GET /api/v1/users/[username]/followers` and `/following`; `UserSearchCard` reused for list items |
</phase_requirements>

---

## Summary

Phase 5 builds on a well-established foundation. The database schema already has all required columns (`displayName`, `bio`, `avatarUrl` on `users`; `followerCount`, `followingCount` on `userStats`). The upload pipeline (R2 presigned URL via `POST /api/v1/uploads`) is already working. Components for follower/following list items (`UserSearchCard` + `FollowButton`) and review cards (`ReviewCard` with `showAuthor={false}`) are shipped and tested. The primary work is: four new API endpoints, three new web pages, and replacing the mobile profile tab stub.

The single highest-risk technical discovery is the `/@username` URL scheme in Next.js 16 App Router. The `@` character is **reserved for parallel routes (slots)** in the App Router file system — a folder named `@[username]` would be interpreted as a slot definition, not a URL segment. The `/@username` URL is achievable but requires a `proxy.ts` rewrite rule (Next.js 16 renamed `middleware.ts` to `proxy.ts`). The route must live at `app/(app)/[username]/page.tsx` while `proxy.ts` rewrites incoming `/@*` paths to `/[username]`.

A secondary discovery: Next.js 16's `params` prop is a **Promise** — pages must `await params` or use `React.use(params)` to read route segments. This breaks the synchronous `params.username` pattern from training data.

**Primary recommendation:** Use `proxy.ts` rewrite to serve `/@username` URLs from `app/(app)/[username]/page.tsx`. Use `useInfiniteQuery` for profile review list (consistent with feed). Include `displayName` on edit page (schema has it, trivial to add).

---

## Project Constraints (from CLAUDE.md)

- **Framework:** Next.js 16.2.4 App Router (no Pages Router)
- **Mobile:** Expo SDK ~55 / Expo Router v4 — file-based navigation
- **Auth:** Clerk 7 (`@clerk/nextjs` ^7.2.7 web; `@clerk/expo` ^3.2.4 mobile)
- **ORM:** Drizzle ORM ^0.45.2 with drizzle-kit ^0.31.10
- **DB:** Neon (Postgres) — NO `db.transaction()` (Neon HTTP adapter; use sequential awaits)
- **Storage:** Cloudflare R2 — existing `POST /api/v1/uploads` endpoint; no new upload infra
- **State:** TanStack Query v5 (`@tanstack/react-query` ^5.100.5)
- **Styling web:** Tailwind CSS v4 `@theme` CSS variables; hand-rolled components on Radix primitives
- **Styling mobile:** `StyleSheet.create()` — NativeWind is NOT configured (locked in STATE.md)
- **API auth pattern:** Server — `await auth()` from `@clerk/nextjs/server`; Mobile — `getToken()` inside `queryFn`/`mutationFn` (never at hook level)
- **Security:** SELECT only safe user fields (id, username, displayName, avatarUrl) — never email or clerkId
- **No `db.transaction()`:** Use sequential `await` for multi-table writes
- **Next.js 16 breaking:** `middleware.ts` is deprecated; use `proxy.ts` with `export function proxy()`
- **Next.js 16 breaking:** `params` is a Promise — must `await params` in Server Components / `use(params)` in Client Components
- **drizzle-kit:** Use pgTable callback API for indices — standalone `index()` exports are incompatible

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | Web framework + API routes | Locked stack decision |
| Drizzle ORM | ^0.45.2 | Database queries | Locked; TypeScript-first |
| @clerk/nextjs | ^7.2.7 | Web auth | Locked |
| @clerk/expo | ^3.2.4 | Mobile auth | Locked |
| TanStack Query | ^5.100.5 | Data fetching + cache | Locked; useInfiniteQuery for review list |
| Zod v4 | already installed | Schema validation | Locked; `import { z } from 'zod/v4'` |
| @lunchboxd/shared | workspace | Shared schemas + tokens | Required for new profileSchema, patchUserSchema |

### No New Packages Required

All needed libraries are already installed. No new `npm install` step is needed for this phase.

---

## Architecture Patterns

### Critical: `/@username` URL Implementation

**Problem:** The `@` character in Next.js App Router file system is reserved for parallel routes. A folder named `@[username]` or `@username` becomes a parallel slot, not a URL segment. The URL produced would be `/<username>` not `/@<username>`.

**Solution (verified from Next.js 16 docs):** Use a `proxy.ts` rewrite rule at the project root (`apps/web/proxy.ts`) to rewrite `/@<username>` requests to `/[username]`. The actual page lives at `apps/web/app/(app)/[username]/page.tsx`.

**Conflict risk:** The dynamic `[username]` segment at the root of `(app)` group would also match `/search`, `/reviews`, `/welcome`, `/profile`. Must ensure the proxy rewrites only `/@*` paths, and the `[username]` page handles 404 for unknown users gracefully.

**File structure:**

```
apps/web/
├── proxy.ts                              # NEW — rewrite /@:username → /:username
├── app/
│   └── (app)/
│       ├── [username]/                   # NEW — profile route group
│       │   ├── page.tsx                  # /@username profile page
│       │   ├── followers/
│       │   │   └── page.tsx              # /@username/followers
│       │   └── following/
│       │       └── page.tsx              # /@username/following
│       ├── profile/
│       │   └── edit/
│       │       └── page.tsx              # /profile/edit (own-profile edit)
│       ├── layout.tsx                    # existing (no changes)
│       ├── page.tsx                      # existing feed
│       ├── reviews/                      # existing
│       ├── search/                       # existing
│       └── welcome/                      # existing
```

**proxy.ts pattern (Next.js 16 — `proxy` not `middleware`):**

```typescript
// Source: Next.js 16 docs — proxy.ts (renamed from middleware.ts)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Rewrite /@username to /username (strips the @ for file routing)
  if (pathname.startsWith('/@')) {
    const username = pathname.slice(2).split('/')[0]
    const rest = pathname.slice(2 + username.length)  // e.g. /followers
    return NextResponse.rewrite(
      new URL(`/${username}${rest}`, request.url)
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/@:path*'],
}
```

**Important:** Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function from `middleware()` to `proxy()`. Using the old name will still work for backward compatibility but triggers a deprecation warning.

### Pattern: Async params in Next.js 16

In Next.js 16, `params` is a **Promise**. All dynamic route pages must `await params`:

```typescript
// Source: Next.js 16 docs — dynamic-routes.md
// Server Component (async page)
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  // ...
}

// Client Component — use React.use()
'use client'
import { use } from 'react'
export default function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  // ...
}
```

### Pattern: New API Endpoints

**1. `GET /api/v1/users/[username]`** — Public profile

```typescript
// apps/web/app/api/v1/users/[username]/route.ts
// Returns: { user: { id, username, displayName, avatarUrl, bio }, stats: { followerCount, followingCount }, reviews: [...] }
// Auth: optional (public profile viewable without auth)
// Lookup: by username, not by ID
// Security: SELECT only safe fields — no email, no clerkId
```

**2. `PATCH /api/v1/users/me`** — Edit own profile

```typescript
// Apps: web/app/api/v1/users/me/route.ts
// Body: { bio?: string, displayName?: string, avatarUrl?: string }
// Auth: required; actor from await auth()
// Update: users table WHERE id = actorUserId
```

**3. `GET /api/v1/users/[username]/followers`** — Followers list

```typescript
// Returns: users[] with followState enrichment (same as user search)
// Lookup: follows WHERE followeeId = profileUserId
// Join: users on followerId
// Enrich: followState vs current viewer (same batch pattern as search)
```

**4. `GET /api/v1/users/[username]/following`** — Following list

```typescript
// Returns: users[] with followState enrichment
// Lookup: follows WHERE followerId = profileUserId
// Join: users on followeeId
```

### Pattern: Profile Review List (separate from `/api/v1/reviews`)

The existing `GET /api/v1/reviews` returns the **current user's** reviews only (uses Clerk auth to derive userId). The profile review list needs reviews by **any username**. Two options:

**Option A:** Add optional `username` query param to existing reviews endpoint.
**Option B:** Add a separate endpoint `GET /api/v1/users/[username]/reviews`.

**Recommendation: Option B** (separate endpoint). Keeps the existing `/api/v1/reviews` endpoint unchanged (no risk of regressions), and fits the RESTful pattern already established for user-scoped resources.

**Shape:** Same as feed items but without `author` field (since it's a profile page, `showAuthor=false`). Include `likeCount` and `isLikedByMe` (requires viewer auth, but viewer may be unauthenticated). Handle the unauthenticated case: `isLikedByMe: false`, like counts still shown.

### Pattern: Infinite Scroll for Profile Reviews

Reuse the exact same `useInfiniteQuery` + IntersectionObserver sentinel pattern from the web feed (`apps/web/app/(app)/page.tsx`):

```typescript
// Source: existing apps/web/app/(app)/page.tsx — exact pattern
useInfiniteQuery({
  queryKey: ['profile-reviews', username],
  queryFn: async ({ pageParam }) => {
    const url = pageParam
      ? `/api/v1/users/${username}/reviews?cursor=${encodeURIComponent(pageParam)}&limit=20`
      : `/api/v1/users/${username}/reviews`
    const res = await fetch(url)
    return res.json()
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 60_000,
})
```

Mobile profile review list uses `FlatList` with `onEndReached` / `onEndReachedThreshold={0.5}` — same as the mobile feed.

### Pattern: Profile Query Key

Use query key `['profile', username]` for the profile data. On edit save success, invalidate this key:

```typescript
queryClient.invalidateQueries({ queryKey: ['profile', username] })
```

### Pattern: Mobile Navigation for Profile

The `(app)/_layout.tsx` uses a `Stack` with `headerShown: false`. New screens are added as stack segments (files in `apps/mobile/app/(app)/`):

```
apps/mobile/app/(app)/
├── _layout.tsx        # Stack, headerShown: false
├── (tabs)/
│   ├── _layout.tsx    # Tab bar layout
│   ├── index.tsx      # Feed
│   ├── search.tsx     # Search
│   ├── compose.tsx    # New review
│   └── profile.tsx    # Own profile (replace stub with ProfileScreen)
├── profile/           # NEW — screens pushed from tabs
│   ├── edit.tsx       # EditProfileScreen
│   └── [username].tsx # ProfileScreen for other users
├── followers/
│   └── [username].tsx # FollowersScreen
└── following/
    └── [username].tsx # FollowingScreen
```

Pushing another user's profile: use `router.push('/profile/sarah')` from Expo Router, which maps to `apps/mobile/app/(app)/profile/[username].tsx`.

For the own profile tab (`profile.tsx`), use `useUser()` from `@clerk/expo` to get the current username, then render the same `ProfileScreen` component parameterized by that username.

### Pattern: Own-Profile Detection

**Web:** Compare `useUser().user?.username` (Clerk) against the profile's `username` field. If they match, render [Edit Profile]; else render [Follow].

**Mobile:** Same logic using `useUser()` from `@clerk/expo`.

The `ProfileScreen` component should accept a `username` prop, fetch profile data, and conditionally render based on `isOwner = viewerUsername === profileUsername`.

### Pattern: Display Name Inclusion (Claude's Discretion)

Include `displayName` on the edit page. The schema already has `displayName text` on the `users` table. The `PATCH /api/v1/users/me` endpoint will accept `{ bio, displayName, avatarUrl }`. The edit form shows three fields: display name input, bio textarea, avatar upload. This is minimal added complexity for complete profile editing.

### Pattern: Avatar Upload Flow

Reuse existing R2 upload flow exactly:

```
1. User selects image file
2. POST /api/v1/uploads { contentType: 'image/jpeg' }
   → Returns { uploadUrl, key }
3. PUT {uploadUrl} with file binary (direct to R2)
4. Construct avatarUrl = `${R2_PUBLIC_URL}/${key}`
5. PATCH /api/v1/users/me { avatarUrl }
```

Note: The existing uploads endpoint generates keys as `reviews/<clerkId>/<uuid>`. Avatar uploads should use a different prefix. Options:
- Add `type` param to the uploads endpoint to support `avatars/<clerkId>/<uuid>` key prefix
- Or keep the same prefix (reviews/) — functionally identical, only cosmetically different

**Recommendation:** Add optional `type: 'review' | 'avatar'` field to the upload endpoint's body schema. Default to `'review'`. When `'avatar'`, use key prefix `avatars/<clerkId>/<uuid>`. This is a small change to an existing endpoint and keeps avatar keys logically separate. Add a shared `uploadSchema` to `@lunchboxd/shared`.

### Anti-Patterns to Avoid

- **`@[username]` folder name:** Do NOT create a folder literally named `@[username]` — Next.js interprets it as a parallel route slot, not a URL segment. Use `[username]` with a proxy.ts rewrite.
- **Synchronous params access:** Do NOT use `params.username` directly — `params` is a Promise in Next.js 16. Always `await params`.
- **`middleware.ts`:** Do NOT create `middleware.ts` — it is deprecated in Next.js 16. Use `proxy.ts` with `export function proxy()`.
- **N+1 follow-state queries:** Follow-state enrichment in follower/following lists MUST use the same batch pattern as user search (two flat queries with `inArray`), not per-user queries.
- **Exposing email/clerkId:** Profile API responses must never include `email` or `clerkId` fields — only `id, username, displayName, avatarUrl, bio`.
- **`db.transaction()`:** Neon HTTP adapter does not support transactions. Use sequential `await` calls.
- **Hard-coded query key mismatch:** Profile review list uses `['profile-reviews', username]` — distinct from `['my-reviews']` (own reviews page) and `['feed']` (feed). Cache invalidation on edit must target the correct key.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar upload to R2 | New upload endpoint | `POST /api/v1/uploads` (existing) | Already handles auth, content-type validation, presigned URL, key naming |
| Follower/following list items | New card component | `UserSearchCard` + `FollowButton` (existing) | Already renders avatar, name, follow state, follow action |
| Profile review cards | New review card | `ReviewCard` with `showAuthor={false}` | Already handles rating, body, tags, photo, like button, expand/collapse |
| Follow action on profile | New follow endpoint | `POST /api/v1/follows` (existing) | Already handles idempotent follow, friendship detection, userStats update |
| Infinite scroll sentinel | Custom scroll listener | `IntersectionObserver` + `useInfiniteQuery` (existing feed pattern) | Battle-tested; avoids scroll event performance issues |
| Follow-state enrichment | Per-user queries | Batch `inArray` pattern from user search | Prevents N+1 on lists with 20+ users |
| Mobile bearer auth | Token caching | `getToken()` inside queryFn (existing pattern) | Tokens expire; cached tokens cause 401 errors |

**Key insight:** This phase's value is in assembling existing parts correctly, not in building new infrastructure. The main new artifacts are glue (API routes, page components) not new abstractions.

---

## Common Pitfalls

### Pitfall 1: `@` Folder Name is a Parallel Route Slot

**What goes wrong:** Creating `apps/web/app/(app)/@[username]/page.tsx` — Next.js treats this as a parallel route slot named `[username]`, not a URL segment. The URL produced would be `/<username>` (slot is invisible to URL), and the parent layout would need to accept a `[username]` prop. The `/@username` URL would not work at all.

**Why it happens:** Next.js App Router uses the `@folder` convention for parallel routes (slots), which is completely separate from dynamic segments (`[folder]`). The `@` is a reserved character in the file system routing.

**How to avoid:** Use `proxy.ts` to rewrite `/@:username` → `/:username`. The page lives at `[username]/page.tsx` (no `@` in the folder name).

**Warning signs:** If the profile page renders but the URL doesn't contain `@`, or if the parent layout starts receiving unexpected props, the `@` folder was interpreted as a slot.

### Pitfall 2: Synchronous params Access (Next.js 16)

**What goes wrong:** Writing `const { username } = params` — `params` is a `Promise<{ username: string }>` in Next.js 16. This produces a runtime error or silently gets `undefined`.

**Why it happens:** Next.js 15 changed `params` from a sync prop to a Promise for streaming/caching architecture reasons. Next.js 16 made this the only supported pattern.

**How to avoid:** In Server Components, `const { username } = await params`. In Client Components, `const { username } = use(params)` (React 19 `use` hook).

**Warning signs:** `username` is `undefined` or you see a Next.js warning about synchronous params access.

### Pitfall 3: [username] Route Conflicts with Existing App Routes

**What goes wrong:** Adding `app/(app)/[username]/page.tsx` means ANY path under `(app)` that doesn't match a more-specific route will hit the profile page. This could catch `/search`, `/reviews`, `/welcome`, `/profile` if they're siblings.

**Why it happens:** Dynamic segments in Next.js have lower priority than static segments, but the `(app)` group layout wraps all routes at the same level. If `[username]` and `search` are siblings in the same directory, `search` takes priority. But if `[username]` exists alongside any route that is NOT defined (e.g., a typo URL), it will render the profile page for that "username" instead of 404-ing.

**How to avoid:** (1) All existing named routes (`search`, `reviews`, `welcome`) are static segments that take priority over `[username]`. Verify each existing route has its folder. (2) In the `[username]/page.tsx`, if `GET /api/v1/users/[username]` returns 404 (user not found), call Next.js `notFound()` to render the 404 page.

**Warning signs:** Navigating to `/nonexistent-page` shows the profile page's "not found" state instead of Next.js 404.

### Pitfall 4: Query Key Collision Between Profile Reviews and Own Reviews

**What goes wrong:** Using `['my-reviews']` as the query key for profile review history — this collides with the existing own-reviews page query key. Invalidating after a review edit would incorrectly refetch the profile page's review list.

**Why it happens:** The existing `GET /api/v1/reviews` (own reviews) uses query key `['my-reviews']`. If profile reviews use the same key, mutations from other pages will incorrectly invalidate the cache.

**How to avoid:** Use `['profile-reviews', username]` as the query key for profile review lists. This is username-scoped and won't collide with any existing keys.

**Warning signs:** After editing a review on the `/reviews` page, the profile page's review list refreshes unexpectedly (or vice versa).

### Pitfall 5: Mobile proxy.ts / Expo Router — No proxy.ts Needed

**What goes wrong:** Trying to apply the `/@username` URL constraint to the mobile Expo Router. Mobile navigation uses `router.push('/profile/sarah')` — there is no `@` prefix in mobile URLs.

**Why it happens:** The `/@username` URL decision (D-01) is web-only. Mobile uses Expo Router file-based routing with no `@` prefix.

**How to avoid:** Mobile routes use `/profile/[username]` (maps to `apps/mobile/app/(app)/profile/[username].tsx`). No proxy needed on mobile.

### Pitfall 6: `middleware.ts` Deprecated in Next.js 16

**What goes wrong:** Creating `apps/web/middleware.ts` — Next.js 16 has renamed this to `proxy.ts`. While backward compatibility may still work, it is deprecated and the function export name changes from `middleware()` to `proxy()`.

**Why it happens:** Next.js 16 renamed Middleware to Proxy to distinguish it from Express-style middleware.

**How to avoid:** Create `apps/web/proxy.ts` (not `middleware.ts`). Export `function proxy()` not `function middleware()`.

**Warning signs:** Console warning about deprecated `middleware.ts`; TypeScript may not recognize the old types.

### Pitfall 7: Avatar URL Construction — Missing R2_PUBLIC_URL

**What goes wrong:** After upload, the returned `key` from `POST /api/v1/uploads` is used to construct the public URL, but this requires `R2_PUBLIC_URL` env var. If missing, the avatar URL will be malformed.

**Why it happens:** The upload endpoint returns `{ uploadUrl, key }` — not the final public URL. The PATCH endpoint or client must construct `${R2_PUBLIC_URL}/${key}`. The existing review upload flow does this in `POST /api/v1/reviews` on the server side.

**How to avoid:** For avatar upload, either: (a) the client sends the `key` to `PATCH /api/v1/users/me` and the server constructs the URL, or (b) the server returns the public URL from the uploads endpoint. Option (a) is consistent with the existing review pattern. The `PATCH /api/v1/users/me` handler should construct the URL server-side using `process.env.R2_PUBLIC_URL`.

---

## Code Examples

### proxy.ts — `/@username` Rewrite

```typescript
// Source: Next.js 16 docs — proxy.ts (apps/web/proxy.ts)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/@')) {
    // Strip @ and preserve sub-paths like /followers, /following
    const withoutAt = pathname.slice(1)  // remove leading /, giving @username[/rest]
    const rest = withoutAt.slice(1)      // remove @, giving username[/rest]
    return NextResponse.rewrite(new URL(`/${rest}`, request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/@:path*'],
}
```

### Profile Page — Server Component (Next.js 16 async params)

```typescript
// Source: Next.js 16 docs — dynamic-routes.md
// apps/web/app/(app)/[username]/page.tsx
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params  // REQUIRED: params is a Promise in Next.js 16
  const { userId: clerkId } = await auth()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/users/${username}`,
    { cache: 'no-store' }  // profile data is dynamic
  )
  if (res.status === 404) notFound()
  const data = await res.json()
  // ...render ProfileHeader + review list
}
```

### PATCH /api/v1/users/me — Edit Profile

```typescript
// Pattern follows existing API routes
// apps/web/app/api/v1/users/me/route.ts
import { auth } from '@clerk/nextjs/server'
import { resolveUserId } from '@/lib/queries'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { patchUserSchema } from '@lunchboxd/shared'
import { eq } from 'drizzle-orm'

export async function PATCH(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  // Construct avatarUrl server-side from key
  const avatarUrl = parsed.data.avatarKey
    ? `${process.env.R2_PUBLIC_URL}/${parsed.data.avatarKey}`
    : parsed.data.avatarUrl  // direct URL if provided

  await db.update(users)
    .set({
      bio: parsed.data.bio,
      displayName: parsed.data.displayName,
      ...(avatarUrl && { avatarUrl }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, actorUserId))

  return NextResponse.json({ ok: true })
}
```

### Shared Schema — patchUserSchema

```typescript
// packages/shared/src/schemas/index.ts — add below existing schemas
export const patchUserSchema = z.object({
  bio: z.string().max(500).optional(),
  displayName: z.string().max(50).optional(),
  avatarKey: z.string().optional(),  // R2 key; server constructs URL
  avatarUrl: z.string().url().optional(),  // direct URL (fallback)
})
export type PatchUserInput = z.infer<typeof patchUserSchema>
```

### Followers List Query — Batch Follow-State Enrichment

```typescript
// Pattern: same as apps/web/app/api/v1/users/search/route.ts
// apps/web/app/api/v1/users/[username]/followers/route.ts
// 1. Resolve profileUserId from username
// 2. SELECT followers: follows WHERE followeeId = profileUserId → join users
// 3. If viewer authenticated: batch followState enrichment with inArray
// 4. Return users[] with followState
// NEVER N+1 — always use inArray batch
```

### Mobile ProfileScreen — getToken Pattern

```typescript
// Pattern: same as apps/mobile/app/(app)/(tabs)/search.tsx
const { getToken } = useAuth()
const { data: profile } = useQuery({
  queryKey: ['profile', username],
  queryFn: async () => {
    const token = await getToken()  // INSIDE queryFn, not at hook level
    const res = await fetch(`${API_BASE_URL}/api/v1/users/${username}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Profile not found')
    return res.json()
  },
})
```

---

## Runtime State Inventory

Phase 5 is new feature development (not a rename/refactor/migration). No runtime state inventory required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server | ✓ | Detected (project runs) | — |
| Cloudflare R2 | Avatar upload | ✓ | Existing — Phase 2 tested | 503 response if creds missing (existing behavior) |
| Neon (Postgres) | All DB queries | ✓ | Existing — all phases used it | — |
| Clerk | Auth in API routes + UI | ✓ | Existing — all phases used it | — |
| Expo SDK ~55 | Mobile app | ✓ | Existing — Phase 4 shipped | — |

No missing dependencies. All required services are already live and tested.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npm run test` |
| Full suite command | `cd apps/web && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | patchUserSchema accepts valid avatarKey | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |
| PROF-02 | patchUserSchema accepts valid bio (max 500) | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |
| PROF-02 | patchUserSchema rejects bio > 500 chars | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |
| PROF-04 | patchUserSchema accepts partial updates | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |
| PROF-03/04/05/06 | profileQuerySchema (cursor pagination) validates correctly | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm run test`
- **Per wave merge:** `cd apps/web && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/profiles.test.ts` — covers patchUserSchema (bio max, displayName max, avatarKey format), profileQuerySchema (cursor pagination validation)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` with `export function middleware()` | `proxy.ts` with `export function proxy()` | Next.js 16.0.0 | Must use `proxy.ts` — creating `middleware.ts` is deprecated |
| Sync params: `const { slug } = params` | Async params: `const { slug } = await params` | Next.js 15+ | All dynamic route pages must await params |
| `@clerk/nextjs` v5/v6 patterns | Clerk 7 — `auth()` returns `{ userId }` not session; `useSignIn()` returns `{ signIn: SignInFutureResource }` | Clerk 7 | Use established patterns from STATE.md |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16 — use `proxy.ts`
- Synchronous `params` access: Deprecated in Next.js 15, unsupported in 16

---

## Open Questions

1. **Profile page Server Component vs Client Component**
   - What we know: CONTEXT.md says "use Server Components for profile pages" (CLAUDE.md). The profile page needs to fetch profile data. Review list needs `useInfiniteQuery` (client-side).
   - What's unclear: Can we make the profile header a Server Component and the review list a Client Component within the same page?
   - Recommendation: Use a Server Component for the page shell and `ProfileHeader`. Extract the review list into a `ProfileReviewList` Client Component that handles its own `useInfiniteQuery`. This is the standard App Router "islands" pattern. The `isOwner` determination can be done server-side via `auth()`.

2. **Upload endpoint key prefix for avatars**
   - What we know: Existing upload endpoint uses `reviews/<clerkId>/<uuid>` key prefix. Avatar uploads are semantically different.
   - What's unclear: Whether to modify the upload endpoint to accept a `type` param.
   - Recommendation: Accept optional `type: 'review' | 'avatar'` in the upload body. Default to `'review'`. This is a small backward-compatible change. Adds clarity without breaking anything.

3. **`/profile` redirect to `/@username` on web**
   - What we know: D-02 says `/profile` should redirect to `/@<current-user-username>`.
   - What's unclear: Where to implement this redirect — in the `[username]` page? A separate `/profile/page.tsx`? Or the proxy.ts?
   - Recommendation: Add `app/(app)/profile/page.tsx` as a Server Component that reads `auth()`, resolves the username, and calls `redirect(`/@${username}`)`. This is a simple, clean implementation. Note: `profile/edit/page.tsx` must also exist alongside it and takes precedence over the dynamic `[username]` segment because named routes have higher priority.

---

## Sources

### Primary (HIGH confidence)

- Next.js 16 docs in `node_modules/next/dist/docs/` — verified locally:
  - `01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — async params pattern
  - `01-app/03-api-reference/03-file-conventions/parallel-routes.md` — `@folder` = slot (not URL segment)
  - `01-app/03-api-reference/03-file-conventions/proxy.md` — middleware renamed to proxy in v16
- `apps/web/lib/schema.ts` — verified all schema columns (displayName, bio, avatarUrl, userStats)
- `apps/web/lib/queries.ts` — verified resolveUserId pattern
- `apps/web/app/api/v1/users/search/route.ts` — verified follow-state enrichment batch pattern
- `apps/web/app/api/v1/uploads/route.ts` — verified R2 upload pipeline
- `apps/web/app/api/v1/follows/route.ts` — verified follow/unfollow patterns
- `apps/web/components/user-search-card.tsx` — verified component props and rendering
- `apps/web/components/review-card.tsx` — verified showAuthor prop behavior
- `apps/web/app/(app)/page.tsx` — verified useInfiniteQuery + IntersectionObserver pattern
- `apps/mobile/components/user-search-card.tsx` — verified mobile UserSearchCard
- `apps/mobile/components/follow-button.tsx` — verified getToken() inside mutationFn
- `apps/mobile/app/(app)/(tabs)/search.tsx` — verified mobile query pattern
- `packages/shared/src/schemas/index.ts` — verified existing schemas
- `packages/shared/src/constants/tokens.ts` — verified design tokens
- `apps/web/vitest.config.ts` — verified test framework configuration

### Secondary (MEDIUM confidence)

- STATE.md — cross-referenced all locked decisions, Clerk 7 patterns, mobile StyleSheet.create decision
- 05-UI-SPEC.md — verified component inventory, layout specs, avatar sizing, copywriting contract

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified in package.json
- Architecture: HIGH — patterns verified from existing codebase + Next.js 16 local docs
- Pitfalls: HIGH — `@` folder issue and async params verified directly from Next.js 16 official docs in node_modules

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable stack; Next.js 16 is locked version)
