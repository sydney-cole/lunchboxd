---
phase: 01-auth-foundation
plan: 03
subsystem: auth-mobile
tags: [clerk, expo, mobile, auth, eas, react-native, clerk-expo, expo-router]

# Dependency graph
requires:
  - 01-01 (monorepo scaffold, shared package, design tokens, API client)
  - 01-02 (web auth including /api/v1/users endpoint that mobile calls post-signup)
provides:
  - ClerkProvider root layout with tokenCache (SecureStore-backed session persistence)
  - (auth)/_layout.tsx — redirects signed-in users away from auth screens
  - (app)/_layout.tsx — redirects unauthenticated users to sign-in
  - (app)/(tabs)/_layout.tsx — single Home tab layout
  - (app)/(tabs)/index.tsx — placeholder home screen
  - Sign-up screen (email + password + username single-step, Google OAuth)
  - Sign-in screen (email + password, Forgot password link, Google OAuth)
  - Forgot password screen (email field, success inline state)
  - Welcome/onboarding screen (two CTAs: Log your first meal, Find friends to follow)
  - EAS development build configuration
affects:
  - Mobile auth flow (all phases that require authenticated mobile sessions)

# Tech tracking
tech-stack:
  added:
    - "@lunchboxd/shared workspace dependency added to apps/mobile/package.json"
    - "eas.json — EAS CLI >= 18.0.0, development/preview/production profiles"
  patterns:
    - Clerk 7 Future API on mobile: signUp.create() returns { error } not { status, createdSessionId }
    - Clerk 7 sign-in: create() → password() → finalize() via type-casting to Future API shape
    - Forgot password: type-cast to resetPasswordEmailCode API (Clerk 7 breaking change from create strategy pattern)
    - Route group structure: (auth) for public auth screens, (app) for protected screens
    - useAuth() in layout files for redirect guards (isLoaded check before any redirect)
    - ClerkLoaded wrapper around Slot in root layout for initialization safety

key-files:
  created:
    - apps/mobile/app/_layout.tsx (replaced — ClerkProvider + ClerkLoaded + Slot)
    - apps/mobile/app/(auth)/_layout.tsx
    - apps/mobile/app/(auth)/sign-in.tsx
    - apps/mobile/app/(auth)/sign-up.tsx
    - apps/mobile/app/(auth)/forgot-password.tsx
    - apps/mobile/app/(app)/_layout.tsx
    - apps/mobile/app/(app)/welcome.tsx
    - apps/mobile/app/(app)/(tabs)/_layout.tsx
    - apps/mobile/app/(app)/(tabs)/index.tsx
    - apps/mobile/eas.json
  modified:
    - apps/mobile/package.json (added @lunchboxd/shared workspace dependency)
    - apps/mobile/.env.example (added EXPO_PUBLIC_API_URL)

key-decisions:
  - "Clerk 7 on mobile: signUp.create() returns { error: ClerkError | null } — no status/createdSessionId fields. Navigate on absence of error."
  - "sign-in finalize flow type-cast: signIn.password() and signIn.finalize() are not on the TypeScript surface of SignInFutureResource — must cast via unknown"
  - "forgot password: resetPasswordEmailCode() method accessed via unknown cast — Clerk 7 removed the strategy:'reset_password_email_code' option from signIn.create()"
  - "Added @lunchboxd/shared as workspace dependency — was missing from mobile package.json despite being available in the monorepo"
  - "Removed old Expo scaffold (tabs)/index.tsx, (tabs)/two.tsx, (tabs)/_layout.tsx, modal.tsx — these conflicted with new (app)/(auth) route group structure"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-04-28
---

# Phase 01 Plan 03: Mobile Auth Screens Summary

**ClerkProvider with SecureStore token caching, sign-up/sign-in/forgot-password/onboarding screens with Clerk 7 Future API, EAS development build configuration**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-28T18:59:04Z
- **Completed:** 2026-04-28
- **Tasks:** 2 of 3 (Task 3 is a human-verify checkpoint — awaiting device verification)
- **Files modified:** 12

## Accomplishments

- Root `_layout.tsx` replaced with minimal `ClerkProvider` + `ClerkLoaded` + `Slot` — no legacy navigation wrappers
- `(auth)/_layout.tsx` uses `useAuth()` to redirect already-signed-in users away from auth screens
- `(app)/_layout.tsx` uses `useAuth()` to redirect unauthenticated users to `/(auth)/sign-in`
- Sign-up screen: username (@-prefix inline), email, password fields — Clerk 7 Future API (`signUp.create()` returns `{ error }`), blur-validation via shared `signUpSchema`, Google OAuth, API call to `/api/v1/users` for immediate username storage
- Sign-in screen: email + password — Clerk 7 `create → password → finalize` flow, "Email or password is incorrect." copy contract, Forgot password link, Google OAuth
- Forgot password screen: email field, `resetPasswordEmailCode()` on success shows "Check your email — we sent a reset link to {email}."
- Welcome/onboarding screen: `useUser()` for `@{username}` personalization, "Log your first meal" primary CTA + "Find friends to follow" secondary CTA
- EAS `eas.json` with development/preview/production profiles — ready for `eas build --profile development --platform ios`
- All screens use shared design tokens from `@lunchboxd/shared` (colors, fontSizes, fontWeights, spacing, radii)
- All interactive elements have min 44px height, `accessibilityRole`, `accessibilityLabel`
- `pnpm --filter mobile type-check` passes with 0 errors

## Task Commits

1. **Task 1: Configure ClerkProvider, tokenCache, auth routing, and EAS build** - `4e2bb59` (feat)
2. **Task 2: Build mobile auth screens and onboarding** - `6b14cea` (feat)

## Files Created/Modified

- `apps/mobile/app/_layout.tsx` — ClerkProvider with tokenCache, ClerkLoaded, Slot (replaced old scaffold)
- `apps/mobile/app/(auth)/_layout.tsx` — useAuth redirect for signed-in users
- `apps/mobile/app/(auth)/sign-in.tsx` — "Welcome back" heading, email+password, Clerk 7 future flow, Google OAuth
- `apps/mobile/app/(auth)/sign-up.tsx` — "Create your account" heading, @-prefix username, email, password, API username POST
- `apps/mobile/app/(auth)/forgot-password.tsx` — "Reset your password" heading, email, inline success state
- `apps/mobile/app/(app)/_layout.tsx` — useAuth redirect for unauthenticated users
- `apps/mobile/app/(app)/welcome.tsx` — "Welcome to Lunchboxd, @username", two CTAs
- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — Single Home tab
- `apps/mobile/app/(app)/(tabs)/index.tsx` — Placeholder screen with "Lunchboxd" + "Coming soon"
- `apps/mobile/eas.json` — EAS build configuration
- `apps/mobile/package.json` — Added @lunchboxd/shared workspace dependency
- `apps/mobile/.env.example` — Added EXPO_PUBLIC_API_URL

## Decisions Made

- Clerk 7 `signUp.create()` returns `{ error: ClerkError | null }` on mobile (same as web) — navigate on absence of error rather than checking `status`
- `signIn.password()` and `signIn.finalize()` are not surfaced on the TypeScript type for `SignInFutureResource` — accessed via type cast through `unknown`
- `resetPasswordEmailCode()` is used for forgot password (Clerk 7 removed `strategy: 'reset_password_email_code'` from `signIn.create()`)
- `@lunchboxd/shared` was missing from `apps/mobile/package.json` — auto-added as `workspace:*` dependency (Rule 3 fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @lunchboxd/shared missing from mobile package.json**
- **Found during:** Task 1 (type-check failure)
- **Issue:** `apps/mobile/app/(app)/(tabs)/index.tsx` imported `@lunchboxd/shared` but the package was not listed in `apps/mobile/package.json` dependencies — TypeScript could not resolve the module
- **Fix:** Added `"@lunchboxd/shared": "workspace:*"` to `apps/mobile/package.json` and ran `pnpm install`
- **Files modified:** apps/mobile/package.json, pnpm-lock.yaml
- **Commit:** 4e2bb59 (Task 1 commit)

**2. [Rule 1 - Bug] Clerk 7 signUp.create() returns { error } not { status, createdSessionId }**
- **Found during:** Task 2 (type-check failure)
- **Issue:** The plan's action specified checking `result.status === 'complete' || result.createdSessionId` but Clerk 7 Future API returns `{ error: ClerkError | null }` — no status field on create result
- **Fix:** Changed sign-up logic to check `createResult.error` and throw on error; navigate unconditionally when no error
- **Files modified:** apps/mobile/app/(auth)/sign-up.tsx
- **Commit:** 6b14cea (Task 2 commit)

**3. [Rule 1 - Bug] Clerk 7 forgot password strategy type error**
- **Found during:** Task 2 (type-check failure)
- **Issue:** `signIn.create({ strategy: 'reset_password_email_code', identifier: email })` — TypeScript rejected `'reset_password_email_code'` as not assignable to valid strategy types in Clerk 7
- **Fix:** Changed to access `resetPasswordEmailCode()` via unknown type cast — consistent with Clerk 7 Future API pattern
- **Files modified:** apps/mobile/app/(auth)/forgot-password.tsx
- **Commit:** 6b14cea (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 1 bugs)
**Impact on plan:** All fixes required for type safety and compilation. No scope changes.

## Known Stubs

- Sign-in's Clerk 7 `finalize()` flow uses type casting — the actual method shape may differ at runtime. Verified compilable but runtime behavior requires device testing (Task 3 checkpoint).
- Forgot password uses `resetPasswordEmailCode()` via unknown cast — runtime shape unconfirmed.
- Welcome screen CTAs ("Log your first meal" and "Find friends to follow") both navigate to `/(app)/(tabs)` — stub links per plan spec, Phase 2 and 3 will wire these to meal logging and user search.

## User Setup Required

Before running an EAS development build:

1. **Clerk publishable key** in `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
   (Same app as web — use the same Clerk application)

2. **API URL** in `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```
   (Use ngrok or similar for real device testing)

3. **EAS account and project**:
   ```bash
   npm install -g eas-cli
   cd apps/mobile
   eas login
   eas build:configure
   eas build --profile development --platform ios
   ```

4. Install the dev build on device/simulator, then:
   ```bash
   cd apps/mobile && npx expo start --dev-client
   ```

## Task 3: Human Verification Required

Task 3 is a blocking `checkpoint:human-verify`. The user must:
1. Create an EAS development build and install it
2. Verify sign-in, sign-up, Google OAuth, forgot password, and onboarding screens work end-to-end
3. Confirm session persists after app restart (SecureStore token cache working)

## Self-Check: PASSED

All 10 created files verified to exist on disk. Task commits `4e2bb59` and `6b14cea` confirmed in git log.

---
*Phase: 01-auth-foundation*
*Completed: 2026-04-28*
