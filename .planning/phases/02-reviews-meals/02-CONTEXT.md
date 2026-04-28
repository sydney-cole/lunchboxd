# Phase 2: Reviews & Meals - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the complete meal review creation experience: a user can write a review with a half-star rating, written note, photo, free-text mood tags, custom meal date, and a restaurant association (searched via Google Places, manually entered, or tagged as homemade). Users can also edit and delete their own reviews. After posting, the user lands on their own review list.

New capabilities (feed, social graph, profiles) are NOT in scope here. The review list is a minimal "my reviews" view — Phase 5 builds the full profile on top of it.

</domain>

<decisions>
## Implementation Decisions

### Composer Flow
- **D-01:** Single full-page scrollable form — all fields on one screen (meal type toggle, rating, note, restaurant search, photo, tags, date). No multi-step wizard.
- **D-02:** Entry point is a floating action button (FAB) — persistent `+` in bottom-right corner, visible on the main screen. Always accessible.

### Meal Type & Restaurant Search
- **D-03:** Meal type toggle shown upfront at the top of the form — user picks "Restaurant" or "Homemade" before anything else. Controls which fields appear below.
- **D-04:** Restaurant search is inline autocomplete — a search field on the form, results drop down in real time via Google Places API. No separate search screen or modal.
- **D-05:** "Add manually" option appears only after search returns no results — not always visible. Manual entries are saved as first-class `restaurants` records with `source: 'manual'` and `place_id: null`.
- **D-06:** Homemade meal toggle hides the restaurant search field entirely. `restaurantId` is null and `mealType` is `'homemade'` on the review record.

### Mood Tags
- **D-07:** Free-text tag input — user types their own tags, not a predefined list. Tags are saved to the `review_tags` table with the user's exact text as `label`.
- **D-08:** Unlimited tags allowed.

### Post-Submit Landing
- **D-09:** After posting, user lands on their own review list — a minimal reverse-chronological list of their reviews. This view persists and becomes the base for the Phase 5 profile page.

### Schema Addition Required
- **D-10:** The `reviews` table is missing a `meal_date` column (required for REVW-05). A migration must add `meal_date date` (nullable, defaults to today) before Phase 2 plans run. This is the only schema change in this phase — all other tables were laid down in Phase 1.

### Claude's Discretion
- Half-star rating UI component design (star picker or slider)
- Photo upload timing (on-select preview vs. upload-on-submit)
- Cloudflare R2 upload flow (presigned URL vs. server proxy)
- Form validation approach and error display patterns (follow Phase 1 patterns)
- Review list card layout and information density
- Empty state for review list (new user with no reviews yet)
- Edit flow (inline edit vs. navigate to edit page)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — REVW-01–07 and MEAL-01–03 are the requirements for this phase
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/STATE.md` — Stack decisions locked; Clerk 7 API notes; drizzle-kit index pattern

### Phase 1 Artifacts
- `.planning/phases/01-auth-foundation/01-CONTEXT.md` — Phase 1 decisions, especially D-05/D-06 (schema design rules: `place_id` nullable, `deleted_at` soft-delete)
- `.planning/phases/01-auth-foundation/01-01-SUMMARY.md` — What was built in monorepo scaffold; confirms schema tables exist

### Research
- `.planning/research/STACK.md` — Cloudflare R2 setup, Google Places API details
- `.planning/research/ARCHITECTURE.md` — Fan-out-on-write feed architecture; review → feed_items write path starts in this phase
- `.planning/research/PITFALLS.md` — Known pitfalls relevant to photo upload, API key exposure, Google Places quota

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/db.ts` — Drizzle db instance, ready to use in new API routes
- `apps/web/lib/schema.ts` — `reviews`, `restaurants`, `review_tags`, `feed_items` tables already defined
- `apps/web/components/auth-card.tsx` — Auth card wrapper pattern; review form will need its own layout component
- `packages/shared/src/schemas/index.ts` — Zod schemas (signUpSchema etc.); add reviewSchema here for shared client/server validation
- `packages/shared/src/types/index.ts` — `Review`, `Restaurant`, `User` types already defined

### Established Patterns
- API routes live under `apps/web/app/api/v1/` — all new review/restaurant endpoints follow this prefix
- Clerk auth: use `auth()` server-side in API routes to get `userId`; `useUser()` client-side for the current user
- Drizzle inserts: use `.onConflictDoUpdate()` pattern established in webhook handler for upserts
- drizzle-kit index pattern: use pgTable callback API (not standalone `index()` exports)
- Environment variables: `process.env.X` in server code; `NEXT_PUBLIC_X` for client-accessible vars

### Integration Points
- New review API routes (`POST /api/v1/reviews`, `PATCH /api/v1/reviews/:id`, `DELETE /api/v1/reviews/:id`) connect to the existing Drizzle schema
- Fan-out-on-write: when a review is created, write a `feed_items` row for each follower — this starts in Phase 2 even though the feed UI is Phase 4
- Google Places API calls should be proxied through a Next.js API route to avoid exposing the API key client-side
- Cloudflare R2: presigned URL flow recommended — client uploads directly to R2, server only issues the URL
- Review list page at `/reviews` (or similar) becomes the post-submit landing; Phase 5 profile wraps around it

</code_context>

<specifics>
## Specific Ideas

- Meal type toggle is the first thing on the form — gates the rest of the UX
- "Add manually" only appears after a Google Places search returns no results (not always shown)
- Tags are free-text, not from a predefined list — save as-is to `review_tags.label`
- Post-submit destination: user's own review list (minimal for now, full profile in Phase 5)
- The review list doubles as the app home screen until Phase 4 ships the real feed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-reviews-meals*
*Context gathered: 2026-04-28*
