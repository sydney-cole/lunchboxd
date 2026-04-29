---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-01-PLAN.md
last_updated: "2026-04-29T13:58:38.714Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 9
  completed_plans: 4
  percent: 100
---

# State: Lunchboxd

**Last updated:** 2026-04-28
**Session:** Execute phase 01-03

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 02 — reviews-meals

---

## Current Position

Phase: 02 (reviews-meals) — EXECUTING
Plan: 2 of 6
**Phase:** 2
**Status:** Ready to execute

```
Progress: [████░░░░░░] 44%
Phase 2 of 6 | Plan 1/6 complete
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | Complete |
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
- Clerk 7 mobile: signUp.create() returns { error: ClerkError | null } — no status/createdSessionId; navigate on absence of error
- Clerk 7 mobile forgot password: resetPasswordEmailCode() method via unknown cast — strategy:'reset_password_email_code' removed from signIn.create() in Clerk 7
- Mobile: @lunchboxd/shared workspace:* dependency must be explicitly added to apps/mobile/package.json — not auto-resolved
- reviewSchema uses z.number().multipleOf(0.5) for half-star rating validation (Zod v4 API)
- Partial unique index on restaurants.place_id allows multiple NULL rows (manual entries) while preventing duplicate Google Places IDs

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

Stopped at: Completed 02-01-PLAN.md
To resume: Run `/gsd:execute-phase` for Phase 02 — Reviews & Meals.

---
*State initialized: 2026-04-27*
