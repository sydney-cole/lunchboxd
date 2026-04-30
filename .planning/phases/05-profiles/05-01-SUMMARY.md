---
phase: 05-profiles
plan: 01
subsystem: shared-schemas
tags: [zod, schemas, upload, profiles, wave-0]
dependency_graph:
  requires: []
  provides:
    - patchUserSchema exported from @lunchboxd/shared
    - profileQuerySchema exported from @lunchboxd/shared
    - PatchUserInput type
    - ProfileQueryInput type
    - Upload endpoint optional type param (avatars/ prefix support)
  affects:
    - apps/web/app/api/v1/users/me/route.ts (imports patchUserSchema)
    - apps/web/app/api/v1/users/[username]/reviews/route.ts (imports profileQuerySchema)
tech_stack:
  added: []
  patterns:
    - Zod v4 regex validation for R2 key format (path traversal protection)
    - Zod v4 z.coerce.number() for query param coercion
    - Upload type routing via optional body param with default
key_files:
  created:
    - apps/web/__tests__/profiles.test.ts
  modified:
    - packages/shared/src/schemas/index.ts
    - apps/web/app/api/v1/uploads/route.ts
decisions:
  - avatarKey regex allows both avatars/ and reviews/ prefixes so users can set a review photo as their avatar
  - profileQuerySchema mirrors feedQuerySchema intentionally — same pagination contract for consistency
  - Upload type param defaults to 'review' — backward compatible with all existing upload calls
metrics:
  duration: "1m 27s"
  completed_date: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 5 Plan 01: Shared Profile Schemas and Upload Type Param Summary

**One-liner:** Zod v4 patchUserSchema with avatarKey regex + profileQuerySchema cursor pagination, plus avatar-prefix routing in the upload endpoint.

## What Was Built

Wave 0 foundation for Phase 5 (Profiles). All Wave 1 API routes need type-safe contracts to implement against — this plan provides those contracts.

### Task 1: patchUserSchema and profileQuerySchema in @lunchboxd/shared

Appended two new exports after the existing `feedQuerySchema` block in `packages/shared/src/schemas/index.ts`:

- `patchUserSchema`: fully partial object with `bio` (max 500), `displayName` (max 50), and `avatarKey` (regex-validated R2 key, guarding against path traversal)
- `profileQuerySchema`: cursor pagination schema identical to feedQuerySchema — ISO 8601 cursor + coerced integer limit (1-100, default 20)

### Task 2: profiles.test.ts — 13 unit tests across 2 describe blocks

Created `apps/web/__tests__/profiles.test.ts` with:
- 8 tests for patchUserSchema: bio/displayName character limits, all partial update combinations (bio only, avatarKey only, all fields, empty), valid avatarKey acceptance, path traversal rejection
- 5 tests for profileQuerySchema: null cursor first page, non-ISO-8601 rejection, valid ISO 8601 cursor, string limit coercion, limit > 100 rejection

All 13 tests pass.

### Task 3: Upload endpoint type param

Modified `apps/web/app/api/v1/uploads/route.ts`:
- Body parsing now extracts optional `type` field (`'review' | 'avatar'`), defaulting to `'review'`
- Key generation uses `prefix = type === 'avatar' ? 'avatars' : 'reviews'`
- Response shape `{ uploadUrl, key }` and content-type validation unchanged — fully backward compatible

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

The following 4 test failures existed before this plan executed and are not caused by these changes:
- `restaurants.test.ts > MEAL-03: should accept mealType homemade with no restaurantId`
- `reviews.test.ts > REVW-02: should accept note up to 2000 characters`
- `reviews.test.ts > REVW-04: should accept tags as array of strings`
- `reviews.test.ts > REVW-05: should accept mealDate in YYYY-MM-DD format`

These failures are deferred to `deferred-items.md` for investigation in a separate session.

## Known Stubs

None — all schemas are fully implemented with real validation logic.

## Self-Check: PASSED
