# Phase 5: Profiles - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers complete public user profiles: avatar (with R2 upload), bio, full review history, follower/following counts, and browsable follower/following lists. Any authenticated user can view any other user's profile without needing to follow them. The profile schema (`displayName`, `bio`, `avatarUrl`) and `userStats` table already exist — this phase builds the API endpoints, web pages, and mobile screens that surface them.

New capabilities (profile analytics, review bookmarking, blocking, settings/preferences) are NOT in scope.

</domain>

<decisions>
## Implementation Decisions

### Profile URL Structure
- **D-01:** Web profiles use `/@username` routing — e.g., `lunchboxd.com/@sarah`. This is the social-app convention (Twitter/Instagram style) and is the cleanest URL form.
- **D-02:** Own profile redirects: `/profile` → `/@<current-user-username>` (web). The Profile tab (mobile) renders the current user's own profile screen directly — not a hub/menu.
- **D-03:** Viewing another user's profile on mobile pushes a new `ProfileScreen('username')` onto the navigation stack. Feed card author names, search result user names, and follower/following list entries all link to `/@username` (web) or push `ProfileScreen` (mobile).

### Avatar Upload
- **D-04:** Avatars are stored in **Cloudflare R2** via the existing `POST /api/v1/uploads` endpoint — same pipeline as meal photos from Phase 2. No new upload infrastructure needed.
- **D-05:** After upload, the returned URL is saved via `PATCH /api/v1/users/me { avatarUrl }` — a new endpoint this phase adds.
- **D-06:** Users without an avatar show an **initial/letter avatar** — first letter of username in a colored circle. This pattern is already established in mobile FeedCard; use it consistently across web and mobile.

### Edit Profile UX
- **D-07:** Editing lives on a **separate `/profile/edit` page** (web) and a separate Edit Profile screen (mobile). The profile view page shows an [Edit Profile] button that navigates to the edit page/screen.
- **D-08:** The [Edit Profile] button is shown **only when viewing your own profile** (viewer's userId matches profile owner's userId). When viewing someone else's profile, show a [Follow] button instead (reuse the existing `FollowButton` component from Phase 3).
- **D-09:** The edit page/screen has two fields: **bio** (textarea) and **avatar** (upload). Display name editing is Claude's discretion — include it if `displayName` is already in the schema (it is), skip if it complicates the plan.

### Follower/Following Lists
- **D-10:** Tapping a follower/following count navigates to a **separate page/screen** (not a modal). Web routes: `/@username/followers` and `/@username/following`. Mobile: new `FollowersScreen` / `FollowingScreen` pushed onto the stack.
- **D-11:** Each list entry uses the **existing `UserSearchCard` component** (web) which already renders follow state and `FollowButton`. On mobile, use the same pattern as the user search screen. Zero new components needed for list items.

### Claude's Discretion
- Display name field on the edit page (include if straightforward given schema already has `displayName`)
- Review history pagination on profile — infinite scroll (reuse `useInfiniteQuery` pattern) or full list (simpler)
- Profile page layout ordering (avatar + bio + stats row + review list)
- Mobile `ProfileScreen` reuse — same component for own profile tab and pushed "other user" screen, parameterized by username

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, core value, constraints
- `.planning/REQUIREMENTS.md` — PROF-01 through PROF-06 are the requirements for this phase
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, dependency on Phase 3

### Schema & Queries
- `apps/web/lib/schema.ts` — `users` table: `displayName`, `bio`, `avatarUrl` already present; `userStats` table: `followerCount`, `followingCount`; `follows` and `friendships` tables for list queries
- `apps/web/lib/queries.ts` — `resolveUserId()` helper; fanout helpers (reference pattern, not used directly)

### Existing Upload Infrastructure
- `apps/web/app/api/v1/uploads/route.ts` — existing R2 upload endpoint; avatar upload reuses this exactly

### Existing API Routes (patterns to follow)
- `apps/web/app/api/v1/users/search/route.ts` — user SELECT field list (safe fields only: id, username, displayName, avatarUrl); follow-state enrichment pattern
- `apps/web/app/api/v1/follows/route.ts` — follow/unfollow API; used by FollowButton on profile page

### Existing UI Components (reuse)
- `apps/web/components/user-search-card.tsx` — `UserSearchCard` with `FollowButton`; reuse for follower/following list items
- `apps/web/components/review-card.tsx` — `ReviewCard` with `showAuthor` prop; reuse for profile review history (pass `showAuthor={false}`)
- `apps/mobile/app/(app)/(tabs)/search.tsx` — mobile user search screen pattern; mobile follower/following screens follow same structure
- `apps/mobile/app/(app)/(tabs)/profile.tsx` — current stub; replace with full ProfileScreen

### Auth Patterns
- `.planning/STATE.md` — All locked stack decisions; Clerk 7 auth patterns; `resolveUserId()` usage; mobile Bearer token pattern

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `POST /api/v1/uploads` — R2 upload endpoint; avatar upload is a drop-in use of this
- `UserSearchCard` + `FollowButton` — already renders follow state (none / following / friends); use directly in follower/following list pages
- `ReviewCard` with `showAuthor={false}` — already tested and shipped; use for profile review history section
- `userStats.followerCount` / `userStats.followingCount` — already maintained by Phase 3 follow/unfollow logic; just SELECT these fields for the profile stats row
- `resolveUserId()` in `apps/web/lib/queries.ts` — converts Clerk ID to internal UUID; required in all authed API routes

### Established Patterns
- API routes under `apps/web/app/api/v1/` — new endpoints: `GET /api/v1/users/[username]` (profile), `PATCH /api/v1/users/me` (edit), `GET /api/v1/users/[username]/followers`, `GET /api/v1/users/[username]/following`
- Web profile page: `apps/web/app/(app)/@[username]/page.tsx` — Next.js dynamic route with `@` prefix
- Clerk auth: `auth()` server-side in API routes; `useUser()` client-side to determine if viewer is profile owner
- Mobile Bearer token: `getToken()` inside `queryFn` (not at hook level) — matches all prior mobile API calls
- SELECT only safe user fields (id, username, displayName, avatarUrl) — never expose email or clerkId (established in Phase 3 user search)

### Integration Points
- Profile page → `GET /api/v1/users/[username]` returns `{ user, stats, reviews[] }`
- Profile edit → `PATCH /api/v1/users/me` updates bio / avatarUrl; preceded by `POST /api/v1/uploads` for avatar
- Follower/following lists → `GET /api/v1/users/[username]/followers` and `/following` — returns users[] enriched with followState (same enrichment as user search)
- `FollowButton` on others' profiles → existing `POST /api/v1/follows` route — no changes needed
- Mobile Profile tab → currently a stub in `apps/mobile/app/(app)/(tabs)/profile.tsx`; replace with real ProfileScreen

</code_context>

<specifics>
## Specific Ideas

- URL format `/@sarah` — chosen for social-app familiarity (Twitter/Instagram convention)
- Profile page layout: avatar (with letter fallback) + username + bio + stats row (N followers · N following) + review list below
- Stats row: "12 followers · 8 following" — each is a tappable link to `/@username/followers` or `/@username/following`
- Edit page: two fields (bio textarea + avatar upload), with [Save] that PATCHes `/api/v1/users/me`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-profiles*
*Context gathered: 2026-04-30*
