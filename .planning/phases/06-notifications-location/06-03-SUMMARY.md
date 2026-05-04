---
phase: 06-notifications-location
plan: 03
subsystem: location-api
tags: [location, map, restaurants, api, route-handlers, drizzle, ilike, social-signal]
dependency_graph:
  requires:
    - restaurantReviewedQuerySchema (packages/shared/src/schemas/index.ts — from 06-01)
    - restaurants table with lat/lng columns (apps/web/lib/schema.ts)
    - reviews table with deletedAt soft-delete (apps/web/lib/schema.ts)
    - follows table for social signal (apps/web/lib/schema.ts)
    - resolveUserId (apps/web/lib/queries.ts)
  provides:
    - GET /api/v1/restaurants/map (MapPin[] for map rendering — coordinate-bearing only)
    - GET /api/v1/restaurants/reviewed (ReviewedRestaurant[] — all reviewed, optional ILIKE q filter)
  affects:
    - apps/web/app/api/v1/restaurants/map/route.ts (new)
    - apps/web/app/api/v1/restaurants/reviewed/route.ts (new)
tech_stack:
  added: []
  patterns:
    - "isNotNull(col) Drizzle operator for nullable column null check — consistent with isNull(reviews.deletedAt) in feed/route.ts"
    - "selectDistinct to prevent duplicate rows from multi-review INNER JOIN before JS-side dedup"
    - "JS Map dedup with reviewedByFollowed upgrade — single pass over rows to merge per-restaurant social signal"
    - "ilike(col, '%q%') Drizzle operator for case-insensitive LIKE — parameterized, no SQL injection surface"
    - "or(ilike(city), ilike(address)) for multi-column ILIKE search — null columns simply don't match"
key_files:
  created:
    - apps/web/app/api/v1/restaurants/map/route.ts
    - apps/web/app/api/v1/restaurants/reviewed/route.ts
  modified: []
decisions:
  - "lat/lng returned as TypeScript string (Drizzle numeric type contract) — UI components call parseFloat() before passing to map coordinates"
  - "isNotNull(restaurants.lat) Drizzle operator preferred over raw SQL — consistent with existing isNull pattern in feed/route.ts"
  - "null lat/lng restaurants included in /reviewed but excluded from /map — per D-11; they appear in list only, not on map"
  - "restaurantReviewedQuerySchema validates q param (max 100) before ILIKE — prevents unbounded query size (T-06-03-02)"
  - "reviewedByFollowed computed server-side from authenticated user's follows — never from client-supplied data (T-06-03-01)"
metrics:
  duration: "5m"
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 6 Plan 03: Restaurant Map and Reviewed Endpoints Summary

**One-liner:** Two restaurant data endpoints — a map pins endpoint (coordinate-bearing restaurants with reviewedByFollowed social signal via isNotNull/INNER JOIN) and a reviewed list/search endpoint (all reviewed restaurants with optional ILIKE city/address filter).

---

## What Was Built

**Two new route files:**

- **`apps/web/app/api/v1/restaurants/map/route.ts`** — GET handler returning `MapPin[]`. Fetches all restaurants with non-null lat AND lng that have at least one non-deleted review (INNER JOIN with isNull(deletedAt) filter). Deduplicates by restaurant ID in JS, computing `reviewedByFollowed: true` if any reviewer is in the authenticated user's following set. `lat`/`lng` are returned as strings (Drizzle `numeric` contract).

- **`apps/web/app/api/v1/restaurants/reviewed/route.ts`** — GET handler returning `ReviewedRestaurant[]`. No lat/lng filter — null-coordinate restaurants ARE included (D-11, list-only). Optional `?q=` param validated by `restaurantReviewedQuerySchema` (max 100 chars) then applied as `or(ilike(city), ilike(address))`. Same `reviewedByFollowed` social signal as map endpoint.

---

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GET /api/v1/restaurants/map endpoint | 46bc77e | apps/web/app/api/v1/restaurants/map/route.ts |
| 2 | Create GET /api/v1/restaurants/reviewed endpoint | af4e56a | apps/web/app/api/v1/restaurants/reviewed/route.ts |

---

## Deviations from Plan

None — plan executed exactly as written. Both files match the code specified in the plan. Build passed without modifications.

---

## Known Stubs

None — both endpoints are fully wired to the database. No placeholder data or hardcoded values.

---

## Threat Surface Scan

New endpoints introduced at trust boundaries:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-auth-endpoint | apps/web/app/api/v1/restaurants/map/route.ts | New GET endpoint — auth() + resolveUserId guard; reviewedByFollowed computed server-side from session user's follows (T-06-03-01) |
| threat_flag: new-auth-endpoint | apps/web/app/api/v1/restaurants/reviewed/route.ts | New GET endpoint — q param validated by restaurantReviewedQuerySchema before ILIKE; Drizzle parameterizes query (T-06-03-02) |

All three mitigations from the plan's threat register implemented as specified. T-06-03-03 (information disclosure) accepted per plan — no user PII in response.

---

## Self-Check: PASSED

- apps/web/app/api/v1/restaurants/map/route.ts: FOUND
- apps/web/app/api/v1/restaurants/reviewed/route.ts: FOUND
- Commit 46bc77e: FOUND
- Commit af4e56a: FOUND
- pnpm --filter web build: PASSED (Compiled successfully in 1878ms)
- isNotNull(restaurants.lat) present in map route: CONFIRMED
- ilike present in reviewed route: CONFIRMED
- isNotNull NOT present in reviewed route (null lat/lng included): CONFIRMED
