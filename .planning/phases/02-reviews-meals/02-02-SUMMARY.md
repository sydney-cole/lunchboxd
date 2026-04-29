---
phase: 02-reviews-meals
plan: "02"
subsystem: api-infrastructure
tags: [r2, cloudflare, google-places, presigned-url, restaurant-search, file-upload]
dependency_graph:
  requires: [02-01]
  provides: [presigned-r2-upload, restaurant-search-proxy, manual-restaurant-creation]
  affects: [02-03, 02-04]
tech_stack:
  added:
    - "@aws-sdk/client-s3@3.1038.0"
    - "@aws-sdk/s3-request-presigner@3.1038.0"
  patterns:
    - "S3Client with R2 endpoint for presigned PUT URL generation"
    - "Google Places (New) searchText API with local DB cache"
    - "onConflictDoUpdate upsert for restaurant deduplication"
    - "Graceful fallback (503/[]) when external services not configured"
key_files:
  created:
    - apps/web/app/api/v1/uploads/route.ts
    - apps/web/app/api/v1/restaurants/search/route.ts
    - apps/web/app/api/v1/restaurants/route.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/next.config.ts
    - apps/web/.env.example
decisions:
  - "R2 client returns null (not throws) when credentials missing, enabling graceful 503"
  - "Restaurant search checks local DB cache before calling Google Places to minimize API costs"
  - "GOOGLE_PLACES_API_KEY has no NEXT_PUBLIC_ prefix — stays server-side only"
metrics:
  duration_seconds: 101
  completed_date: "2026-04-29"
  tasks_completed: 2
  files_changed: 7
---

# Phase 2 Plan 02: R2 Upload & Restaurant Search Infrastructure Summary

**One-liner:** Presigned Cloudflare R2 upload endpoint with graceful 503 fallback plus Google Places restaurant search proxy with local DB caching and manual entry endpoint.

---

## What Was Built

Three API route handlers that form the infrastructure for the review creation flow:

1. **POST /api/v1/uploads** — Generates a presigned R2 PUT URL for direct client-to-R2 uploads. Validates contentType (jpeg/png/webp), returns 503 when R2 credentials not configured, requires Clerk auth.

2. **GET /api/v1/restaurants/search?q=X** — Proxies to Google Places (New) searchText API. Checks local DB cache first (ilike match), upserts Google Places results via onConflictDoUpdate, returns [] for queries < 2 chars or when API key missing.

3. **POST /api/v1/restaurants** — Creates a manual restaurant entry with `source='manual'` and `placeId=null`. Validates name is non-empty string, returns 201 with the new row.

Also updated `next.config.ts` with `remotePatterns` for `*.r2.dev` hostnames so Next.js Image can render R2-hosted photos.

---

## Decisions Made

- **R2 graceful fallback (503):** Rather than throwing on missing config, `getR2Client()` returns null so the POST handler can return a clear 503. This avoids a 500 crash in environments without R2 configured.
- **Local cache before Google Places:** The search route queries the local `restaurants` table with an ilike match first. This minimizes Google Places API costs as the dataset grows.
- **Server-side API key only:** `GOOGLE_PLACES_API_KEY` has no `NEXT_PUBLIC_` prefix anywhere in the codebase — it stays server-side only.
- **Manual entry is first-class:** `placeId: null` and `source: 'manual'` are passed explicitly (not defaulted) to make intent clear.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all endpoints are fully wired. No hardcoded empty returns or placeholder values that affect the plan's goals.

---

## Commits

| Hash | Message |
|------|---------|
| 49a31a0 | feat(02-02): install AWS SDK and create R2 presigned upload endpoint |
| 6babc08 | feat(02-02): create restaurant search proxy and manual restaurant creation endpoints |

---

## Self-Check: PASSED

Files exist:
- apps/web/app/api/v1/uploads/route.ts — FOUND
- apps/web/app/api/v1/restaurants/search/route.ts — FOUND
- apps/web/app/api/v1/restaurants/route.ts — FOUND
- apps/web/next.config.ts contains remotePatterns — FOUND
- apps/web/.env.example contains R2_ACCOUNT_ID and GOOGLE_PLACES_API_KEY — FOUND

Commits:
- 49a31a0 — FOUND
- 6babc08 — FOUND

Type-check: PASSED (tsc --noEmit exits 0)
