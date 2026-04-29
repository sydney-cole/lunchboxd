---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed 03-01: Social Graph Schema Foundation"
last_updated: "2026-04-29T19:50:52.493Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 16
  completed_plans: 11
  percent: 69
---

# State: Lunchboxd

**Last updated:** 2026-04-29
**Session:** Plan phase 03 — Social Graph (7 plans created) | Completed 03-02

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 03 — social-graph

---

## Current Position

Phase: 03 (social-graph) — EXECUTING
Plan: 2 of 7 (complete)
**Phase:** 3
**Status:** Executing — 2/7 plans complete

```
Progress: [███████░░░] 69%
Phase 3 of 6 | Plan 2/7 — IN PROGRESS
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | Complete |
| 2 | Reviews & Meals | Complete |
| 3 | Social Graph | Ready to execute (7 plans) |
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
- R2 client returns null when credentials missing, enabling graceful 503 response in upload endpoint (02-02)
- Restaurant search checks local DB cache before calling Google Places to minimize API costs (02-02)
- GOOGLE_PLACES_API_KEY has no NEXT_PUBLIC_ prefix — server-side only to prevent key exposure (02-02)
- aria-expanded on autocomplete input typed as explicit boolean (not string|boolean|null) per React InputHTMLAttributes — showDropdown variable must be typed as boolean (02-04)
- ReviewComposer edit mode: initialData.restaurantId provides ID only; restaurant name not resolved on load — future edit page must fetch restaurant by ID to populate display name (02-04)
- QueryProvider added at root layout level to enable TanStack Query across all client pages (02-05)
- Edit page fetches all reviews and filters by ID since no single-review GET endpoint exists (02-05)
- Mobile star rating uses Text character stars (★) not react-native-svg — avoids native module dependency (02-06)
- Mobile API calls use Clerk getToken() Bearer header — no cookies on mobile; Next.js auth() reads both (02-06)
- Mobile RestaurantSearch dropdown is a ScrollView below input (not floating) to avoid z-index issues (02-06)
- friendshipsUniqueIdx uses pgTable callback API (same pattern as followsUniqueIdx) — enables .onConflictDoNothing() on duplicate friendship rows (03-01)
- userSearchSchema adds max(100) bound beyond restaurantSearchSchema for input sanitization per threat model T-03-04 (03-01)
- unfollowSchema defined as separate schema from followSchema for independent evolution and import clarity (03-01)
- No db.transaction() in follows API — Neon HTTP adapter sequential operations only (03-02)
- Friendship cleanup checks both (A,B) and (B,A) direction on unfollow — ordering convention not enforced (03-02)
- Feed cleanup on unfollow uses two-step query — Drizzle does not support DELETE WHERE IN subquery (03-02)
- GREATEST(count - 1, 0) floors userStats decrements at zero to prevent negative counts (03-02)

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

Stopped at: Completed 03-02: Follow/Unfollow API
To resume: Run `/gsd:execute-phase` for Phase 03 — Social Graph.

---
*State initialized: 2026-04-27*
