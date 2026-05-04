---
phase: 06-notifications-location
plan: 01
subsystem: shared-schemas
tags: [schemas, validation, zod, unit-tests, vitest, notifications, location]
dependency_graph:
  requires: []
  provides:
    - notificationQuerySchema (packages/shared/src/schemas/index.ts)
    - restaurantReviewedQuerySchema (packages/shared/src/schemas/index.ts)
    - NotificationQueryInput type
    - RestaurantReviewedQueryInput type
  affects:
    - apps/web/app/api/v1/notifications/route.ts (future — imports notificationQuerySchema)
    - apps/web/app/api/v1/restaurants/reviewed/route.ts (future — imports restaurantReviewedQuerySchema)
tech_stack:
  added: []
  patterns:
    - "Phase 6 schemas follow identical cursor pagination contract as feedQuerySchema (Phase 4)"
    - "restaurantReviewedQuerySchema uses max(100) to prevent oversized ILIKE payloads (T-06-01-02)"
    - "Pure function unit tests for shouldSkipNotification (D-02) and computeReviewedByFollowed"
key_files:
  created:
    - apps/web/__tests__/notifications.test.ts
  modified:
    - packages/shared/src/schemas/index.ts
decisions:
  - "notificationQuerySchema mirrors feedQuerySchema exactly — same cursor+limit contract for consistency (NOTF-01, NOTF-02)"
  - "restaurantReviewedQuerySchema uses optional q with max(100) to bound ILIKE query size before parameterization (T-06-01-02)"
  - "shouldSkipNotification and computeReviewedByFollowed tested as pure functions — no DB dependency in Wave 0 tests"
metrics:
  duration: "57s"
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 6 Plan 01: Phase 6 Schemas and Unit Tests Summary

**One-liner:** Added notificationQuerySchema and restaurantReviewedQuerySchema to shared package using zod/v4, with 17 passing Vitest unit tests covering cursor validation, limit coercion, and pure-function notification logic.

---

## What Was Built

Two Zod schemas appended to `packages/shared/src/schemas/index.ts`:

- **`notificationQuerySchema`** — cursor-based pagination schema identical to `feedQuerySchema` (Phase 4). Validates ISO 8601 datetime cursors and coerces string limit values. Rejects non-ISO cursor strings (prevents malformed cursors reaching Drizzle `lt()` calls — T-06-01-01).

- **`restaurantReviewedQuerySchema`** — optional `q` search param with `max(100)` constraint. Prevents oversized ILIKE payloads before they reach Drizzle parameterized queries (T-06-01-02).

Unit test file `apps/web/__tests__/notifications.test.ts` with 17 tests covering:
- Schema valid/invalid parse cases
- Limit coercion and default behavior
- Boundary value testing (q at exactly 100 chars)
- Pure `shouldSkipNotification` function (D-02 self-notification skip logic)
- Pure `computeReviewedByFollowed` function (LOCN-03 social enrichment logic)

---

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Phase 6 schemas to shared package | 5351dc8 | packages/shared/src/schemas/index.ts |
| 2 | Write unit tests for Phase 6 schemas | 9d6e0c6 | apps/web/__tests__/notifications.test.ts |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — this plan only adds schemas and tests; no UI or data rendering.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Schemas are server-side validation only. The threat mitigations T-06-01-01 and T-06-01-02 are implemented as specified.

---

## Self-Check: PASSED

- packages/shared/src/schemas/index.ts: FOUND, exports notificationQuerySchema (2 occurrences)
- apps/web/__tests__/notifications.test.ts: FOUND, 17 tests, all passing
- Commit 5351dc8: FOUND
- Commit 9d6e0c6: FOUND
- pnpm --filter shared type-check: PASSED
- notifications.test.ts: 17/17 tests pass
