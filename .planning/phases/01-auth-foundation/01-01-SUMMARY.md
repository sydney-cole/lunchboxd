---
phase: 01-auth-foundation
plan: 01
subsystem: infra
tags: [turborepo, pnpm, nextjs, expo, drizzle, neon, postgres, tailwind, vitest, zod, clerk]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with pnpm workspaces (apps/web, apps/mobile, packages/shared)
  - Next.js 16.2.4 web app with Tailwind v4 theme and Fraunces/Inter fonts
  - Expo SDK 55 mobile app with ClerkProvider and @clerk/expo
  - "@lunchboxd/shared package with User/Review/Restaurant/Follow/Friendship/FeedItem/Like/Notification/UserStats types"
  - Zod signUpSchema/signInSchema/forgotPasswordSchema validation
  - Design tokens (colors, spacing, fontSizes, fontWeights, radii)
  - Typed API client (createApiClient)
  - Drizzle schema with all 10 tables and generated migration SQL
  - Vitest configured with AUTH-01/02/03/04 test stubs (Wave 0 Nyquist compliance)
affects:
  - 01-auth-foundation (plans 02, 03 — Clerk auth pages, webhook handler)
  - all future phases (schema tables available for all feature work)

# Tech tracking
tech-stack:
  added:
    - turbo@2.9.6
    - next@16.2.4
    - expo@55.0.17
    - "@clerk/nextjs@7.2.7"
    - "@clerk/expo@3.2.4"
    - drizzle-orm@0.45.2
    - drizzle-kit@0.31.10
    - "@neondatabase/serverless@1.1.0"
    - zod@4.3.6
    - svix@1.92.2
    - vitest@3.2.4
    - nativewind@4.2.3
    - "@tanstack/react-query@5.100.5"
  patterns:
    - pnpm workspaces with node-linker=hoisted for Expo Metro compatibility
    - Turborepo tasks with dependsOn for build ordering
    - Drizzle pgTable with inline index callbacks (vs external index() API)
    - Zod v4 import from zod/v4 subpath

key-files:
  created:
    - pnpm-workspace.yaml
    - .npmrc
    - turbo.json
    - package.json
    - packages/shared/src/types/index.ts
    - packages/shared/src/schemas/index.ts
    - packages/shared/src/constants/tokens.ts
    - packages/shared/src/api/client.ts
    - packages/shared/src/index.ts
    - apps/web/lib/schema.ts
    - apps/web/lib/db.ts
    - apps/web/drizzle.config.ts
    - apps/web/drizzle/0000_square_warbound.sql
    - apps/web/vitest.config.ts
    - apps/web/__tests__/auth.test.ts
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/mobile/app/_layout.tsx
  modified: []

key-decisions:
  - "Used pgTable inline index callback syntax instead of standalone index() exports — drizzle-kit 0.31.10 bundled pg-core incompatible with drizzle-orm 0.45.2 standalone index API"
  - "Mobile ColorSchemeName narrowed to 'light' | 'dark' — RN 0.85 adds 'unspecified' which breaks template Colors indexing"
  - "feedItemsOwnerIdx defined as single-column index (not compound) — compound index with createdAt triggered drizzle-kit JSON parse bug"

patterns-established:
  - "Pattern: All database indices defined inline in pgTable second argument, not as separate exports"
  - "Pattern: Zod schemas imported from zod/v4 subpath for Zod v4 compatibility"
  - "Pattern: Mobile color scheme narrowing uses === 'dark' ? 'dark' : 'light' ternary"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-04-28
---

# Phase 01 Plan 01: Monorepo Scaffold + Schema Summary

**Turborepo monorepo with Next.js 16, Expo 55, @lunchboxd/shared types/schemas/tokens, Drizzle/Neon schema (10 tables, 6 indices), and Vitest test stubs for AUTH-01 through AUTH-04**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-28T18:15:24Z
- **Completed:** 2026-04-28T18:25:05Z
- **Tasks:** 2
- **Files modified:** 54

## Accomplishments

- Turborepo monorepo scaffolded with pnpm hoisted linking — web, mobile, and shared packages all type-check cleanly
- Full Drizzle schema with all 10 tables (users, restaurants, reviews, review_tags, follows, friendships, feed_items, likes, notifications, user_stats) and migration SQL generated
- @lunchboxd/shared package exports User/Review/Restaurant/Follow/Friendship/FeedItem/Like/Notification/UserStats types, signUpSchema/signInSchema/forgotPasswordSchema, design tokens (colors, spacing, fontSizes), and typed API client
- Vitest configured with Wave 0 test stubs: AUTH-01/02/03/04 describe blocks + 2 smoke tests importing from @lunchboxd/shared — all pass green

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Turborepo monorepo with Next.js, Expo, shared package, and vitest** - `a933d48` (feat)
2. **Task 2: Define Drizzle schema and generate migration** - `7e5fa58` (feat)

**Plan metadata:** (created next)

## Files Created/Modified

- `pnpm-workspace.yaml` - Workspace definition with apps/* and packages/*
- `.npmrc` - node-linker=hoisted for Expo Metro compatibility
- `turbo.json` - Turborepo task configuration with dependsOn
- `package.json` - Root monorepo package with turbo scripts
- `packages/shared/src/types/index.ts` - User, Review, Restaurant, and 7 more entity interfaces
- `packages/shared/src/schemas/index.ts` - signUpSchema, signInSchema, forgotPasswordSchema
- `packages/shared/src/constants/tokens.ts` - colors, spacing, fontSizes, fontWeights, radii
- `packages/shared/src/api/client.ts` - createApiClient typed fetch wrapper
- `packages/shared/src/index.ts` - Barrel export
- `apps/web/lib/schema.ts` - Full Drizzle schema, 10 tables, 6 performance indices
- `apps/web/lib/db.ts` - Neon serverless + Drizzle connection
- `apps/web/drizzle.config.ts` - drizzle-kit configuration
- `apps/web/drizzle/0000_square_warbound.sql` - Generated migration SQL
- `apps/web/app/globals.css` - Tailwind v4 theme with design system colors/fonts
- `apps/web/app/layout.tsx` - Fraunces + Inter font setup
- `apps/web/vitest.config.ts` - Vitest configuration for web app
- `apps/web/__tests__/auth.test.ts` - AUTH-01 through AUTH-04 test stubs + smoke tests
- `apps/mobile/app/_layout.tsx` - ClerkProvider wrapping RootLayout with tokenCache

## Decisions Made

- Used `pgTable` inline index callback syntax instead of standalone `index()` exports — drizzle-kit 0.31.10 bundles its own pg-core which is incompatible with the standalone index API from drizzle-orm 0.45.2
- `feedItemsOwnerIdx` defined as single-column index on `ownerUserId` only — compound index `(ownerUserId, createdAt)` triggered JSON parse error in drizzle-kit bundled code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ColorSchemeName type errors in scaffolded Expo template**
- **Found during:** Task 1 (mobile app type-check)
- **Issue:** React Native 0.85 broadened `ColorSchemeName` to include `'unspecified' | null` but the scaffolded template indexed `Colors[colorScheme ?? 'light']` which TypeScript rejects because `'unspecified'` is not a key of `Colors`
- **Fix:** Changed to `Colors[colorScheme === 'dark' ? 'dark' : 'light']` in Themed.tsx and tabs/_layout.tsx; removed unused `@ts-expect-error` in ExternalLink.tsx
- **Files modified:** apps/mobile/app/(tabs)/_layout.tsx, apps/mobile/components/Themed.tsx, apps/mobile/components/ExternalLink.tsx
- **Verification:** `pnpm --filter mobile type-check` passes with 0 errors
- **Committed in:** a933d48 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed standalone index() API incompatibility with drizzle-kit 0.31.10**
- **Found during:** Task 2 (drizzle-kit generate)
- **Issue:** `drizzle-kit generate` threw `SyntaxError: "undefined" is not valid JSON` when processing standalone index() exports — drizzle-kit's bundled pg-core expects `column.defaultConfig` which drizzle-orm 0.45.2 columns don't provide
- **Fix:** Moved all index definitions inside pgTable second argument callback, which uses the stable table-level API
- **Files modified:** apps/web/lib/schema.ts
- **Verification:** `npx drizzle-kit generate` produces 10-table migration SQL successfully
- **Committed in:** 7e5fa58 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes necessary for type-checking and migration generation. No scope creep.

## Issues Encountered

- drizzle-kit 0.31.10 bundled copy of drizzle-orm is incompatible with the standalone `index()` API when used with drizzle-orm 0.45.2 columns — required switching to table-callback index pattern. This is a known version compatibility edge case.

## User Setup Required

**External services require manual configuration before auth pages will work:**

1. **Neon database:** Create project at neon.tech, copy connection string to `apps/web/.env.local` as `DATABASE_URL`, then run:
   ```bash
   cd apps/web && npx drizzle-kit migrate
   ```

2. **Clerk:** Create application at clerk.com, enable Google OAuth and username collection in Dashboard, copy keys to `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_WEBHOOK_SECRET=whsec_...
   ```
   And to `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

See `apps/web/.env.example` and `apps/mobile/.env.example` for full variable lists.

## Next Phase Readiness

- Monorepo foundation complete — `pnpm install`, `pnpm type-check`, and `pnpm --filter web test:unit` all pass
- All 10 database tables are schema-defined and migration SQL is generated — push to Neon when credentials are available
- Shared types and Zod schemas importable from `@lunchboxd/shared` in both web and mobile
- Design tokens available for UI implementation in Plans 02 and 03
- Ready to implement Clerk auth pages (Plan 02) and webhook handler (Plan 03)

---
*Phase: 01-auth-foundation*
*Completed: 2026-04-28*
