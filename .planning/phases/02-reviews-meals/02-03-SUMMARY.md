---
phase: 02-reviews-meals
plan: "03"
subsystem: review-api
tags: [reviews, crud, fan-out, feed, soft-delete, tags, drizzle]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [review-post, review-get, review-patch, review-delete, fan-out-on-write, resolveUserId, fanOutToFollowers]
  affects: [02-04, 02-05]
tech_stack:
  added: []
  patterns:
    - "Fan-out-on-write: insert feed_items rows for author + all followers on review create"
    - "Soft-delete with isNull(deletedAt) filter on all read/update/delete operations"
    - "Atomic tag replacement: delete all + re-insert in PATCH handler"
    - "resolveUserId helper to translate Clerk clerkId to internal UUID"
    - "reviewSchema.partial() for PATCH partial validation"
    - "Next.js 16 async params: const { id } = await params"
key_files:
  created:
    - apps/web/app/api/v1/reviews/route.ts
    - apps/web/app/api/v1/reviews/[id]/route.ts
    - apps/web/lib/queries.ts
  modified: []
decisions:
  - "fanOutToFollowers includes author's own feed row (not just followers) so author sees their own review in their feed"
  - "Tag normalization (toLowerCase + trim) applied on both create and update to maintain consistent tag format"
  - "updateSet typed as Record<string, unknown> instead of Record<string, any> to satisfy TypeScript strict mode"
  - "GET response enriches each review with tags array and restaurant name/address to avoid N+1 on client"
metrics:
  duration_seconds: 420
  completed_date: "2026-04-29"
  tasks_completed: 2
  files_changed: 3
---

# Phase 2 Plan 03: Review CRUD API Summary

**One-liner:** Four Route Handlers (POST, GET, PATCH, DELETE) for meal reviews with fan-out-on-write feed seeding, soft-delete, atomic tag replacement, and ownership enforcement.

---

## What Was Built

Three files implementing the core review CRUD API:

1. **apps/web/lib/queries.ts** — Two reusable query helpers:
   - `resolveUserId(clerkId)`: translates Clerk's external user ID to the internal Postgres UUID
   - `fanOutToFollowers(reviewId, authorUserId, reviewCreatedAt)`: inserts feed_items rows for the author and all their followers (fan-out-on-write pattern)

2. **apps/web/app/api/v1/reviews/route.ts** — POST and GET handlers:
   - `POST /api/v1/reviews`: validates body with `reviewSchema.safeParse`, normalizes tags (toLowerCase + trim), constructs R2 photo URL from photoKey, inserts review + tags, fans out to followers
   - `GET /api/v1/reviews`: returns authenticated user's non-deleted reviews in reverse chronological order, enriched with `tags: string[]` and `restaurant: { name, address } | null`

3. **apps/web/app/api/v1/reviews/[id]/route.ts** — PATCH and DELETE handlers:
   - `PATCH /api/v1/reviews/:id`: ownership check (403 on non-owner), partial update via `reviewSchema.partial()`, atomic tag replacement (delete all + re-insert)
   - `DELETE /api/v1/reviews/:id`: ownership check, soft-delete (`deletedAt: new Date()`), hard-delete of associated feed_items cache rows

---

## Decisions Made

- **Author in own feed:** `fanOutToFollowers` always inserts a feed row for the author themselves, not just their followers. This ensures the author immediately sees their own review in their own feed.
- **Tag normalization on create + update:** Both POST and PATCH apply `label.toLowerCase().trim()` so tags are stored consistently regardless of client casing.
- **Enriched GET response:** Rather than returning bare review rows, GET joins tags and restaurant data server-side to prevent N+1 fetching on the client.
- **TypeScript strict mode compliance:** `updateSet` typed as `Record<string, unknown>` rather than `Record<string, any>` to satisfy the project's strict TypeScript config.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all endpoints are fully wired. Fan-out writes real feed_items rows. No placeholder returns or hardcoded values.

---

## Commits

| Hash | Message |
|------|---------|
| d87c65d | feat(02-03): implement review POST/GET endpoints and query helpers |
| 2331843 | feat(02-03): implement review PATCH/DELETE endpoints with ownership check |

---

## Self-Check: PASSED

Files exist:
- apps/web/app/api/v1/reviews/route.ts — FOUND
- apps/web/app/api/v1/reviews/[id]/route.ts — FOUND
- apps/web/lib/queries.ts — FOUND

Commits:
- d87c65d — FOUND
- 2331843 — FOUND

Type-check: PASSED (tsc --noEmit exits 0)
Unit tests: PASSED (15 tests passed)
