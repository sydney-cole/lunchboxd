# Phase 3: Social Graph - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the social interaction primitives: follow/unfollow, mutual friendship detection and display, review likes with optimistic UI, and user search. These are the data and API layer that Phase 4 (Feed) and Phase 5 (Profiles) depend on.

New capabilities (feed display, full profile pages, notifications) are NOT in scope. Profile pages do not exist in this phase — the only surface for social actions is the user search page.

</domain>

<decisions>
## Implementation Decisions

### Follow UX
- **D-01:** Follow button appears in user search results only. No profile stub, no follow button on ReviewCard. Phase 5 adds follow to profiles.
- **D-02:** User search lives on a dedicated `/search` page (web) with an equivalent tab in mobile (Expo Router tab or stack screen). Simple text input; results appear below.
- **D-03:** Search result card shows: avatar + username + Follow/Following/Friends button. No review count or bio in Phase 3.

### Follow / Unfollow Behavior
- **D-04:** On follow: INSERT into `follows` table; check if followee already follows back — if yes, INSERT into `friendships` table. `userStats.followerCount` and `followingCount` increment for both users immediately.
- **D-05:** On unfollow: DELETE from `follows`; also DELETE from `friendships` if a friendship row exists. DELETE from `feed_items` where `owner_user_id = actor` and `review_id` belongs to the unfollowed user. `userStats` counts decrement.
- **D-06:** No backfill on follow — only future reviews from the newly followed user appear in the actor's feed. Fan-out-on-write in the review POST path (already in Phase 2) handles new reviews going forward.

### Mutual Friendship Display
- **D-07:** Follow button has three states: "Follow" (not following), "Following" (following but not mutual), "Friends" (mutual follow). Label change is the only UI treatment — no badge or icon.
- **D-08:** `friendships` table is written on follow (D-04) and cleaned up on unfollow (D-05). Mutuality is not derived at query time; it reads from the friendships table directly.

### Likes
- **D-09:** Like button (heart icon + count) appears on `ReviewCard` on both web and mobile. Not on a detail page — no detail page exists in Phase 3.
- **D-10:** Optimistic UI for likes — click/tap toggles the like state and increments/decrements the count instantly on the client. API call fires async; on error, roll back to previous state. No polling or SSE.
- **D-11:** Like is a toggle — if user has already liked, the same action unlikes (DELETE from `likes`). If not liked, INSERT.

### Claude's Discretion
- Search debounce timing and minimum character threshold for triggering search
- Like button visual design (filled vs outline heart, animation on tap)
- Error rollback UX on failed like (toast, silent revert, or retry)
- Mobile search: tab bar icon placement and search input behavior
- `userStats` update strategy: direct UPDATE in the same transaction or async increment (Claude picks what fits the Drizzle pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, constraints, core value
- `.planning/REQUIREMENTS.md` — SOCL-01 through SOCL-05 are the requirements for this phase
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and dependency on Phase 2
- `.planning/STATE.md` — Stack decisions locked; Clerk 7 API notes; drizzle-kit index pattern; accumulated context from Phases 1 and 2

### Prior Phase Artifacts
- `.planning/phases/02-reviews-meals/02-CONTEXT.md` — Fan-out-on-write pattern (review POST writes feed_items); API route conventions; Clerk auth pattern
- `.planning/phases/02-reviews-meals/02-03-PLAN.md` — Review CRUD API route implementation; fan-out-on-write code to extend for follow events

### Schema
- `apps/web/lib/schema.ts` — `follows`, `friendships`, `likes`, `userStats`, `feedItems`, `notifications` tables all already exist; no schema migration needed in this phase

### Research (Phase 2)
- `.planning/research/ARCHITECTURE.md` — Fan-out-on-write architecture; feed_items write path; follow event should NOT write feed_items (no backfill per D-06), only new review POSTs do
- `.planning/research/PITFALLS.md` — Drizzle index patterns; API key exposure; relevant pitfalls for social graph queries

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/schema.ts` — `follows`, `friendships`, `likes`, `userStats` tables already defined with correct indices; no migration needed
- `apps/web/lib/db.ts` — Drizzle db instance, ready for new social API routes
- `apps/web/components/` — ReviewCard exists from Phase 2; add like button to it
- `packages/shared/src/types/index.ts` — `User` type already defined; extend with follow state fields

### Established Patterns
- API routes under `apps/web/app/api/v1/` — new social endpoints follow this prefix (`/api/v1/follows`, `/api/v1/likes`, `/api/v1/users/search`)
- Clerk auth: `auth()` server-side in API routes to get `userId`; `useUser()` client-side
- Drizzle inserts: `.onConflictDoUpdate()` for upsert patterns; `.onConflictDoNothing()` for idempotent follow/like inserts
- drizzle-kit index pattern: pgTable callback API (not standalone `index()` exports)
- Mobile API calls: Clerk `getToken()` Bearer header (no cookies on mobile)
- `userStats` table tracks `followerCount` / `followingCount` — must be updated atomically with follow/unfollow writes

### Integration Points
- Follow API (`POST /api/v1/follows`, `DELETE /api/v1/follows`) → writes `follows`, conditionally `friendships`, updates `userStats`
- Unfollow → additionally deletes from `feed_items` (WHERE owner_user_id = actor AND review belongs to unfollowed user)
- Like API (`POST /api/v1/likes`, `DELETE /api/v1/likes`) → writes/deletes `likes` row; like count surfaced via COUNT on query or denormalized field
- User search (`GET /api/v1/users/search?q=`) → searches `users.username` and `users.display_name`; returns avatar, username, and caller's follow state for each result
- ReviewCard (web + mobile) → add `likeCount` and `isLikedByMe` fields to review query; add like button component

</code_context>

<specifics>
## Specific Ideas

- Three-state follow button: "Follow" → "Following" → "Friends" (label-only, no icon change)
- Unfollow removes that user's reviews from feed_items (clean break, not leave-in-place)
- No backfill on follow — fresh start, only new reviews appear
- Like is a toggle on the same button — filled heart = liked, outline = not liked
- Search is dedicated page, not global nav search bar

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-social-graph*
*Context gathered: 2026-04-29*
