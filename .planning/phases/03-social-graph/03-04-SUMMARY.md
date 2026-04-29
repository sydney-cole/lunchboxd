---
phase: 03-social-graph
plan: 04
subsystem: api, search, social-graph
tags: [drizzle, search, ilike, follow-state, security]
dependency_graph:
  requires: [03-01]
  provides: [user-search-api]
  affects: [03-05, 03-06, 03-07]
tech_stack:
  added: []
  patterns: [ilike-search, batch-follow-state-lookup, explicit-column-select]
key_files:
  created:
    - apps/web/app/api/v1/users/search/route.ts
  modified: []
decisions:
  - "SELECT clause explicitly lists only safe fields (id, username, displayName, avatarUrl) — never email or clerkId per T-03-03"
  - "Batch follow-state uses two queries (follows + friendships) instead of N per-result queries"
  - "Self excluded from results via ne(users.id, actorUserId)"
  - "ILIKE on nullable displayName is expected behavior — NULL rows simply do not match"
metrics:
  duration: "~1 minute"
  completed_date: "2026-04-29"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
requirements: [SOCL-05]
---

# Phase 3 Plan 04: User Search API Summary

**One-liner:** GET /api/v1/users/search returns up to 20 users matching username or displayName via ILIKE, each enriched with followState (none/following/friends), with email and clerkId never exposed.

## What Was Built

Created `apps/web/app/api/v1/users/search/route.ts` — the only user discovery mechanism in Phase 3.

The endpoint:
- Authenticates via Clerk; returns 401 for unauthenticated requests
- Validates query param `q` via `userSearchSchema` (min 2, max 100 chars); returns 400 for short queries
- Queries users matching `q` on `username` OR `displayName` using ILIKE (parameterized — T-03-04 SQL injection mitigated)
- SELECT clause explicitly lists only `id`, `username`, `displayName`, `avatarUrl` — never `email` or `clerkId` (T-03-03)
- Excludes the authenticated user from results via `ne(users.id, actorUserId)`
- Caps results at 20
- Enriches each result with `followState: 'none' | 'following' | 'friends'` using two batch queries (follows + friendships) — no N+1

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GET /api/v1/users/search with ILIKE query and follow state enrichment | c92d0db | apps/web/app/api/v1/users/search/route.ts |

## Verification Results

- `grep "export async function GET"` — PASS
- `grep "email\|clerkId"` excluding comments/imports — no select-clause hits — PASS (T-03-03)
- `grep "userSearchSchema.safeParse"` — PASS
- `grep "ilike(users.username"` — PASS
- `grep "ilike(users.displayName"` — PASS
- `grep "ne(users.id, actorUserId)"` — PASS
- `grep ".limit(20)"` — PASS
- `grep "inArray(follows.followeeId, resultIds)"` — PASS
- `pnpm --filter web type-check` — PASS (exit 0)
- `pnpm --filter web test:unit` — social.test.ts: 13/13 PASS; 4 pre-existing failures in restaurants.test.ts + reviews.test.ts (logged in deferred-items.md, unrelated to this plan)

## Decisions Made

- Used explicit column list in SELECT to enforce T-03-03 (field exposure prevention) — not `SELECT *`
- Batch follow-state pattern (same as batch tag/restaurant fetch in reviews route) — avoids N+1 with two flat queries
- Self exclusion via `ne()` — consistent with standard search UX; actor never sees themselves in results
- ILIKE on nullable `displayName`: Drizzle's `ilike()` uses parameterized queries; NULL rows simply don't match (correct behavior per research Pitfall 5)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The endpoint is fully wired: auth, validation, DB query, follow-state enrichment, and response all implemented.

## Self-Check: PASSED

- `apps/web/app/api/v1/users/search/route.ts` — FOUND
- Commit c92d0db — FOUND
