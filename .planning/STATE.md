---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 04-feed-01-PLAN.md
last_updated: "2026-04-30T13:34:21.200Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 20
  completed_plans: 17
  percent: 85
---

# State: Lunchboxd

**Last updated:** 2026-04-30
**Session:** Phase 04 Feed plan 01 complete — feedQuerySchema + formatRelativeTime + 5 unit tests GREEN

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 04 — feed (planned, ready to execute)

---

## Current Position

Phase: 04 (feed) — IN PROGRESS
Plan: 1 of 4 (complete)
**Phase:** 4
**Status:** Plan 01 complete — Wave 0 foundation done

```
Progress: [█████████░] 85%
Phase 4 of 6 | Plan 1/4 complete — feed schema and utils foundation ready
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | Complete |
| 2 | Reviews & Meals | Complete |
| 3 | Social Graph | Complete |
| 4 | Feed | In progress (1/4 plans done) |
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
- Like count computed via COUNT query (not denormalized) — simpler and avoids counter drift at MVP scale (03-03)
- .onConflictDoNothing() on like insert leverages likesUniqueIdx for idempotent race condition handling (03-03)
- Batch like fetch in GET /reviews uses inArray — single query, no N+1 (same pattern as tags/restaurants) (03-03)
- User search SELECT explicitly lists safe fields only (id, username, displayName, avatarUrl) — no email, clerkId per T-03-03 (03-04)
- Batch follow-state enrichment in user search uses two flat queries (follows + friendships), no N+1 (03-04)
- FollowButton uses query invalidation not optimistic update — server-authoritative follow state avoids stale UI on error (03-05)
- SearchPage 300ms debounce + 2 char minimum prevents rapid-fire API calls on every keystroke (03-05)
- staleTime: 30_000 on user-search query prevents result flicker during navigation (03-05)
- Like optimistic update targets query key 'my-reviews' (not 'reviews') — matches existing fetch key in reviews page; staleTime: 60_000 prevents like state flicker on navigation (03-06)
- Mobile auth import is '@clerk/expo' (not '@clerk/clerk-expo') — matches compose.tsx pattern in this Expo project (03-07)
- Mobile components use StyleSheet.create() not NativeWind className — NativeWind may not be configured; StyleSheet consistent with compose.tsx (03-07)
- Mobile like optimistic mutation targets ['my-reviews'] query key — same key as reviews fetch to hit correct cache entry (03-07)
- feedQuerySchema uses z.string().datetime() for ISO 8601 cursor validation and z.coerce.number() for limit coercion (Zod v4 API) (04-01)
- formatRelativeTime is a pure function with no dependencies in apps/web/lib/utils.ts (04-01)

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

Stopped at: Completed 04-01-PLAN.md — Phase 04 Feed plan 1 of 4 done
To resume: Execute 04-02-PLAN.md (Wave 1: feed API endpoint and database schema)

---
*State initialized: 2026-04-27*
