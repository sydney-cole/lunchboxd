---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-04-28T18:50:00Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
---

# State: Lunchboxd

**Last updated:** 2026-04-28
**Session:** Execute phase 01-02

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 01 — auth-foundation

---

## Current Position

Phase: 01 (auth-foundation) — EXECUTING
Plan: 3 of 3
**Phase:** 1 — Auth & Foundation
**Plan:** 02 complete, moving to 03
**Status:** Executing Phase 01

```
Progress: [███░░░░░░░] 67%
Phase 1 of 6 | Plan 2/3 complete
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | In Progress |
| 2 | Reviews & Meals | Not started |
| 3 | Social Graph | Not started |
| 4 | Feed | Not started |
| 5 | Profiles | Not started |
| 6 | Notifications & Location | Not started |

---

## Stack Decisions (Locked)

| Layer | Decision |
|-------|----------|
| Web + API | Next.js 16 |
| Mobile | Expo (managed workflow) |
| Auth | Clerk |
| ORM | Drizzle |
| Database | Neon (Postgres) |
| Photo storage | Cloudflare R2 |
| Restaurant search | Google Places autocomplete |
| Feed architecture | Fan-out-on-write (feed_items table) |

---

## Accumulated Context

### Key Decisions

- Feed must use fan-out-on-write architecture with a `feed_items` table — this is non-negotiable per research
- Photo resize pipeline ships with photo upload in Phase 2 (not deferred)
- Restaurant model: `place_id` is nullable; manual entries are first-class (not a fallback hack)
- Social model uses separate `follows` and `friendships` tables; mutual follows are detected, not stored redundantly
- Platforms share a single API — Next.js API routes serve both web and Expo mobile
- drizzle-kit 0.31.10: use pgTable callback API for indices — standalone index() exports are incompatible with bundled pg-core
- feedItemsOwnerIdx is a single-column index on ownerUserId (compound with createdAt triggers drizzle-kit JSON parse bug)
- Clerk 7 uses SignalValue Future API — useSignIn() returns { signIn: SignInFutureResource }; flow is create→password→finalize instead of old create→setActive; Google OAuth via clerk.client.signIn.authenticateWithRedirect()
- Next.js 16: headers() is async — must await it in webhook handlers and server functions

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

Stopped at: Completed 01-auth-foundation/01-02-PLAN.md
To resume: Run `/gsd:execute-phase` for phase 01, plan 03 (mobile auth screens).

---
*State initialized: 2026-04-27*
