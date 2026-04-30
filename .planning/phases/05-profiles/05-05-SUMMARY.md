---
phase: 05-profiles
plan: 05
subsystem: ui
tags: [profiles, edit-profile, avatar-upload, r2, clerk, tanstack-query, next-js]

requires:
  - phase: 05-02
    provides: PATCH /api/v1/users/me endpoint and GET /api/v1/users/[username] for pre-fill
  - phase: 05-01
    provides: POST /api/v1/uploads with type='avatar' support and R2 presigned URL pipeline

provides:
  - Edit profile page at /profile/edit (Client Component)
  - Bio textarea, displayName input, avatar upload via R2 presigned URL
  - PATCH /api/v1/users/me integration with avatarKey (not avatarUrl)
  - Redirect to /@username on save success with profile query cache invalidation

affects:
  - apps/mobile profile screens (Plan 05-06) — same edit flow pattern for mobile

tech-stack:
  added: []
  patterns:
    - "Client Component render-time fetch side-effect for pre-filling form (isLoaded + !profileLoaded guard)"
    - "Two-step avatar upload: POST /api/v1/uploads → PUT presigned URL → store key for PATCH body"
    - "avatarKey (not avatarUrl) sent to PATCH — server constructs URL from R2_PUBLIC_URL (security pattern)"
    - "queryClient.invalidateQueries(['profile', username]) on save success to bust profile cache"

key-files:
  created:
    - apps/web/app/(app)/profile/edit/page.tsx
  modified: []

key-decisions:
  - "Edit profile is a single Client Component — no RSC split needed for this form-only page"
  - "Pre-fill uses render-time fetch side-effect (not useEffect) — avoids React 19 double-invoke concerns with a profileLoaded guard"
  - "Avatar upload completes immediately on file select (not deferred to save) — key stored in state then sent with PATCH"

patterns-established:
  - "Profile edit page at /profile/edit (not /@username/edit) — consistent with D-07 decision"

requirements-completed: [PROF-01, PROF-02]

duration: 1min 3s
completed: 2026-04-30
---

# Phase 5 Plan 05: Edit Profile Page Summary

**Client Component edit profile page at /profile/edit with bio/displayName fields and two-step R2 avatar upload, saving via PATCH /api/v1/users/me and redirecting to /@username on success**

## Performance

- **Duration:** 1 min 3s
- **Started:** 2026-04-30T20:11:16Z
- **Completed:** 2026-04-30T20:12:19Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Edit profile page at `/profile/edit` pre-fills bio, displayName, and avatar from GET /api/v1/users/:username
- Avatar upload uses two-step flow: POST /api/v1/uploads (type='avatar') for presigned URL, then PUT file to R2 directly; stores key in state
- PATCH /api/v1/users/me sends avatarKey (not avatarUrl) — server constructs URL for security; invalidates ['profile', username] query on success and redirects to /@username
- Inline error states for avatar upload failure and save failure; auth guard redirects unauthenticated users to /sign-in

## Task Commits

Each task was committed atomically:

1. **Task 1: Edit profile page at /profile/edit** - `5cae801` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/web/app/(app)/profile/edit/page.tsx` - Client Component edit profile page with bio, displayName, avatar upload, save flow

## Decisions Made

- Edit profile is a single Client Component — no RSC split needed for this form-only page
- Pre-fill uses render-time fetch side-effect with `profileLoaded` guard rather than `useEffect` — avoids double-invoke patterns
- Avatar upload completes eagerly on file select (not deferred to Save click) — key is stored in state and bundled with the PATCH call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - pre-existing test failures (4 tests in restaurants.test.ts and reviews.test.ts) are unchanged from prior plans.

## Known Stubs

None — the page is fully wired to real API endpoints. Pre-fill fetches live data from GET /api/v1/users/:username; avatar upload uses the real R2 pipeline; save calls PATCH /api/v1/users/me.

## User Setup Required

None - no new external service configuration required. R2 credentials already required from Phase 2 (02-02).

## Next Phase Readiness

- Edit profile page complete; Plan 06 (mobile profile screens) can proceed
- The /@username profile page (Plan 04) links to /profile/edit for own-profile visitors — fully connected
- PROF-01 (avatar upload) and PROF-02 (bio editing) requirements satisfied

---
*Phase: 05-profiles*
*Completed: 2026-04-30*
