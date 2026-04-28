---
phase: 01-auth-foundation
plan: 02
subsystem: auth-web
tags: [clerk, nextjs, auth, webhook, svix, oauth, google, middleware]

# Dependency graph
requires:
  - 01-01 (monorepo scaffold, schema, db, shared package)
provides:
  - Clerk middleware protecting all non-public routes
  - POST /api/v1/webhooks/clerk — Svix-verified webhook syncing user.created/updated/deleted to local users table
  - POST /api/v1/users — immediate username storage endpoint (Pitfall 4 prevention)
  - Sign-up page (/sign-up) — username + email + password single-step form with Google OAuth
  - Sign-in page (/sign-in) — email + password with session-expired banner and Google OAuth
  - Forgot-password page (/forgot-password) — Clerk reset_password_email_code flow with success state
  - Welcome/onboarding page (/welcome) — two CTAs (Log your first meal, Find friends to follow)
  - AuthCard reusable wrapper (lunchboxd wordmark, bg-surface, 400px, shadow)
  - SessionExpiredBanner component (?expired=true URL param)
  - GoogleLogo SVG component
affects:
  - All protected routes (middleware enforcement)
  - Neon users table (webhook syncs records)

# Tech tracking
tech-stack:
  added:
    - lucide-react (AlertCircle, Loader2, CheckCircle, X icons)
  patterns:
    - Clerk 7 Future API (SignInFutureResource/SignUpFutureResource) with signIn.password() → signIn.finalize()
    - Google OAuth via clerk.client.signIn/signUp.authenticateWithRedirect() (old API still available on client)
    - Next.js 16 async headers() for webhook signature extraction
    - clerkMiddleware with createRouteMatcher for public/protected route split
    - Upsert pattern (onConflictDoUpdate on clerkId) for both webhook and /api/v1/users

key-files:
  created:
    - apps/web/middleware.ts
    - apps/web/app/api/v1/webhooks/clerk/route.ts
    - apps/web/app/api/v1/users/route.ts
    - apps/web/app/(auth)/layout.tsx
    - apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - apps/web/app/(auth)/forgot-password/page.tsx
    - apps/web/app/(app)/layout.tsx
    - apps/web/app/(app)/welcome/page.tsx
    - apps/web/components/auth-card.tsx
    - apps/web/components/google-logo.tsx
    - apps/web/components/session-expired-banner.tsx
  modified:
    - apps/web/app/layout.tsx (added ClerkProvider wrapper)
    - apps/web/package.json (added lucide-react)
    - pnpm-lock.yaml (updated)

key-decisions:
  - "Clerk 7 uses SignalValue API: useSignIn() returns { signIn: SignInFutureResource } — no isLoaded/setActive. Use signIn.create() → signIn.password() → signIn.finalize() flow"
  - "Google OAuth via clerk.client.signIn/signUp.authenticateWithRedirect() — SignInFutureResource and SignUpFutureResource do NOT have authenticateWithRedirect; must use old API via useClerk().client"
  - "Next.js 16 headers() is async — must await headers() in webhook handler (breaking change from v14)"
  - "SessionExpiredBanner wrapped in Suspense on sign-in page — useSearchParams() requires Suspense boundary in Next.js app router"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 25min
completed: 2026-04-28
---

# Phase 01 Plan 02: Clerk Auth Pages and Webhook Summary

**Custom Clerk authentication web flows with middleware protection, Svix-verified webhook sync, and all four auth screens matching UI-SPEC.md contracts**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-28
- **Completed:** 2026-04-28
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Clerk middleware created at `apps/web/middleware.ts` using `clerkMiddleware` + `createRouteMatcher` — all routes except `/sign-in`, `/sign-up`, `/forgot-password`, and `/api/v1/webhooks` are protected
- Webhook handler at `/api/v1/webhooks/clerk` uses Svix signature verification (`new Webhook(secret).verify()`) and handles `user.created`, `user.updated`, and `user.deleted` events with upsert pattern
- POST `/api/v1/users` endpoint allows immediate username storage after Clerk sign-up completes, preventing the race condition where webhook arrives after page redirect (Pitfall 4 from RESEARCH.md)
- All four auth screens built with custom Clerk integration (no pre-built Clerk UI components):
  - Sign-up: username (@-prefix) + email + password, single screen, Google OAuth, blur validation, loading spinner
  - Sign-in: email + password, session-expired banner, forgot password link, Google OAuth
  - Forgot-password: email field → `signIn.resetPasswordEmailCode.sendCode()` → inline success state
  - Welcome/onboarding: personalized heading with @username, two CTA buttons
- AuthCard, GoogleLogo, and SessionExpiredBanner reusable components created
- `pnpm --filter web type-check` and `pnpm --filter web build` both pass

## Task Commits

1. **Task 1: Clerk middleware, webhook handler, and user creation API** - `9a7d46e` (feat)
2. **Task 2: Build auth screens and onboarding page** - `fc647b6` (feat)

## Files Created/Modified

- `apps/web/middleware.ts` — clerkMiddleware with createRouteMatcher, public routes list
- `apps/web/app/api/v1/webhooks/clerk/route.ts` — Svix webhook handler, runtime=nodejs, user CRUD sync
- `apps/web/app/api/v1/users/route.ts` — POST endpoint, auth() check, username upsert
- `apps/web/app/layout.tsx` — Added ClerkProvider wrapping html/body
- `apps/web/app/(auth)/layout.tsx` — useAuth() redirect for already-signed-in users
- `apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Full sign-up form with Clerk 7 Future API
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Full sign-in form with session-expired banner
- `apps/web/app/(auth)/forgot-password/page.tsx` — Password reset with inline success state
- `apps/web/app/(app)/layout.tsx` — Server-side auth check, redirects to /sign-in?expired=true
- `apps/web/app/(app)/welcome/page.tsx` — Onboarding with @username personalization, two CTAs
- `apps/web/components/auth-card.tsx` — Shared card wrapper: wordmark, bg-surface, shadow, 400px
- `apps/web/components/google-logo.tsx` — Inline Google G SVG, 20px
- `apps/web/components/session-expired-banner.tsx` — Amber banner, dismissible, reads ?expired=true

## Decisions Made

- Clerk 7 uses a "signals" API where `useSignIn()` returns `{ signIn: SignInFutureResource }` with no `isLoaded`/`setActive`. The correct flow is `signIn.create({ identifier })` → `signIn.password({ password })` → `signIn.finalize()`. This replaces the old `signIn.create()` → `setActive({ session: result.createdSessionId })` pattern.
- Google OAuth via `useClerk().client.signIn.authenticateWithRedirect()` — the Future resource types do not expose `authenticateWithRedirect`, but `clerk.client.signIn` (old SignInResource) does.
- `headers()` in Next.js 16 is async — webhook handler must `await headers()` (breaking from v14).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clerk 7 API is a complete rewrite from the plan's assumed API**
- **Found during:** Task 2 (type-check)
- **Issue:** The plan specified `useSignUp()` returning `{ isLoaded, signUp, setActive }` and `signUp.create()` returning `{ status, createdSessionId }`. Clerk 7 replaced this with a "Future resource" API (`SignInSignalValue`/`SignUpSignalValue`) where hooks return `{ signIn: SignInFutureResource }` and all operations return `{ error }` instead of the resource state.
- **Fix:** Rewrote all hook usage to use the new Clerk 7 Future API: `signIn.create()` → `signIn.password()` → `signIn.finalize()` for sign-in; `signUp.create()` → `signUp.finalize()` for sign-up; `useClerk().client.signIn.authenticateWithRedirect()` for Google OAuth
- **Files modified:** apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx, apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx, apps/web/app/(auth)/forgot-password/page.tsx
- **Commit:** fc647b6 (Task 2 commit)

**2. [Rule 1 - Bug] Next.js 16 async headers() breaking change**
- **Found during:** Task 1 (implementation review of Next.js 16 docs)
- **Issue:** The plan's webhook handler used synchronous `headers()` (v14 pattern). Next.js 16 makes `headers()` async — synchronous access will be deprecated.
- **Fix:** Added `await headers()` and extracted svix header values after awaiting.
- **Files modified:** apps/web/app/api/v1/webhooks/clerk/route.ts
- **Commit:** 9a7d46e (Task 1 commit)

**3. [Rule 2 - Missing critical functionality] SessionExpiredBanner requires Suspense boundary**
- **Found during:** Task 2 (Next.js App Router knowledge)
- **Issue:** `useSearchParams()` in `session-expired-banner.tsx` requires a `Suspense` boundary in Next.js App Router, otherwise the page falls back to client-side only rendering.
- **Fix:** Wrapped `SignInForm` in `<Suspense fallback={null}>` in the sign-in page.
- **Files modified:** apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
- **Commit:** fc647b6

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2)
**Impact on plan:** All fixes required for correctness and type safety. No scope changes.

## Known Stubs

- `/welcome` page CTAs ("Log your first meal" and "Find friends to follow") both link to `/` — stub links per plan spec, Phase 2 and 3 will wire these to meal logging and user search respectively.

## User Setup Required

**External services must be configured before auth pages will function:**

1. **Clerk application** — create at clerk.com, enable:
   - Google OAuth provider (Dashboard → Social connections → Google)
   - Username field (Dashboard → User & Authentication → Personal information → Username)
   - Webhook endpoint pointing to `your-domain/api/v1/webhooks/clerk`
   - Subscribe webhook to: `user.created`, `user.updated`, `user.deleted`

2. **Environment variables** in `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_WEBHOOK_SECRET=whsec_...
   DATABASE_URL=postgresql://...
   ```

## Next Phase Readiness

- Web auth is complete — all four AUTH requirements delivered
- Plan 03 (mobile auth) can now implement Expo sign-in/sign-up screens using `@clerk/expo`
- Database sync is operational via webhook — the `users` table will populate on first sign-up when Clerk credentials are set

## Self-Check: PASSED

All 12 created files verified to exist on disk. Task commits `9a7d46e` and `fc647b6` confirmed in git log.

---
*Phase: 01-auth-foundation*
*Completed: 2026-04-28*
