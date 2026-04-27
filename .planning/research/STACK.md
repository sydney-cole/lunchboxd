# Stack Research — Lunchboxd

**Project:** Lunchboxd — social food review app (web + iOS/Android)
**Researched:** 2026-04-27
**Research mode:** Ecosystem

---

## Backend API

**Recommendation: Next.js 16 Route Handlers as the shared API layer**

Next.js 16.2.4 (latest stable as of April 2026, verified via nextjs.org/docs) Route Handlers are the recommended approach for a shared JSON API that serves both the web frontend and the React Native mobile app. They support all HTTP methods (GET, POST, PUT, PATCH, DELETE), run on Node.js by default, support streaming, handle CORS headers manually, and are deployed as serverless functions on Vercel or any Node.js host.

This avoids introducing a separate backend service. The mobile app consumes the same `/api/*` endpoints as the web client would use for client-side fetching. There is no lock-in to Next.js's SSR model — the API routes are standard HTTP.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js Route Handlers | 16.2.4 | REST API for web + mobile | Eliminates separate backend; full HTTP method support; serverless-ready; well-documented |
| Zod | ^3.x | Request/response validation | Next.js docs explicitly recommend Zod for schema validation in Route Handlers; type-safe; works in Edge and Node runtimes |
| TypeScript | ^5.x | Language | End-to-end type safety; shared types between API and frontend |

**Why not a separate backend (Hono, Fastify, Express)?**

A separate Node.js API service is additional infrastructure to manage, deploy, and keep in sync. For a greenfield social app at MVP scale, Next.js Route Handlers collocated with the web frontend deliver the same API surface with far less operational overhead. Revisit at scale if the API needs to move to a dedicated service.

**Why not tRPC?**

tRPC is excellent when both client and server are TypeScript. However, React Native's tRPC client requires additional adapter setup, and the mobile client cannot easily use Server Actions. Plain REST via Route Handlers is universally consumable by both web and mobile without an extra abstraction layer.

---

## Web Frontend

**Recommendation: Next.js 16 App Router with React 19**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js (App Router) | 16.2.4 | Web application framework | Server Components reduce client bundle size; image optimization built-in; collocated API; Turbopack default (stable) for fast dev |
| React | 19.2 | UI library | Required by Next.js 16; View Transitions support; useActionState for forms |
| TanStack Query | ^5.x | Client-side data fetching / cache | Industry standard for async state; works in React Native too so knowledge transfers; handles feed pagination, optimistic updates |
| Tailwind CSS | ^4.x | Styling | Utility-first; no context-switching; widely adopted; works well with shadcn/ui |
| shadcn/ui | latest | Component library | Not a package — copies components locally; built on Radix UI primitives; accessible; pairs with Tailwind |

**Notes:**
- Use Server Components for profile pages, review detail pages (SEO + performance)
- Use Client Components for the feed (real-time feel, infinite scroll) and review composer
- Next.js Image component handles remote S3/Cloudflare URLs via `remotePatterns` config (verified in official docs)

---

## Mobile (iOS/Android)

**Recommendation: Expo SDK with Expo Router**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Expo SDK | ~53 (verify at start — latest stable as of mid-2025; newer release may be current in April 2026) | Cross-platform iOS + Android | Managed workflow drastically reduces native toolchain friction; OTA updates; EAS Build for CI/CD |
| Expo Router | v4 | File-based navigation | Same mental model as Next.js App Router; deep linking built-in; typed routes |
| React Native | bundled with Expo | Native UI layer | Same React knowledge as web; Expo manages the native dependency surface |
| NativeWind | ^4.x | Styling | Tailwind utility classes in React Native; shared design vocabulary between web and mobile |
| TanStack Query | ^5.x | Data fetching | Same library as web; share query key conventions and types |
| Expo SecureStore | included in SDK | Token storage | Secure credential storage on device (replaces localStorage for auth tokens) |
| expo-image | included in SDK | Image display | Faster than React Native's built-in Image; supports progressive loading and caching |

**Managed vs bare workflow:** Use Expo's managed workflow. The project has no custom native modules listed in requirements. Bare workflow is only warranted when you need to write custom native code — don't pay that cost upfront.

**CONFIDENCE NOTE on Expo version:** Expo SDK 53 was the current release as of August 2025 (training data). A newer SDK may have shipped by April 2026. Verify `expo.dev/changelog` before pinning the version in package.json.

---

## Database

**Recommendation: PostgreSQL via Neon (serverless) + Drizzle ORM**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 | Primary database | Relational model suits the social graph (follows, reviews, users, restaurants); JSONB for flexible tag/mood storage |
| Neon | latest | Managed serverless PostgreSQL | Branches per environment (dev/staging/prod); scales to zero; works well with Vercel serverless; connection pooling built-in |
| Drizzle ORM | ^0.x (currently ~0.30+ as of Aug 2025; verify) | ORM / query builder | TypeScript-first; schema-as-code; lightweight vs Prisma (no Rust binary); migrations via `drizzle-kit`; SQL-like syntax avoids magic |

**Schema considerations:**
- `users`, `follows`, `reviews`, `restaurants`, `restaurant_manual_entries`, `review_tags` tables
- The follows table needs two indices: `(follower_id)` and `(following_id)` — the feed query is `WHERE following_id IN (SELECT following_id FROM follows WHERE follower_id = $me)`
- JSONB column for `mood_tags` gives schema flexibility without a join table at MVP

**Why not Prisma?** Prisma requires a Rust-based query engine binary that adds cold-start latency in serverless environments. Drizzle is a pure-JS ORM with no binary dependency, which makes it the better choice for Vercel/Neon serverless. Prisma is fine for always-on servers — not the right fit here.

**Why not Supabase?** Supabase is a strong alternative (PostgreSQL + storage + auth). The recommendation here separates concerns: Neon for database, Cloudflare R2 for storage, Clerk for auth. Supabase bundles everything but creates coupling — if one service has issues, everything is affected. The unbundled stack is also easier to migrate incrementally.

---

## File/Media Storage

**Recommendation: Cloudflare R2 + Images**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cloudflare R2 | — | Meal photo storage | S3-compatible API (no SDK change required); zero egress fees (critical for a photo-heavy app); global CDN via Cloudflare |
| Cloudflare Images | — | Image transformation | On-the-fly resizing, WebP conversion, and CDN delivery for user photos; avoids running a separate image processing service |

**Upload flow:** Client uploads directly to R2 using a presigned URL generated by the API (Route Handler). This keeps large file transfers off the Next.js serverless function and avoids timeout issues. The API stores the R2 object key in PostgreSQL, not the full URL (so CDN domain can change without a data migration).

**Why not AWS S3?** S3 charges per-GB egress. A social app where every feed item has a photo will accumulate significant egress costs. R2 has identical API surface with zero egress fees.

**Why not Supabase Storage?** See above. Also, R2 + Cloudflare Images gives better CDN performance globally.

---

## Authentication

**Recommendation: Clerk**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @clerk/nextjs | ^6.x (verify current) | Auth for web | Listed explicitly in Next.js 16 official auth docs; handles session management, social logins, MFA out of the box |
| @clerk/clerk-expo | ^2.x (verify current) | Auth for React Native | First-party Expo SDK; uses Expo SecureStore for token persistence; same user objects as web |

**Why Clerk over Auth.js (NextAuth)?** Auth.js requires implementing and hosting the session store, OAuth callback handling, and adapter configuration. Clerk provides the same features as a managed service. The Next.js docs list both — Clerk is the right choice when you need mobile auth too, because it has a first-party Expo package. Auth.js has no React Native package.

**Why Clerk over rolling your own (jose + bcrypt)?** The Next.js auth docs show the DIY approach for educational purposes but explicitly recommend using a library. A social app with OAuth, password reset, and email verification is 2-3 weeks of auth work. Clerk eliminates that and handles security updates.

**Social logins to enable at launch:** Google, Apple (required for iOS App Store if any social login is present).

---

## Restaurant Data

**Recommendation: Google Places API (New) with manual fallback**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Google Places API (New) | v1 | Restaurant search and lookup | Largest dataset globally; `nearbySearch` and `searchText` endpoints; returns name, address, coordinates, photos; well-maintained SDKs |
| Manual entry fallback | — | User-entered restaurants | Stored as `restaurant_manual_entries` in PostgreSQL; users should never be blocked by API coverage gaps |

**API strategy:**
1. User types restaurant name → autocomplete via `places.autocomplete` endpoint
2. User selects from suggestions → fetch place details via `places.get` (place ID)
3. Store the Google Place ID in PostgreSQL alongside the restaurant name/address
4. If no match → user submits name, city, and cuisine manually; stored as unverified entry

**Why not Yelp Fusion?** Yelp's dataset is strong in the US but weaker internationally. Google Places has better global coverage. The PROJECT.md lists "Google Places or Yelp" as options — default to Google Places, add Yelp as a secondary source only if coverage gaps emerge.

**Cost:** Google Places API charges per request. For MVP, autocomplete is the most common call. Use session tokens to batch autocomplete + place details into one billing session, which significantly reduces cost.

**CONFIDENCE NOTE:** Google Places API pricing changes frequently. Verify the current pricing tier at developers.google.com/maps/billing before launch.

---

## What NOT to Use

| Technology | Category | Reason |
|------------|----------|--------|
| GraphQL / Apollo | API layer | Significant added complexity for a team starting greenfield. REST Route Handlers are sufficient. Add GraphQL when N+1 problems appear and you have the team to manage the schema. |
| Prisma | ORM | Rust binary adds cold-start latency in Vercel serverless. Use Drizzle. |
| AWS S3 | Storage | Egress fees are prohibitive for a photo-heavy social app. Use Cloudflare R2. |
| Supabase (all-in-one) | BaaS | Bundles too many concerns. Fine for solo projects, but creates coupling between auth, database, and storage that makes individual scaling/migration hard. |
| Auth.js (NextAuth) | Auth | No first-party React Native / Expo package. Would require a separate auth solution for mobile. |
| Firebase / Firestore | Database | Document model is awkward for relational social graphs (follows, feeds). PostgreSQL's relational model is the better fit. Firestore's real-time listeners are not needed for a feed that can use polling or pull-to-refresh. |
| Expo Go | Mobile dev tool | Expo Go is only for prototyping. Use a development build via EAS for any native module (Expo SecureStore, expo-image). Create the development build in Phase 1. |
| Pages Router (Next.js) | Web routing | The Pages Router is in maintenance mode. All new Next.js projects should use the App Router. |
| Redux | State management | Overkill for this app's state complexity. TanStack Query handles server state. React Context or Zustand handle the small amount of client state (auth context, compose modal state). |
| React Navigation (standalone) | Mobile navigation | Expo Router supersedes React Navigation for Expo projects. It provides file-based routing with deep linking out of the box. |

---

## Confidence Levels

| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| Next.js 16.2.4 as web framework | HIGH | Verified: nextjs.org/docs (April 2026) | Version and features confirmed directly |
| Next.js Route Handlers as API | HIGH | Verified: nextjs.org/docs route-handlers (April 2026) | Full HTTP method support confirmed; CORS handling confirmed |
| Clerk listed as auth option in Next.js docs | HIGH | Verified: nextjs.org/docs/authentication (April 2026) | Explicitly listed |
| Zod for validation in Next.js | HIGH | Verified: nextjs.org/docs/authentication (April 2026) | Explicitly used in official examples |
| Drizzle ORM + PostgreSQL | MEDIUM | Training data (Aug 2025); unable to verify version via web in this session | Pattern is well-established; verify current drizzle-orm version before installing |
| Expo SDK version | MEDIUM | Training data (Aug 2025) — SDK 53 was current | SDK release cadence is ~2/year; a newer version may be stable by April 2026. Verify at expo.dev/changelog |
| Cloudflare R2 for storage | MEDIUM | Training data (Aug 2025) | R2 + zero egress is a well-documented fact; pricing model unlikely to change but verify |
| NativeWind v4 for React Native styling | MEDIUM | Training data (Aug 2025) | v4 stable as of mid-2025; verify current version |
| Google Places API (New) | MEDIUM | Training data (Aug 2025) | New API (v1) was current as of 2024; verify pricing and quota before launch |
| @clerk/clerk-expo version | LOW | Training data only; WebFetch blocked in this session | Confirm current package version and Expo SDK compatibility before installing |
| TanStack Query v5 | MEDIUM | Training data (Aug 2025) | v5 stable; widely adopted; low risk of major change |

---

## Installation Sketch

```bash
# Web (Next.js app)
npx create-next-app@latest web --typescript --tailwind --app

# Install web dependencies
npm install drizzle-orm @neondatabase/serverless zod @clerk/nextjs @tanstack/react-query @tanstack/react-query-devtools
npm install -D drizzle-kit

# Mobile (Expo app)
npx create-expo-app@latest mobile --template tabs

# Install mobile dependencies
npx expo install expo-secure-store expo-image @clerk/clerk-expo @tanstack/react-query nativewind react-native-reanimated
```

Note: Pin versions after verifying current stable releases at the start of each phase.

---

## Sources

- Next.js 16.2.4 documentation (verified): https://nextjs.org/docs
- Next.js Route Handlers reference (verified, April 2026): https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js Authentication guide (verified, April 2026): https://nextjs.org/docs/app/building-your-application/authentication
- Next.js Image Optimization (verified, April 2026): https://nextjs.org/docs/app/getting-started/images
- Expo documentation: https://docs.expo.dev (access blocked in this session — verify version at expo.dev/changelog)
- Drizzle ORM: https://orm.drizzle.team (access blocked in this session — verify version)
- Google Places API: https://developers.google.com/maps/documentation/places
- Cloudflare R2: https://developers.cloudflare.com/r2
