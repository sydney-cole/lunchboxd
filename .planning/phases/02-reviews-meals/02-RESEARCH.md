# Phase 2: Reviews & Meals - Research

**Researched:** 2026-04-29
**Domain:** Review composer, photo upload (Cloudflare R2), Google Places autocomplete proxy, Drizzle schema migration, fan-out-on-write feed seeding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single full-page scrollable form — all fields on one screen (meal type toggle, rating, note, restaurant search, photo, tags, date). No multi-step wizard.
- **D-02:** Entry point is a floating action button (FAB) — persistent `+` in bottom-right corner, visible on the main screen. Always accessible.
- **D-03:** Meal type toggle shown upfront at the top of the form — user picks "Restaurant" or "Homemade" before anything else. Controls which fields appear below.
- **D-04:** Restaurant search is inline autocomplete — a search field on the form, results drop down in real time via Google Places API. No separate search screen or modal.
- **D-05:** "Add manually" option appears only after search returns no results — not always visible. Manual entries are saved as first-class `restaurants` records with `source: 'manual'` and `place_id: null`.
- **D-06:** Homemade meal toggle hides the restaurant search field entirely. `restaurantId` is null and `mealType` is `'homemade'` on the review record.
- **D-07:** Free-text tag input — user types their own tags, not a predefined list. Tags are saved to the `review_tags` table with the user's exact text as `label`.
- **D-08:** Unlimited tags allowed.
- **D-09:** After posting, user lands on their own review list — a minimal reverse-chronological list of their reviews.
- **D-10:** The `reviews` table is missing a `meal_date` column (required for REVW-05). A migration must add `meal_date date` (nullable, defaults to today) before Phase 2 plans run.

### Claude's Discretion

- Half-star rating UI component design (star picker or slider)
- Photo upload timing (on-select preview vs. upload-on-submit)
- Cloudflare R2 upload flow (presigned URL vs. server proxy)
- Form validation approach and error display patterns (follow Phase 1 patterns)
- Review list card layout and information density
- Empty state for review list (new user with no reviews yet)
- Edit flow (inline edit vs. navigate to edit page)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVW-01 | User can post a meal review with a half-star rating (0.5–5 stars) | Half-star rating via controlled numeric input (0.5 step); stored as `numeric(2,1)` in `reviews.rating` |
| REVW-02 | User can add a written note to a review | Free `textarea`; stored as `reviews.body`; already in schema |
| REVW-03 | User can attach a photo to a review | R2 presigned URL flow; store R2 object key in `reviews.photo_url`; Next.js Image `remotePatterns` needed |
| REVW-04 | User can add mood/tags to a review | Free-text input → `review_tags` table per D-07; normalize label (lowercase, trim) on write |
| REVW-05 | User can set the date the meal was eaten | Requires `meal_date date` migration (D-10); `<input type="date">` defaulting to today |
| REVW-06 | User can edit their own review after posting | `PATCH /api/v1/reviews/[id]` — ownership check via Clerk `userId`; replace tags (delete + re-insert) |
| REVW-07 | User can delete their own review | `DELETE /api/v1/reviews/[id]` — soft-delete: set `deleted_at`, cascade feed_items removal |
| MEAL-01 | User can search for a restaurant by name using Google Places autocomplete | Server-proxied `GET /api/v1/restaurants/search?q=` → Google Places `searchText`; debounced 300 ms |
| MEAL-02 | User can manually enter a restaurant name if not found in search | Manual entry path: `source: 'manual'`, `place_id: null`, saved as first-class `restaurants` row |
| MEAL-03 | User can tag a review as a homemade meal (no restaurant required) | `mealType: 'homemade'`, `restaurantId: null` — schema already supports this |
</phase_requirements>

---

## Summary

Phase 2 introduces the full review composer — the core product action — on top of the Phase 1 monorepo scaffold. The technical surface spans four distinct sub-problems: (1) a schema migration to add `meal_date`, (2) Cloudflare R2 presigned URL photo upload with Next.js Image configuration, (3) a proxied Google Places autocomplete endpoint with local caching, and (4) the CRUD API routes for reviews with fan-out-on-write seeding of `feed_items` on creation.

The Drizzle schema already has all required tables (`reviews`, `restaurants`, `review_tags`, `feed_items`). The only schema change is `ALTER TABLE reviews ADD COLUMN meal_date DATE`. All API routes follow the established pattern in `apps/web/app/api/v1/` using `auth()` from `@clerk/nextjs/server` and the Drizzle `db` instance from `apps/web/lib/db.ts`. The review composer is a Client Component (`'use client'`) because it uses real-time autocomplete and controlled state; it is not a Server Action form.

The most failure-prone area is the photo upload pipeline. The PITFALLS research documents that failing to decouple photo upload from review submission causes broken images in feeds. The recommended approach is: issue a presigned PUT URL from a Route Handler, let the client upload directly to R2, receive the R2 object key back, then include that key in the review POST body. The review record and the upload are separate requests.

**Primary recommendation:** Build in wave order — Wave 0: migration + Zod schema + test stubs; Wave 1: R2 presigned URL endpoint + restaurant search proxy; Wave 2: review CRUD API; Wave 3: web composer UI + review list; Wave 4: mobile composer. Each wave is independently verifiable.

---

## Standard Stack

### Core (already installed — no new installs for most items)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | ORM + migrations | Phase 1 locked; `meal_date` migration via `drizzle-kit generate` |
| drizzle-kit | 0.31.10 | Migration generation | Phase 1 locked; inline index callback pattern required |
| @clerk/nextjs | 7.2.7 | Auth in Route Handlers | Phase 1 locked; `auth()` provides `userId` in API routes |
| zod | 4.3.6 | Request validation | Phase 1 locked; import from `zod/v4` subpath |
| @tanstack/react-query | 5.100.5 | Client data fetching + cache | Phase 1 locked; handles optimistic updates on submit |
| next (Route Handlers) | 16.2.4 | API layer | Phase 1 locked; `params` is now a `Promise` — must `await params` |

### New — Photo Upload

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | 3.1038.0 | R2 operations (S3-compatible) | Issuing presigned PUT URLs server-side |
| @aws-sdk/s3-request-presigner | 3.1038.0 | `getSignedUrl()` for S3/R2 | Required for presigned URL generation |

**Version verification:** `npm view @aws-sdk/client-s3 version` → 3.1038.0 (verified 2026-04-29)

These two packages are not yet in `apps/web/package.json`. They must be added.

### New — Mobile Photo Selection

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-image-picker | 55.0.19 | Camera roll / file picker on mobile | Photo selection in Expo mobile composer |

`expo-image-picker` is included in Expo SDK 55 — install via `npx expo install expo-image-picker`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| R2 presigned URL (client uploads directly) | Server proxy (upload through Next.js route) | Server proxy hits serverless function memory limits at ~4 MB and adds latency; presigned URL keeps large transfers off the function |
| `@aws-sdk/client-s3` | Cloudflare's own R2 SDK (`@cloudflare/workers-types`) | The AWS SDK works unchanged with R2 via S3-compatible endpoint; no reason to switch |
| React Hook Form | useActionState + Server Actions | The review composer is a complex controlled form with real-time autocomplete state; React Hook Form gives better UX for field-by-field validation. Server Actions are preferred for simpler forms without real-time validation needs. |

**Installation (new packages only):**
```bash
# In apps/web/
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# In apps/mobile/
npx expo install expo-image-picker
```

---

## Architecture Patterns

### Recommended Directory Additions

```
apps/web/
├── app/
│   ├── (app)/
│   │   ├── reviews/
│   │   │   ├── page.tsx          # My reviews list (D-09 post-submit landing)
│   │   │   └── new/
│   │   │       └── page.tsx      # Review composer (FAB navigates here)
│   ├── api/
│   │   └── v1/
│   │       ├── reviews/
│   │       │   ├── route.ts      # POST (create), GET (my reviews list)
│   │       │   └── [id]/
│   │       │       └── route.ts  # PATCH (edit), DELETE (soft-delete)
│   │       ├── restaurants/
│   │       │   └── search/
│   │       │       └── route.ts  # GET ?q= — proxied Places autocomplete
│   │       └── uploads/
│   │           └── route.ts      # POST — returns presigned R2 PUT URL
├── components/
│   ├── review-composer.tsx       # 'use client' form
│   ├── star-rating.tsx           # Half-star rating input
│   ├── tag-input.tsx             # Free-text tag input
│   ├── restaurant-search.tsx     # Autocomplete dropdown
│   └── review-card.tsx           # Card for review list
packages/shared/src/
└── schemas/
    └── index.ts                  # Add reviewSchema, restaurantSearchSchema
apps/mobile/
└── app/
    └── (app)/
        └── (tabs)/
            └── compose.tsx       # Mobile review composer
```

### Pattern 1: Route Handler with Dynamic Params (Next.js 16)

In Next.js 16, `params` in Route Handlers is a `Promise`. Always `await params`.

```typescript
// Source: apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// apps/web/app/api/v1/reviews/[id]/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params   // MUST await — Next.js 16 breaking change
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ...
}
```

### Pattern 2: Presigned R2 PUT URL Flow

```typescript
// Source: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner docs
// apps/web/app/api/v1/uploads/route.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentType } = await req.json()
  const key = `reviews/${clerkId}/${randomUUID()}`

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }  // 5 minutes
  )

  return NextResponse.json({ uploadUrl: url, key })
}
```

Client flow after receiving the presigned URL:
1. `PUT uploadUrl` with the file as the body (no auth headers needed — presigned URL includes credentials)
2. On HTTP 200, include `key` in the review POST body as `photoKey`
3. Server constructs the CDN URL as `${process.env.R2_PUBLIC_URL}/${key}` and stores it in `reviews.photo_url`

### Pattern 3: Google Places Autocomplete Proxy

```typescript
// Source: Google Places API (New) documentation
// apps/web/app/api/v1/restaurants/search/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants } from '@/lib/schema'
import { ilike } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  // 1. Check local cache first — avoids repeated Places API calls
  const cached = await db.select().from(restaurants)
    .where(ilike(restaurants.name, `%${q}%`))
    .limit(5)

  if (cached.length > 0) return NextResponse.json(cached)

  // 2. Call Google Places (New) searchText endpoint
  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: q, includedType: 'restaurant' }),
  })

  if (!placesRes.ok) return NextResponse.json([])

  const { places = [] } = await placesRes.json()

  // 3. Upsert into local restaurants table (local cache)
  const results = await Promise.all(
    places.slice(0, 5).map(async (p: any) => {
      const [row] = await db.insert(restaurants).values({
        placeId: p.id,
        source: 'google_places',
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? null,
        lat: p.location?.latitude?.toString() ?? null,
        lng: p.location?.longitude?.toString() ?? null,
      })
      .onConflictDoUpdate({
        target: restaurants.placeId,
        set: { name: p.displayName?.text ?? '' },
      })
      .returning()
      return row
    })
  )

  return NextResponse.json(results)
}
```

### Pattern 4: Review POST with Fan-out-on-Write

```typescript
// apps/web/app/api/v1/reviews/route.ts  (POST handler excerpt)
// Fan-out: write one feed_items row per follower immediately on review creation

import { db } from '@/lib/db'
import { reviews, reviewTags, feedItems, follows, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

async function createReview(clerkId: string, body: CreateReviewInput) {
  // 1. Resolve internal userId from clerkId
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.clerkId, clerkId))

  // 2. Insert review
  const [review] = await db.insert(reviews).values({
    userId: user.id,
    restaurantId: body.restaurantId ?? null,
    mealType: body.mealType,
    body: body.note ?? null,
    rating: body.rating?.toString() ?? null,
    photoUrl: body.photoKey ? `${process.env.R2_PUBLIC_URL}/${body.photoKey}` : null,
    mealDate: body.mealDate ?? null,
  }).returning()

  // 3. Insert tags
  if (body.tags?.length) {
    await db.insert(reviewTags).values(
      body.tags.map((label: string) => ({
        reviewId: review.id,
        label: label.toLowerCase().trim(),
      }))
    )
  }

  // 4. Fan-out to followers' feeds (includes author's own feed for their review list)
  const followerRows = await db.select({ followerId: follows.followerId })
    .from(follows).where(eq(follows.followeeId, user.id))

  const feedRows = [
    { ownerUserId: user.id, reviewId: review.id, createdAt: review.createdAt },
    ...followerRows.map(f => ({
      ownerUserId: f.followerId,
      reviewId: review.id,
      createdAt: review.createdAt,
    })),
  ]

  if (feedRows.length > 0) {
    await db.insert(feedItems).values(feedRows)
  }

  return review
}
```

### Pattern 5: Drizzle Migration for meal_date

```typescript
// Drizzle schema addition in apps/web/lib/schema.ts
// Add to the reviews pgTable definition:
mealDate: date('meal_date'),   // nullable; defaults applied client-side (today)
```

Then run:
```bash
cd apps/web && npx drizzle-kit generate
# Produces SQL: ALTER TABLE "reviews" ADD COLUMN "meal_date" date;
npx drizzle-kit migrate
```

**Critical:** Use `date` (not `timestamp`) from `drizzle-orm/pg-core`. The `date` column type maps to PostgreSQL `DATE` and returns a string (`'YYYY-MM-DD'`) from Drizzle — not a JS `Date` object. Handle this at the serialization layer.

```typescript
import { date } from 'drizzle-orm/pg-core'
// In reviews pgTable:
mealDate: date('meal_date'),
```

### Pattern 6: Zod reviewSchema (shared)

```typescript
// packages/shared/src/schemas/index.ts  (addition)
import { z } from 'zod/v4'

export const reviewSchema = z.object({
  mealType: z.enum(['restaurant', 'homemade']),
  restaurantId: z.string().uuid().optional().nullable(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5).optional(),
  note: z.string().max(2000).optional(),
  photoKey: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  mealDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export type CreateReviewInput = z.infer<typeof reviewSchema>
```

### Anti-Patterns to Avoid

- **Awaiting `params` synchronously in Next.js 16:** `params` is a Promise — `const { id } = params` (without await) is a type error and runtime bug. Always `await params`.
- **Calling Google Places from the client:** Exposes the API key. All Places calls go through the `/api/v1/restaurants/search` proxy.
- **Including the photo file in the review POST body:** Multipart bodies in serverless functions hit memory limits. Upload to R2 first, include only the `key` in the review payload.
- **`onConflictDoUpdate` targeting `placeId` without a unique index:** The `restaurants` table has `placeId` as a nullable column. The conflict target must be `(place_id)` with a partial unique index (`WHERE place_id IS NOT NULL`). Without this, manual entries (place_id IS NULL) will conflict incorrectly.
- **Storing full CDN URL in `photo_url`:** Store only the R2 object key; construct the CDN URL at read time using `R2_PUBLIC_URL` env var. This allows CDN domain changes without a data migration.
- **Forgetting `deleted_at IS NULL` in reviews queries:** The `reviews` table uses soft-delete. Every SELECT must filter `WHERE deleted_at IS NULL`. Add this to all Drizzle queries using `.where(isNull(reviews.deletedAt))`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned upload URLs | Custom signed URL logic | `@aws-sdk/s3-request-presigner` `getSignedUrl()` | Signing algorithm (SigV4) has many edge cases; SDK handles expiry, encoding, canonical request format |
| Restaurant search debounce | Manual `setTimeout` cleanup | `useCallback` + `useEffect` with `clearTimeout`, or leverage TanStack Query's `enabled: q.length >= 2` | Race conditions, stale closures; TanStack Query's `enabled` flag is the clean pattern |
| Tag normalization | Custom regex pipeline | `label.toLowerCase().trim()` — sufficient for v1 per D-07 (free-text, exact match) | Tags in this phase are exact-save per user decision; normalization is intentionally minimal |
| Image resizing pipeline | Sharp / ffmpeg in Route Handler | Cloudflare Images transformation via URL params | Cloudflare Images provides on-the-fly WebP conversion and resizing via CDN URL params; no server-side processing |
| Form state management for composer | Zustand slice | React Hook Form 7 | Complex form with interdependent fields (mealType gates restaurantId); RHF's `watch()` + `setValue()` handles conditional field logic cleanly |

**Key insight:** The R2 presigned URL pattern shifts file upload bandwidth entirely to the CDN layer — the Next.js serverless function only issues a URL and records the key. This is critical for a photo-heavy social app where serverless function execution time and memory are cost-constrained.

---

## Common Pitfalls

### Pitfall 1: `onConflictDoUpdate` on Nullable `place_id`

**What goes wrong:** `db.insert(restaurants).onConflictDoUpdate({ target: restaurants.placeId, ... })` — Drizzle maps this to `ON CONFLICT (place_id) DO UPDATE`. But `place_id` is nullable (manual entries have `place_id = null`). PostgreSQL does not enforce uniqueness on NULL values, so this conflict target is invalid and the query throws a runtime error.

**Why it happens:** The schema has no unique index on `place_id`. Multiple manual entries can all have `place_id = null` — they are not duplicates of each other.

**How to avoid:** Add a partial unique index on `place_id WHERE place_id IS NOT NULL` in the Drizzle schema:

```typescript
// In restaurants pgTable second argument:
restaurantsPlaceIdIdx: uniqueIndex('restaurants_place_id_idx')
  .on(table.placeId)
  .where(sql`place_id IS NOT NULL`)
```

For manual entries, do a plain `insert()` without `onConflictDoUpdate`.

**Warning signs:** Runtime error "there is no unique or exclusion constraint matching the ON CONFLICT specification" in the restaurant search route.

---

### Pitfall 2: `date` Column Returns String, Not Date Object

**What goes wrong:** The `meal_date` column is type `date` in PostgreSQL. Drizzle returns this as a string (`'2026-04-29'`), not a JS `Date`. Client code that passes this to `new Date()` works but may produce off-by-one timezone errors (midnight UTC vs. local midnight).

**Why it happens:** PostgreSQL `DATE` type has no time component. Drizzle correctly returns it as a string to avoid timezone ambiguity.

**How to avoid:** Keep `meal_date` as a string throughout the API response. On the client, display using string parsing (`mealDate.split('-')`) or pass directly to `<input type="date" value={mealDate}>`. Never coerce to `new Date()` unless converting to local display string.

**Warning signs:** Reviews showing the wrong date for users in timezones west of UTC.

---

### Pitfall 3: Fan-out Happens in the Same DB Transaction as Review Insert

**What goes wrong:** The review insert and fan-out `INSERT INTO feed_items` are in a single call sequence. If a user has many followers and the fan-out loop is slow (many rows), the total API response time becomes unacceptable. For Phase 2 with zero followers in early testing this is invisible — it surfaces at real usage.

**Why it happens:** Synchronous fan-out is the simplest implementation.

**How to avoid:** For Phase 2 (no real social graph yet), synchronous fan-out is acceptable — the follower count for any user is zero or near-zero. Design the code so the fan-out block can be extracted to a background job (Vercel Background Functions, or a queue) in Phase 3 when real followers exist. Structure it as an isolated `fanOutToFollowers(reviewId, userId)` function, not inline code.

**Warning signs:** Review POST response time exceeding 500ms when any user has > 50 followers.

---

### Pitfall 4: Google Places API Key in Client Bundle

**What goes wrong:** The autocomplete field calls the Places API directly from the browser with `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`. The key is visible in source code, gets scraped, and the project accrues unexpected API bills.

**Why it happens:** It's simpler to call the API client-side. `NEXT_PUBLIC_` variables are intentionally exposed.

**How to avoid:** All Places API calls go through `GET /api/v1/restaurants/search` (server-side, key in `process.env.GOOGLE_PLACES_API_KEY` — no `NEXT_PUBLIC_` prefix). Set API key restrictions in Google Cloud Console (restrict to server IP or disable browser key).

**Warning signs:** `GOOGLE_PLACES_API_KEY` (or any variant) appearing in any `NEXT_PUBLIC_` variable or any client component file.

---

### Pitfall 5: Edit Flow Replaces Tags Incorrectly

**What goes wrong:** `PATCH /api/v1/reviews/:id` updates the review row but leaves old `review_tags` rows. The tag list on the edited review grows with each edit, showing both old and new tags.

**Why it happens:** Tags are stored in a separate table. Updating the review row doesn't cascade to tags.

**How to avoid:** In the PATCH handler, always delete all existing tags for the review and re-insert the new set atomically:

```typescript
// Within PATCH handler:
await db.delete(reviewTags).where(eq(reviewTags.reviewId, id))
if (input.tags?.length) {
  await db.insert(reviewTags).values(
    input.tags.map(label => ({ reviewId: id, label: label.toLowerCase().trim() }))
  )
}
```

**Warning signs:** Duplicate or stale tags appearing on edited reviews.

---

### Pitfall 6: Soft-Delete Not Filtering in Review List and Feed

**What goes wrong:** `DELETE /api/v1/reviews/:id` sets `deleted_at` but the review list (`GET /api/v1/reviews`) and feed queries forget to filter `WHERE deleted_at IS NULL`. Deleted reviews appear to the user.

**Why it happens:** Every new query on `reviews` must explicitly add the soft-delete filter. It is not automatic.

**How to avoid:** In every Drizzle `select()` on the `reviews` table, add `.where(isNull(reviews.deletedAt))`. When the review is deleted, also delete its `feed_items` rows (hard delete from feed_items is fine — these are denormalized cache rows, not source of truth).

---

### Pitfall 7: Next.js Image `remotePatterns` Not Configured for R2

**What goes wrong:** Photos uploaded to R2 render as broken images in Next.js because the `<Image>` component blocks unconfigured remote domains.

**Why it happens:** Next.js Image requires `remotePatterns` in `next.config.ts` for any remote URL.

**How to avoid:** Add to `apps/web/next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',        // R2 public bucket URL pattern
        port: '',
        pathname: '/**',
      },
    ],
  },
}
```

Replace `*.r2.dev` with the specific custom CDN hostname if a Cloudflare custom domain is configured for the bucket.

---

## Code Examples

### Verified Pattern: Existing Route Handler Auth

```typescript
// Source: apps/web/app/api/v1/users/route.ts (existing, Phase 1)
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ...
  await db.insert(users).values({...}).onConflictDoUpdate({...})
  return NextResponse.json({ success: true }, { status: 201 })
}
```

### Verified Pattern: Drizzle Inline Index (required by drizzle-kit 0.31.10)

```typescript
// Source: apps/web/lib/schema.ts (existing, Phase 1 confirmed pattern)
// MUST use inline callback syntax — standalone index() exports break drizzle-kit

export const reviews = pgTable('reviews', {
  // ...columns...
}, (table) => ({
  reviewsUserIdx: index('reviews_user_idx').on(table.userId),
  // Add any new indices here, inline
}))
```

### Verified Pattern: Zod v4 Import

```typescript
// Source: packages/shared/src/schemas/index.ts (existing, Phase 1)
import { z } from 'zod/v4'   // NOT from 'zod' — zod v4 subpath required
```

### Verified Pattern: Next.js 16 `headers()` is Async

```typescript
// Source: apps/web/app/api/v1/webhooks/clerk/route.ts (existing, Phase 1)
import { headers } from 'next/headers'
const headerPayload = await headers()   // MUST await
```

### Verified Pattern: Half-Star Rating Input

A half-star rating (0.5–5.0 in 0.5 increments) does not require a third-party library. A styled range input is sufficient and accessible:

```tsx
// Star rating — controlled component approach
// Can also be implemented as 5 clickable star SVGs with half-star zones
<input
  type="range"
  min={0.5}
  max={5}
  step={0.5}
  value={rating}
  onChange={e => setRating(parseFloat(e.target.value))}
  aria-label="Rating"
/>
<span>{rating} / 5</span>
```

Alternatively, render 5 star SVGs, each split into left-half (0.5 increment) and right-half (whole increment) click zones, for a Letterboxd-style visual. Both approaches work; the range input is simpler. This is Claude's discretion.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js Route Handler `params` is synchronous | `params` is a `Promise` — must `await params` | Next.js 15 → 16 | Every dynamic route handler must `await params` |
| `headers()` is synchronous | `headers()` is async — must `await headers()` | Next.js 15+ | Already handled in webhook route; new routes must follow same pattern |
| Google Places Legacy API (`maps.googleapis.com/maps/api/place`) | Google Places (New) API (`places.googleapis.com/v1/places`) | 2024 | Different base URL, field masks via `X-Goog-FieldMask` header, `searchText` replaces `textsearch` |
| Zod v3 import: `import { z } from 'zod'` | Zod v4 import: `import { z } from 'zod/v4'` | Zod 4.0 (project uses zod 4.3.6) | Must use `zod/v4` subpath — project has zod 4.3.6 installed |

**Deprecated/outdated:**
- Google Places Legacy API: The legacy `maps.googleapis.com/maps/api/place/textsearch` endpoint is deprecated as of 2024. Use the New Places API at `places.googleapis.com/v1/places:searchText`.
- `drizzle-orm` standalone `index()` export: incompatible with drizzle-kit 0.31.10's bundled pg-core — use inline table callback pattern exclusively.

---

## Open Questions

1. **Cloudflare R2 public bucket URL format**
   - What we know: R2 buckets can be accessed via `{account}.r2.dev` or a custom domain
   - What's unclear: Whether the project has an R2 bucket created and what its public URL is
   - Recommendation: Wave 0 plan should include an environment variable setup task (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`). Plan tasks should not assume these exist.

2. **Google Places API key availability**
   - What we know: The project requires `GOOGLE_PLACES_API_KEY` server-side
   - What's unclear: Whether the key is already provisioned in `.env.local`
   - Recommendation: Make the restaurant search endpoint gracefully return `[]` (not 500) when the key is missing, so the form remains functional with manual entry fallback.

3. **Mobile composer scope in Phase 2**
   - What we know: The platform goal is web + mobile; Phase 1 built both
   - What's unclear: Whether the mobile composer is in scope for Phase 2 or deferred to a later phase
   - Recommendation: Include a Wave 4 (mobile) that mirrors the web composer. The API is shared; only the UI layer differs. If the project timeline is tight, mobile can be a separate sub-plan.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All API routes | ✓ | Detected via monorepo | — |
| pnpm | Package management | ✓ | Used in Phase 1 | — |
| drizzle-kit | `meal_date` migration | ✓ | 0.31.10 (Phase 1) | — |
| @aws-sdk/client-s3 | R2 presigned URLs | ✗ (not installed) | — | Must install: `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |
| @aws-sdk/s3-request-presigner | R2 presigned URLs | ✗ (not installed) | — | Must install |
| expo-image-picker | Mobile photo selection | ✗ (not installed) | — | `npx expo install expo-image-picker` |
| R2 bucket (external) | Photo upload | Unknown | — | Gate photo upload behind env var check; return 503 with message if unconfigured |
| Google Places API key (external) | Restaurant search | Unknown | — | Return `[]` from search endpoint; surface "add manually" option immediately |

**Missing dependencies with no fallback:**
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` must be installed before any photo upload work

**Missing dependencies with fallback:**
- R2 bucket not yet configured → photo upload returns 503; form still works for text-only reviews
- Google Places API key not yet configured → search returns `[]`; manual entry path is always available (D-05)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVW-01 | `reviewSchema` rejects ratings outside 0.5–5.0 and non-0.5 increments | unit | `pnpm --filter web test:unit -- --grep "REVW-01"` | ❌ Wave 0 |
| REVW-02 | `reviewSchema` accepts optional note up to 2000 chars | unit | `pnpm --filter web test:unit -- --grep "REVW-02"` | ❌ Wave 0 |
| REVW-03 | `POST /api/v1/uploads` returns presigned URL with valid key | smoke (env-gated) | manual — requires R2 credentials | — |
| REVW-04 | Tags are lowercased + trimmed on write | unit | `pnpm --filter web test:unit -- --grep "REVW-04"` | ❌ Wave 0 |
| REVW-05 | `reviewSchema` accepts `mealDate` in `YYYY-MM-DD` format; rejects other formats | unit | `pnpm --filter web test:unit -- --grep "REVW-05"` | ❌ Wave 0 |
| REVW-06 | PATCH handler returns 403 when caller is not review owner | unit | `pnpm --filter web test:unit -- --grep "REVW-06"` | ❌ Wave 0 |
| REVW-07 | DELETE sets `deleted_at`; review absent from subsequent GET | unit | `pnpm --filter web test:unit -- --grep "REVW-07"` | ❌ Wave 0 |
| MEAL-01 | Restaurant search returns empty array when `q` < 2 chars | unit | `pnpm --filter web test:unit -- --grep "MEAL-01"` | ❌ Wave 0 |
| MEAL-02 | Manual entry creates `restaurants` row with `source: 'manual'` and `placeId: null` | unit | `pnpm --filter web test:unit -- --grep "MEAL-02"` | ❌ Wave 0 |
| MEAL-03 | Review with `mealType: 'homemade'` persists with `restaurantId: null` | unit | `pnpm --filter web test:unit -- --grep "MEAL-03"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit`
- **Per wave merge:** `pnpm --filter web test:unit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/reviews.test.ts` — covers REVW-01, REVW-02, REVW-04, REVW-05, REVW-06, REVW-07
- [ ] `apps/web/__tests__/restaurants.test.ts` — covers MEAL-01, MEAL-02, MEAL-03
- [ ] `reviewSchema` Zod schema added to `packages/shared/src/schemas/index.ts` before tests can import it

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are binding on all planner and implementer work in this phase:

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Next.js Route Handlers as shared API (no separate backend) | All review, restaurant, and upload endpoints live in `apps/web/app/api/v1/` |
| Zod for request/response validation | `reviewSchema` added to `@lunchboxd/shared`; used in both web and mobile |
| Use Server Components for detail/profile pages; Client Components for composer and feed | Review composer is `'use client'`; review list page can be a Server Component with Suspense |
| Cloudflare R2 for photo storage (not AWS S3) | R2 presigned URL flow using S3-compatible SDK; zero egress |
| Google Places API (New) as restaurant search | New API endpoint (`places.googleapis.com/v1`); proxied through server; never called from client |
| `@aws-sdk/client-s3` pattern acceptable (S3-compatible with R2) | AWS SDK used for R2 — this is explicitly standard practice |
| TanStack Query v5 for client data fetching | All client-side data fetching (autocomplete results, review list) via `useQuery` / `useMutation` |
| drizzle-kit 0.31.10: inline index callback pattern only | No standalone `index()` exports in `schema.ts`; new indices go inside `pgTable` second argument |
| Zod v4 subpath import: `import { z } from 'zod/v4'` | All new Zod schemas must use this import |
| Next.js 16: `params` is a Promise; `headers()` is async | Every dynamic route handler must `await params`; `await headers()` in any route using it |
| `NEXT_PUBLIC_` prefix exposes variables to client — never use for API keys | `GOOGLE_PLACES_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` must NOT have `NEXT_PUBLIC_` prefix |
| Vitest for testing; nyquist_validation enabled | Wave 0 test stubs required for all 10 requirements before implementation |
| apps/web/AGENTS.md (via CLAUDE.md @): "Read node_modules/next/dist/docs/ before writing any code" | Planner and implementer must read relevant Next.js 16 docs before any Route Handler or component work |

---

## Sources

### Primary (HIGH confidence)

- `apps/web/node_modules/next/dist/docs/` — Next.js 16.2.4 installed docs (route.md, forms.md, images.md, headers.md) — verified locally
- `apps/web/lib/schema.ts` — Confirmed Phase 1 schema: `reviews`, `restaurants`, `review_tags`, `feed_items` tables; `reviews.rating` is `numeric(2,1)`; `reviews.deletedAt` soft-delete present; `reviews.mealDate` ABSENT (confirms D-10)
- `apps/web/app/api/v1/webhooks/clerk/route.ts` — Confirmed patterns: `await auth()`, `await headers()`, `db.insert().onConflictDoUpdate()`, `export const runtime = 'nodejs'`
- `apps/web/app/api/v1/users/route.ts` — Confirmed Route Handler pattern, `auth()` usage, Drizzle insert
- `.planning/phases/01-auth-foundation/01-01-SUMMARY.md` — Confirmed versions: drizzle-orm 0.45.2, drizzle-kit 0.31.10, zod 4.3.6, @tanstack/react-query 5.100.5, expo 55.0.17
- `.planning/research/PITFALLS.md` — Photo upload decoupling, API key exposure, soft-delete gaps, restaurant data model
- `.planning/research/STACK.md` — R2 presigned URL flow, Google Places session token strategy, restaurant local cache pattern
- `.planning/research/ARCHITECTURE.md` — Fan-out-on-write feed_items pattern, review data flow

### Secondary (MEDIUM confidence)

- `npm view @aws-sdk/client-s3 version` → 3.1038.0 (verified 2026-04-29)
- `npm view @aws-sdk/s3-request-presigner version` → 3.1038.0 (verified 2026-04-29)
- `npm view expo-image-picker version` → 55.0.19 (verified 2026-04-29)
- `npm view @tanstack/react-query version` → 5.100.6 (verified 2026-04-29)
- Google Places (New) API endpoint pattern — training data (2025), consistent with official docs structure

### Tertiary (LOW confidence)

- Google Places `searchText` field mask values (`places.id`, `places.displayName`, etc.) — training data; verify against `developers.google.com/maps/documentation/places/web-service/text-search` before implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries from Phase 1 confirmed with exact versions; new packages version-checked against npm registry
- Architecture patterns: HIGH — Route Handler patterns extracted directly from existing Phase 1 code and Next.js 16 installed docs
- Drizzle migration: HIGH — `meal_date` absence confirmed by reading `schema.ts`; `date` type return behavior is well-documented
- R2 presigned URL flow: MEDIUM — AWS SDK pattern is standard and S3-compatible; R2-specific endpoint format (`{account}.r2.cloudflarestorage.com`) from training data
- Google Places (New) API: MEDIUM — endpoint URL and field mask pattern from training data; verify field names before coding
- Pitfalls: HIGH — extracted from existing project PITFALLS.md research and confirmed against schema

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable stack; Google Places API and R2 pricing should be re-verified before launch)
