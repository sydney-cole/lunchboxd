# State: Lunchboxd

**Last updated:** 2026-04-27
**Session:** Roadmap creation

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 1 — Auth & Foundation

---

## Current Position

**Phase:** 1 — Auth & Foundation
**Plan:** None started
**Status:** Not started

```
Progress: [          ] 0%
Phase 1 of 6
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | Not started |
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

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

To resume: read ROADMAP.md for phase structure, then run `/gsd:plan-phase 1` to begin Phase 1 planning.

---
*State initialized: 2026-04-27*
