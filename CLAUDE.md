<!-- GSD:project-start source:PROJECT.md -->
## Project

**Lunchboxd**

Lunchboxd is a Letterboxd-inspired food review app where users log, rate, and share meals — whether eaten at a restaurant or made at home. Users build a profile, follow friends, and see a feed of what their network is eating.

**Core Value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

### Constraints

- **Platform**: Web + mobile (iOS/Android) — requires a shared backend API
- **Restaurant data**: Google Places or Yelp API for restaurant search; manual fallback for unmapped places
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Backend API
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js Route Handlers | 16.2.4 | REST API for web + mobile | Eliminates separate backend; full HTTP method support; serverless-ready; well-documented |
| Zod | ^4.x | Request/response validation | Next.js docs explicitly recommend Zod for schema validation in Route Handlers; type-safe; works in Edge and Node runtimes |
| TypeScript | ^5.x | Language | End-to-end type safety; shared types between API and frontend |
## Web Frontend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js (App Router) | 16.2.4 | Web application framework | Server Components reduce client bundle size; image optimization built-in; collocated API; Turbopack default (stable) for fast dev |
| React | 19.2 | UI library | Required by Next.js 16; View Transitions support; useActionState for forms |
| TanStack Query | ^5.x | Client-side data fetching / cache | Industry standard for async state; works in React Native too so knowledge transfers; handles feed pagination, optimistic updates |
| Tailwind CSS | ^4.x | Styling | Utility-first; no context-switching; widely adopted; works well with shadcn/ui |
| shadcn/ui | latest | Component library | Not a package — copies components locally; built on Radix UI primitives; accessible; pairs with Tailwind |
- Use Server Components for profile pages, review detail pages (SEO + performance)
- Use Client Components for the feed (real-time feel, infinite scroll) and review composer
- Next.js Image component handles remote S3/Cloudflare URLs via `remotePatterns` config (verified in official docs)
## Mobile (iOS/Android)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Expo SDK | ~53 (verify at start — latest stable as of mid-2025; newer release may be current in April 2026) | Cross-platform iOS + Android | Managed workflow drastically reduces native toolchain friction; OTA updates; EAS Build for CI/CD |
| Expo Router | v4 | File-based navigation | Same mental model as Next.js App Router; deep linking built-in; typed routes |
| React Native | bundled with Expo | Native UI layer | Same React knowledge as web; Expo manages the native dependency surface |
| NativeWind | ^4.x | Styling | Tailwind utility classes in React Native; shared design vocabulary between web and mobile |
| TanStack Query | ^5.x | Data fetching | Same library as web; share query key conventions and types |
| Expo SecureStore | included in SDK | Token storage | Secure credential storage on device (replaces localStorage for auth tokens) |
| expo-image | included in SDK | Image display | Faster than React Native's built-in Image; supports progressive loading and caching |
## Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 | Primary database | Relational model suits the social graph (follows, reviews, users, restaurants); JSONB for flexible tag/mood storage |
| Neon | latest | Managed serverless PostgreSQL | Branches per environment (dev/staging/prod); scales to zero; works well with Vercel serverless; connection pooling built-in |
| Drizzle ORM | ^0.x (currently ~0.30+ as of Aug 2025; verify) | ORM / query builder | TypeScript-first; schema-as-code; lightweight vs Prisma (no Rust binary); migrations via `drizzle-kit`; SQL-like syntax avoids magic |
- `users`, `follows`, `reviews`, `restaurants`, `restaurant_manual_entries`, `review_tags` tables
- The follows table needs two indices: `(follower_id)` and `(following_id)` — the feed query is `WHERE following_id IN (SELECT following_id FROM follows WHERE follower_id = $me)`
- JSONB column for `mood_tags` gives schema flexibility without a join table at MVP
## File/Media Storage
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cloudflare R2 | — | Meal photo storage | S3-compatible API (no SDK change required); zero egress fees (critical for a photo-heavy app); global CDN via Cloudflare |
| Cloudflare Images | — | Image transformation | On-the-fly resizing, WebP conversion, and CDN delivery for user photos; avoids running a separate image processing service |
## Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @clerk/nextjs | ^6.x (verify current) | Auth for web | Listed explicitly in Next.js 16 official auth docs; handles session management, social logins, MFA out of the box |
| @clerk/clerk-expo | ^2.x (verify current) | Auth for React Native | First-party Expo SDK; uses Expo SecureStore for token persistence; same user objects as web |
## Restaurant Data
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Google Places API (New) | v1 | Restaurant search and lookup | Largest dataset globally; `nearbySearch` and `searchText` endpoints; returns name, address, coordinates, photos; well-maintained SDKs |
| Manual entry fallback | — | User-entered restaurants | Stored as `restaurant_manual_entries` in PostgreSQL; users should never be blocked by API coverage gaps |
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
## Installation Sketch
# Web (Next.js app)
# Install web dependencies
# Mobile (Expo app)
# Install mobile dependencies
## Sources
- Next.js 16.2.4 documentation (verified): https://nextjs.org/docs
- Next.js Route Handlers reference (verified, April 2026): https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js Authentication guide (verified, April 2026): https://nextjs.org/docs/app/building-your-application/authentication
- Next.js Image Optimization (verified, April 2026): https://nextjs.org/docs/app/getting-started/images
- Expo documentation: https://docs.expo.dev (access blocked in this session — verify version at expo.dev/changelog)
- Drizzle ORM: https://orm.drizzle.team (access blocked in this session — verify version)
- Google Places API: https://developers.google.com/maps/documentation/places
- Cloudflare R2: https://developers.cloudflare.com/r2
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->




<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
