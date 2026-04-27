# Phase 1: Auth & Foundation - Research

**Researched:** 2026-04-27
**Domain:** Turborepo monorepo setup, Clerk authentication (web + mobile), Drizzle + Neon database schema
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Turborepo monorepo with `apps/web` (Next.js 16) and `apps/mobile` (Expo managed workflow) and `packages/shared`
- **D-02:** `packages/shared` contains: TypeScript types (User, Review, Restaurant, etc.), typed API client (fetch wrapper imported by both apps), Zod validation schemas (shared client/server), and UI constants (colors, spacing, design tokens)
- **D-03:** Sign-up collects email + password + username in a single step. Username is the user's public handle (e.g. @sydney) and is set at registration so their profile URL is available immediately.
- **D-04:** Single-step sign-up form — all fields on one screen, fastest path into the app.
- **D-05:** Full schema laid down in Phase 1 — all tables defined upfront: `users`, `restaurants`, `reviews`, `review_tags`, `follows`, `friendships`, `feed_items`, `likes`, `notifications`, `user_stats`. Future phases write application code against existing tables — no phase-blocking migrations.
- **D-06:** Schema must follow research-mandated patterns: `place_id` nullable on restaurants (manual entries are first-class), separate `follows` and `friendships` tables, `feed_items` table for fan-out-on-write architecture, `deleted_at` soft-delete column on reviews.
- **D-07:** After sign-up, show a minimal single-screen onboarding step: "Here's how Lunchboxd works" with two calls to action — log your first meal, or find friends to follow.
- **D-08:** Session expiry: silent redirect to login page with message "Your session expired, please sign in again." No in-app modal.

### Claude's Discretion

- Exact Turborepo workspace configuration and tooling (lint, format, TypeScript config sharing)
- Clerk webhook setup for syncing auth events to the local `users` table
- EAS development build configuration (required — do not use Expo Go; SecureStore needs a dev build)
- API route structure under `/api/v1/` (establish versioning prefix in Phase 1)
- Environment variable management across monorepo workspaces

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password | Clerk `@clerk/nextjs` + `@clerk/expo` handle email/password sign-up out of the box; username must be stored in local `users` table via webhook sync after Clerk creates the account |
| AUTH-02 | User can log in with email and password and stay logged in across sessions | Clerk issues session tokens; web uses httpOnly cookie sessions managed by Clerk middleware; mobile uses `expo-secure-store` via `@clerk/expo/token-cache` for persistent token storage |
| AUTH-03 | User can sign in with Google OAuth | Enable Google OAuth provider in Clerk Dashboard; `@clerk/expo` supports native Google Sign-In in SDK 3.1+ (released March 2026); no custom OAuth callback needed |
| AUTH-04 | User can reset password via email link | Clerk handles password reset emails entirely — no custom implementation required; configure email template in Clerk Dashboard |
</phase_requirements>

---

## Summary

Phase 1 establishes three parallel workstreams that must complete before any feature work begins: (1) the Turborepo monorepo scaffold, (2) Clerk authentication wired on both web and mobile, and (3) the full Drizzle schema deployed to Neon. All three must exist for the remaining phases to proceed — they have no meaningful partial state.

The most significant Phase 1 decision is the package rename: the Expo Clerk SDK was renamed from `@clerk/clerk-expo` to `@clerk/expo` in Core 3 (released March 3, 2026). The current version is 3.2.4. Any tutorial or guide referencing `@clerk/clerk-expo` is using the old name — use `@clerk/expo` throughout. The web package `@clerk/nextjs` is unchanged at version 7.2.7.

The second most important finding: Expo SDK 55 (released 2026) dropped the Legacy Architecture. The New Architecture is now mandatory. This means Hermes v1 is the JS engine and React Native 0.85.2 is bundled. EAS development builds are required from day one (D-08 already mandates this) — Expo Go cannot run `expo-secure-store` or `@clerk/expo`'s token caching. Creating the EAS development build is a concrete deliverable in this phase.

**Primary recommendation:** Scaffold the Turborepo monorepo with pnpm workspaces, install and configure Clerk on both apps, set up the Clerk webhook endpoint to sync `user.created`/`user.updated`/`user.deleted` events to the local `users` table, define the full Drizzle schema in a single migration, and create the EAS development build — all in this phase.

---

## Standard Stack

### Core (verified against npm registry 2026-04-27)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `turbo` | 2.9.6 | Monorepo task runner | Remote caching, incremental builds, parallelized tasks |
| `next` | 16.2.4 | Web app + API layer | Locked decision; Route Handlers serve both web and mobile |
| `expo` | 55.0.17 | Mobile app runtime | Locked decision; SDK 55 is current stable with React Native 0.85 |
| `expo-router` | 55.0.13 | File-based mobile routing | Bundled with Expo 55; same mental model as Next.js App Router |
| `@clerk/nextjs` | 7.2.7 | Auth for web | Core 3 release; clerkMiddleware() for route protection |
| `@clerk/expo` | 3.2.4 | Auth for mobile | **Renamed from `@clerk/clerk-expo`** in Core 3 (March 2026) |
| `expo-secure-store` | 55.0.13 | Token persistence on mobile | Bundled with Expo 55; required by `@clerk/expo` for token cache |
| `drizzle-orm` | 0.45.2 | ORM / query builder | TypeScript-first, no Rust binary (unlike Prisma), SQL-like API |
| `drizzle-kit` | 0.31.10 | Migration generator | Paired with drizzle-orm for schema migrations |
| `@neondatabase/serverless` | 1.1.0 | Neon HTTP/WebSocket driver | Required for serverless Neon connections from Vercel/Next.js |
| `zod` | 4.3.6 | Validation | Shared validation between web and mobile via `packages/shared` |
| `svix` | 1.92.2 | Clerk webhook verification | Cryptographically verifies Clerk webhook signatures |
| `nativewind` | 4.2.3 | Tailwind for React Native | Shared design vocabulary between web and mobile |
| `tailwindcss` | 4.2.4 | Styling on web | Locked via CLAUDE.md |
| `@tanstack/react-query` | 5.100.5 | Async state / data fetching | Same library on web and mobile; query key sharing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-image` | 55.0.9 | Optimized image component | All image rendering in mobile app |
| `react-native-reanimated` | bundled | Animation foundation | Required by NativeWind v4 |
| `typescript` | ^5.x | Language | End-to-end type safety |

### Alternatives Considered (do not use)

| Instead of | Could Use | Reason Rejected |
|------------|-----------|-----------------|
| `@clerk/expo` | `@clerk/clerk-expo` | Old package name; deprecated since March 2026 |
| `drizzle-orm` | `prisma` | Rust binary adds cold-start latency in Vercel serverless |
| `@neondatabase/serverless` | `pg` / `postgres` | TCP connections don't work in serverless; Neon HTTP driver is required |
| `expo-router` | `react-navigation` | Expo Router supersedes standalone React Navigation for Expo projects |

**Installation:**

```bash
# Create monorepo
npx create-turbo@latest lunchboxd --package-manager pnpm

# Web app (from monorepo root)
cd apps/web
pnpm add @clerk/nextjs drizzle-orm @neondatabase/serverless zod svix @tanstack/react-query
pnpm add -D drizzle-kit tailwindcss

# Mobile app (from monorepo root)
cd apps/mobile
npx create-expo-app@latest . --template tabs
pnpm add @clerk/expo @tanstack/react-query nativewind react-native-reanimated
npx expo install expo-secure-store expo-image expo-router

# Shared package
cd packages/shared
pnpm add zod
```

**Version verification (confirmed 2026-04-27):** All versions above verified via `npm view [package] version` against live npm registry.

---

## Architecture Patterns

### Recommended Project Structure

```
lunchboxd/                      # Turborepo root
├── apps/
│   ├── web/                    # Next.js 16 App Router
│   │   ├── app/
│   │   │   ├── (auth)/         # Clerk sign-in, sign-up, reset routes
│   │   │   ├── (app)/          # Protected app routes
│   │   │   └── api/
│   │   │       └── v1/         # All API routes under /api/v1/
│   │   │           └── webhooks/
│   │   │               └── clerk/  # Clerk webhook endpoint
│   │   ├── middleware.ts        # clerkMiddleware() here
│   │   └── lib/
│   │       └── db.ts           # Drizzle + Neon client
│   └── mobile/                 # Expo SDK 55, managed workflow
│       └── app/
│           ├── (auth)/         # Sign-in, sign-up screens
│           ├── (app)/          # Protected tabs/screens
│           └── _layout.tsx     # ClerkProvider wraps everything here
├── packages/
│   └── shared/                 # packages/shared per D-02
│       ├── src/
│       │   ├── types/          # User, Review, Restaurant, etc.
│       │   ├── schemas/        # Zod validation schemas
│       │   ├── api/            # Typed fetch wrapper
│       │   └── constants/      # Colors, spacing, design tokens
│       └── package.json
├── turbo.json
└── pnpm-workspace.yaml
```

### Pattern 1: Clerk Middleware (Web)

**What:** `clerkMiddleware()` from `@clerk/nextjs` runs on every request via `middleware.ts`. Public routes are explicitly listed; all others are protected.

**When to use:** All Next.js web protected routes.

```typescript
// apps/web/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/v1/webhooks(.*)',  // Clerk webhook must be public
])

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

### Pattern 2: Clerk Provider (Mobile)

**What:** `ClerkProvider` from `@clerk/expo` wraps the root `_layout.tsx`. Token cache uses `@clerk/expo/token-cache` which internally uses `expo-secure-store`.

**When to use:** Mobile app root layout.

```typescript
// apps/mobile/app/_layout.tsx
import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { Slot } from 'expo-router'

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <Slot />
    </ClerkProvider>
  )
}
```

**Critical:** `EXPO_PUBLIC_` prefix is required — Expo inlines env vars at build time.

### Pattern 3: Clerk Webhook — Sync to Local users Table

**What:** Clerk calls your `/api/v1/webhooks/clerk` Route Handler on `user.created`, `user.updated`, `user.deleted` events. Your handler verifies the Svix signature then upserts the record into the local `users` table.

**Why:** Clerk owns the auth identity. Your Postgres `users` table owns app-specific data (username, bio, stats). They must stay in sync.

```typescript
// apps/web/app/api/v1/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

export const runtime = 'nodejs'  // REQUIRED: Svix needs Node crypto APIs

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) throw new Error('Missing CLERK_WEBHOOK_SECRET')

  const headerPayload = headers()
  const svixHeaders = {
    'svix-id': headerPayload.get('svix-id')!,
    'svix-timestamp': headerPayload.get('svix-timestamp')!,
    'svix-signature': headerPayload.get('svix-signature')!,
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, svixHeaders) as WebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    await db.insert(users).values({
      clerkId: event.data.id,
      email: event.data.email_addresses[0].email_address,
      // username collected separately at sign-up via Clerk metadata
    })
  }

  return new Response('OK', { status: 200 })
}
```

### Pattern 4: Drizzle Schema — Full Phase 1 Definition

**What:** All tables defined in a single `schema.ts` file and migrated to Neon in one operation. Future phases add application logic against these tables without additional migrations.

```typescript
// apps/web/lib/schema.ts
import { pgTable, uuid, text, timestamp, numeric, boolean, pgEnum } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').unique().notNull(),
  username: text('username').unique().notNull(),
  email: text('email').unique().notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: text('place_id'),          // nullable — manual entries are first-class (D-06)
  source: text('source'),             // 'google_places' | 'yelp' | 'manual'
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  restaurantId: uuid('restaurant_id').references(() => restaurants.id),  // nullable for homemade
  mealType: text('meal_type').notNull(),  // 'restaurant' | 'homemade'
  body: text('body'),
  rating: numeric('rating', { precision: 2, scale: 1 }),
  photoUrl: text('photo_url'),
  deletedAt: timestamp('deleted_at'),    // soft-delete (D-06)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const reviewTags = pgTable('review_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  label: text('label').notNull(),
})

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: uuid('follower_id').references(() => users.id).notNull(),
  followeeId: uuid('followee_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
// Indices required: (follower_id), (followee_id) — defined in migration

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userAId: uuid('user_a_id').references(() => users.id).notNull(),
  userBId: uuid('user_b_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const feedItems = pgTable('feed_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').references(() => users.id).notNull(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),  // copy of review created_at
})
// Index required: (owner_user_id, created_at DESC)

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),  // 'follow' | 'like' | 'comment'
  actorId: uuid('actor_id').references(() => users.id),
  reviewId: uuid('review_id').references(() => reviews.id),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  reviewCount: numeric('review_count').default('0').notNull(),
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }),
  followerCount: numeric('follower_count').default('0').notNull(),
  followingCount: numeric('following_count').default('0').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### Pattern 5: Neon DB Connection (Serverless)

```typescript
// apps/web/lib/db.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### Pattern 6: Turborepo Workspace Configuration

```json
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {}
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**pnpm + Expo gotcha:** React Native does not work with pnpm's default symlinked `node_modules`. Add `node-linker=hoisted` to `.npmrc` at the monorepo root:

```
node-linker=hoisted
```

### Pattern 7: Environment Variable Strategy

| Variable | Location | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web/.env.local` | Public, safe in browser |
| `CLERK_SECRET_KEY` | `apps/web/.env.local` | Server-only, never expose |
| `CLERK_WEBHOOK_SECRET` | `apps/web/.env.local` | Server-only, from Clerk Dashboard |
| `DATABASE_URL` | `apps/web/.env.local` | Neon connection string |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/mobile/.env.local` | `EXPO_PUBLIC_` prefix required |

**Never** put `CLERK_SECRET_KEY` or `DATABASE_URL` in `EXPO_PUBLIC_` variables — they would be bundled into the mobile binary.

### Anti-Patterns to Avoid

- **Using Expo Go for development:** SecureStore and `@clerk/expo` require a native build. Run `eas build --profile development --platform ios` (or android) immediately after scaffold. Expo Go will silently fail on token caching.
- **Using `@clerk/clerk-expo`:** This is the old package name. The current package is `@clerk/expo` (renamed in Core 3, March 2026).
- **Omitting `export const runtime = 'nodejs'` on the webhook route:** Next.js App Router defaults to Edge runtime in some configurations. Svix requires Node.js crypto APIs — the webhook handler will fail silently without this export.
- **Storing Clerk `userId` as the primary key in local tables:** Store Clerk's `userId` in a `clerk_id` column, but use your own UUID as the primary key. This avoids lock-in and allows the local record to exist independently of Clerk.
- **Skipping the `/api/v1/` prefix:** D-08 mandates API versioning from day one. All Route Handlers go under `app/api/v1/`. Establish this convention now — retrofitting is painful.
- **Using TCP Postgres driver (`pg`, `postgres`) with Neon on Vercel:** Neon requires its HTTP or WebSocket driver (`@neondatabase/serverless`) in serverless environments. Standard TCP connections time out.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/password auth | Custom bcrypt + JWT + session management | Clerk | 2-3 weeks of work; security vulnerabilities are common; Clerk handles MFA, brute-force protection, email verification |
| Google OAuth flow | Custom OAuth callback handler | Clerk (enable in Dashboard) | OAuth PKCE flow, token rotation, and state management are error-prone; Clerk abstracts entirely |
| Password reset emails | Custom email + tokenized reset link | Clerk (configure template in Dashboard) | Secure token generation, expiry, one-time use — all handled |
| Mobile token storage | AsyncStorage or in-memory | `expo-secure-store` via `@clerk/expo/token-cache` | AsyncStorage is unencrypted; SecureStore uses device keychain |
| Webhook signature verification | Manual HMAC verification | `svix` package | Timing-safe comparison, replay attack prevention, header extraction |
| Database migrations | Manual SQL files | `drizzle-kit generate` + `drizzle-kit migrate` | Type-safe, tracked, reversible |

**Key insight:** The entire authentication surface for this app — sign-up, sign-in, OAuth, password reset, session management, token refresh, secure storage on mobile — is provided by Clerk + Expo SecureStore. Nothing in AUTH-01 through AUTH-04 requires custom auth logic.

---

## Common Pitfalls

### Pitfall 1: `@clerk/clerk-expo` vs `@clerk/expo` Package Name Confusion

**What goes wrong:** Developer installs `@clerk/clerk-expo` (old name). The package still exists on npm (version 2.19.31) but is deprecated. Documentation from before March 2026 uses the old name. The installed package may be missing Core 3 features including native Google Sign-In.

**Why it happens:** The rename happened as part of Core 3 released March 3, 2026. Most tutorials and blog posts still reference the old name.

**How to avoid:** Always install `@clerk/expo` (current version 3.2.4). If a tutorial references `@clerk/clerk-expo`, translate all imports to `@clerk/expo`.

**Warning signs:** `package.json` contains `@clerk/clerk-expo` instead of `@clerk/expo`.

### Pitfall 2: Expo Go Instead of EAS Development Build

**What goes wrong:** Developer uses `npx expo start` without an EAS dev build and tests in Expo Go. Token caching via `expo-secure-store` silently falls back to non-persistent storage. Authentication appears to work but sessions are lost on app restart. The real failure only surfaces when the actual dev build is created.

**Why it happens:** Expo Go is faster to start. EAS builds take 5-15 minutes.

**How to avoid:** Create the EAS development build as an explicit task in Wave 0 of this phase. Run `eas build --profile development --platform ios` and `eas build --profile development --platform android` before writing any auth screens.

**Warning signs:** No `eas.json` file in the mobile app directory; developer is using Expo Go launcher.

### Pitfall 3: Webhook Route Running in Edge Runtime

**What goes wrong:** The Clerk webhook handler fails with a crypto-related error because Next.js App Router routes can execute in Edge runtime, but Svix's signature verification requires Node.js crypto APIs.

**Why it happens:** Next.js App Router may default to or inherit Edge runtime configuration.

**How to avoid:** Add `export const runtime = 'nodejs'` at the top of every webhook Route Handler file.

**Warning signs:** `TypeError: crypto.createHmac is not a function` in webhook logs.

### Pitfall 4: Username Not Stored at Sign-Up

**What goes wrong:** Clerk handles the email/password sign-up but does not know about the username field (a local app concept). If the username is collected in the sign-up form but only stored client-side, it gets lost if the webhook sync fails. Or it is stored correctly at sign-up but the `users` table record is missing until the webhook arrives (eventually consistent delay).

**Why it happens:** Sign-up is a two-phase operation: Clerk creates the auth identity, then the webhook creates the local record. If these are not coordinated, the username can be orphaned.

**How to avoid:** After Clerk sign-up completes on the client, make a direct API call to `POST /api/v1/users` with the username (using the new Clerk session token for auth). This creates the local `users` record immediately rather than waiting for the webhook. The webhook then becomes idempotent (upsert, not insert).

**Warning signs:** `users` table rows missing `username` values; webhook handler doing `INSERT` (not upsert/`onConflictDoUpdate`).

### Pitfall 5: pnpm + Expo Metro Resolver Failures

**What goes wrong:** pnpm's default symlinked `node_modules` structure breaks Metro bundler in React Native. Packages that import from `node_modules` via absolute path may not resolve because Metro follows symlinks differently from Node.

**Why it happens:** pnpm uses a content-addressable store with symlinks; Metro expects hoisted `node_modules`.

**How to avoid:** Add `node-linker=hoisted` to `.npmrc` at the monorepo root before running any `pnpm install`.

**Warning signs:** Metro bundler errors like `Unable to resolve module` for packages that are definitely installed.

### Pitfall 6: Drizzle Schema Index Definitions Missing

**What goes wrong:** The `follows` table and `feed_items` table are created without their performance-critical indices. Feed queries (`WHERE owner_user_id = ?`) and follow graph queries (`WHERE follower_id = ?`) do full table scans. This is invisible in development with small datasets and catastrophic in production.

**Why it happens:** Drizzle table definitions do not require you to define indices separately — they are easy to omit.

**How to avoid:** Define indices explicitly using Drizzle's `index()` function alongside table definitions, not as an afterthought. Required indices:
- `follows`: `(follower_id)` and `(followee_id)`
- `feed_items`: `(owner_user_id, created_at DESC)`
- `reviews`: `(user_id)` and `(deleted_at)` where null

```typescript
import { index } from 'drizzle-orm/pg-core'

export const followsFollowerIdx = index('follows_follower_idx').on(follows.followerId)
export const followsFolloweeIdx = index('follows_followee_idx').on(follows.followeeId)
export const feedItemsOwnerIdx = index('feed_items_owner_idx').on(feedItems.ownerUserId, feedItems.createdAt)
```

---

## Code Examples

### Drizzle + Neon Config File

```typescript
// apps/web/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

Run migrations:
```bash
# Generate migration files from schema changes
pnpm drizzle-kit generate

# Apply migrations to Neon
pnpm drizzle-kit migrate
```

### EAS Configuration

```json
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 18.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### Protecting API Routes (web)

```typescript
// apps/web/app/api/v1/some-endpoint/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... handler logic
}
```

### Protecting Screens (mobile)

```typescript
// apps/mobile/app/(app)/_layout.tsx
import { useAuth } from '@clerk/expo'
import { Redirect, Stack } from 'expo-router'

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <Redirect href="/sign-in" />
  return <Stack />
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@clerk/clerk-expo` | `@clerk/expo` | March 3, 2026 (Core 3) | Must use new package name; old package still on npm but deprecated |
| Manual token cache implementation | `tokenCache` from `@clerk/expo/token-cache` | Core 3 | No custom SecureStore wrapper needed |
| Expo Legacy Architecture | New Architecture only (Hermes v1) | Expo SDK 55 | All RN code must be New Architecture compatible; no bridge modules |
| Expo Go for development | EAS development build required | SDK 53+ for native modules | Dev builds take more time to set up but are mandatory for SecureStore |
| `authMiddleware()` from Clerk | `clerkMiddleware()` | Clerk v5 (2024) | `authMiddleware` is removed; use `clerkMiddleware` with `createRouteMatcher` |

**Deprecated/outdated:**
- `authMiddleware()`: Removed in Clerk v5. All new Next.js integrations use `clerkMiddleware()`.
- `@clerk/clerk-expo`: Deprecated. Use `@clerk/expo`.
- Expo Legacy Architecture: Dropped in SDK 55. New Architecture is mandatory.

---

## Open Questions

1. **Username collection in Clerk sign-up flow**
   - What we know: Clerk's hosted sign-up UI does not have a native "username" field by default. It can be enabled in Clerk Dashboard under "User & Authentication > Personal information."
   - What's unclear: Whether enabling Clerk's built-in username field is preferable to a custom post-signup step where the user enters their handle.
   - Recommendation: Enable Clerk's native username field in Dashboard settings and store it in Clerk metadata. Sync to local `users.username` via the webhook. This keeps the single-step form (D-04) while Clerk validates uniqueness.

2. **Turborepo `packages/shared` compilation strategy**
   - What we know: Shared packages in Turborepo can export raw TypeScript (no compilation) or compiled JS. Expo and Next.js can both consume raw TypeScript via their respective bundlers.
   - What's unclear: Whether NativeWind's Tailwind class extraction will correctly traverse into `packages/shared` components.
   - Recommendation: Export raw TypeScript from `packages/shared`. Configure Metro's `watchFolders` to include the shared package, and configure Tailwind's `content` glob to include `../../packages/shared/src/**/*.{ts,tsx}`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All tooling | Yes | v22.18.0 | — |
| npm/npx | Package management | Yes | 10.9.3 | — |
| pnpm | Monorepo workspace manager | Check at start | — | Install via `npm install -g pnpm` |
| git | Version control | Yes | 2.50.0 | — |
| EAS CLI | EAS development builds | Check at start (latest: 18.8.1) | — | Install via `npm install -g eas-cli` |
| Neon account | Database | External service | — | Create at neon.tech before starting |
| Clerk account | Auth | External service | — | Create at clerk.com before starting |
| Xcode (for iOS sim) | iOS development build | Mac-dependent | — | Use Android-only if Xcode unavailable |

**Missing dependencies with no fallback:**
- Neon account and project — must be created before running `drizzle-kit migrate`
- Clerk account and application — must be created before any auth config; publishable key needed at scaffold time

**Missing dependencies with fallback:**
- pnpm: install via `npm install -g pnpm@latest` as first step
- EAS CLI: install via `npm install -g eas-cli` before creating dev build

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (web), Jest via Expo (mobile) |
| Config file | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| Quick run command | `pnpm test --filter=web -- --run` |
| Full suite command | `pnpm test` (all workspaces) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | POST /api/v1/users creates user record after Clerk webhook | integration | `pnpm test --filter=web -- webhook` | Wave 0 gap |
| AUTH-01 | Sign-up form submits email + password + username | smoke/manual | Manual on dev build | N/A |
| AUTH-02 | Session persists across requests (valid Clerk token accepted) | integration | `pnpm test --filter=web -- auth-middleware` | Wave 0 gap |
| AUTH-02 | Mobile token stored in SecureStore (persists restart) | manual | Manual on dev build | N/A |
| AUTH-03 | Google OAuth redirect resolves to authenticated session | manual | Manual — OAuth cannot be automated in unit tests | N/A |
| AUTH-04 | Password reset email sent for valid email | smoke/manual | Manual — requires email delivery check | N/A |
| AUTH-04 | Reset link sets new password | smoke/manual | Manual | N/A |
| DB schema | All tables exist with correct columns | integration | `pnpm test --filter=web -- schema` | Wave 0 gap |
| DB schema | Indices created on follows and feed_items | integration | `pnpm test --filter=web -- schema` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `pnpm test --filter=web -- --run` (web integration tests only, < 30s)
- **Per wave merge:** `pnpm test` (all workspaces)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/vitest.config.ts` — Vitest config for web app
- [ ] `apps/web/tests/webhook.test.ts` — Clerk webhook handler unit tests (mock Svix verification)
- [ ] `apps/web/tests/auth-middleware.test.ts` — clerkMiddleware route protection tests
- [ ] `apps/web/tests/schema.test.ts` — Drizzle schema smoke test (connect to test DB, verify tables exist)
- [ ] `apps/web/tests/setup.ts` — shared test fixtures (test DB connection, mock Clerk auth)

---

## Sources

### Primary (HIGH confidence)
- `npm view [package] version` — all package versions verified live 2026-04-27
- clerk.com/docs — clerkMiddleware, Route Handlers, Expo quickstart (verified via search 2026-04-27)
- clerk.com/changelog/2026-03-03-core-3 — Core 3 package rename from `@clerk/clerk-expo` to `@clerk/expo`
- clerk.com/articles/what-changed-in-clerk-expo-sdk-3-1 — tokenCache from `@clerk/expo/token-cache`
- expo.dev/changelog/sdk-55 — SDK 55 is current, New Architecture mandatory, React Native 0.85

### Secondary (MEDIUM confidence)
- WebSearch + official Clerk docs cross-reference — Svix webhook verification pattern
- WebSearch + official Drizzle docs cross-reference — neon-http driver + drizzle-kit migration pattern
- WebSearch + Expo monorepo guide — pnpm `node-linker=hoisted` requirement

### Tertiary (LOW confidence)
- Turborepo + Expo Metro `watchFolders` configuration for shared packages (recommendation based on documented patterns, not directly verified for SDK 55)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against live npm registry
- Clerk web integration: HIGH — official Clerk docs and Core 3 release notes verified
- Clerk mobile integration: HIGH — `@clerk/expo` rename and `tokenCache` API verified via official Clerk articles
- Drizzle + Neon setup: HIGH — official Drizzle tutorial for Neon + Next.js confirmed current
- Turborepo + pnpm + Expo: MEDIUM — pnpm hoisting pattern well-documented, but specific SDK 55 + NativeWind tailwind content path configuration not directly verified
- Test framework: MEDIUM — Vitest is standard for Next.js; specific config gaps identified as Wave 0 work

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (Expo SDK release cadence is ~2/year; Clerk Core 3 just shipped — unlikely major changes in 30 days)
