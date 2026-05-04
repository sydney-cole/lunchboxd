---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 06 Plan 05 complete
last_updated: "2026-05-04T16:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 31
  completed_plans: 31
  percent: 100
---

# State: Lunchboxd

**Last updated:** 2026-05-04
**Session:** Phase 06 Plan 05 complete — mobile NotificationsScreen (FlatList + infinite scroll + read-all on mount), bell icon in Profile tab header (Ionicons + unread polling), MapScreen (react-native-maps MapView with social pin coloring + searchable list panel), Search tab Map button. Phase 6 and v1.0 milestone fully complete.

---

## Project Reference

**Core value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

**Current focus:** Phase 06 — notifications & location

---

## Current Position

Phase: 06 (notifications-location) — COMPLETE
Plan: 5 of 5
Plans: 5/5 planned (Wave 1: 06-01 | Wave 2: 06-02, 06-03 | Wave 3: 06-04, 06-05)
**Status:** All plans complete — v1.0 milestone achieved

```
Progress: [██████████] 100%
Phase 6 of 6 | 5/5 plans complete — v1.0 milestone complete
```

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Auth & Foundation | Complete |
| 2 | Reviews & Meals | Complete |
| 3 | Social Graph | Complete |
| 4 | Feed | Complete |
| 5 | Profiles | Complete |
| 6 | Notifications & Location | Complete |

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
- Feed API orders by feedItems.createdAt DESC not reviews.createdAt — preserves fan-out ordering correctness (04-02)
- Cursor wraps new Date(cursor) in lt() — raw string comparison fails for timestamp columns in Drizzle (04-02)
- limit+1 fetch trick detects hasMore without COUNT query — one fewer DB round-trip per request (04-02)
- isOwnReview field included in feed items for conditional kebab menu rendering in feed UI (04-02)
- Author fields limited to username + avatarUrl only — no email or clerkId exposed (security, 04-02)
- showAuthor prop is optional — existing reviews page backward compatible; isOwnReview undefined shows kebab, false hides it (04-03)
- Feed like mutation targets ['feed'] InfiniteData pages structure — separate cache from ['my-reviews'] flat array (04-03)
- initialPageParam: null as string | null — TanStack Query v5 compliance for useInfiniteQuery (04-03)
- app/page.tsx scaffold deleted — Next.js App Router serves app/(app)/page.tsx at / via route group (04-03)
- Mobile feed uses FlatList (not ScrollView) for virtualization — required for large feed lists (04-04)
- Mobile like mutation targets ['feed'] InfiniteData pages structure (not ['my-reviews'] flat array) (04-04)
- formatRelativeTime hand-rolled inline in index.tsx — mirrors web util without requiring shared package import (04-04)
- Apostrophes in React Native JSX use {'...'} expression syntax, not HTML &apos; entities (04-04)
- avatarKey regex allows both avatars/ and reviews/ prefixes so users can set a review photo as their avatar (05-01)
- profileQuerySchema mirrors feedQuerySchema — same cursor pagination contract for consistency across profile endpoints (05-01)
- Upload type param defaults to 'review' — backward compatible with all existing upload calls (05-01)
- Viewer userId resolved lazily inside enrichment block — skipped entirely for unauthenticated public profile requests (05-02)
- avatarKey ownership enforced at PATCH handler by matching clerkId segment [1] against auth() session clerkId (05-02)
- Stats default to { followerCount: '0', followingCount: '0', reviewCount: '0' } when no userStats row exists for new users (05-02)
- Follower/following lists are public (no auth required) per PROF-06; followState enrichment only runs when viewer is authenticated (05-03)
- proxy.ts merged /@username rewrite with existing Clerk auth middleware — single file handles both URL rewrite and auth protection (05-03)
- profile/page.tsx uses static segment priority over [username] dynamic segment in Next.js App Router (05-03)
- Profile page is a single Client Component — avoids RSC streaming complexity; isOwner check via Clerk JWT-verified username comparison (D-08) (05-04)
- Like mutation on profile page targets ['profile-reviews', username] — separate cache from ['feed'] and ['my-reviews'] to prevent cross-page cache corruption (05-04)
- React.use(params) used in followers/following Client Components for async params unwrap (Next.js 16 pattern) (05-04)
- notFound() not callable in Client Components — rendered as custom 404 UI matching UI-SPEC copywriting (05-04)
- Edit profile page at /profile/edit is a single Client Component — no RSC split needed for this form-only page (05-05)
- Avatar upload on edit page completes eagerly on file select; key stored in state and sent with PATCH /api/v1/users/me (05-05)
- ProfileContent exported from [username].tsx and imported by own-profile tab — single implementation for both contexts (05-06)
- Mobile like mutation on profile page targets ['profile-reviews', username] — separate cache from ['feed'] and ['my-reviews'] (05-06)
- Avatar upload on mobile: expo-image-picker + POST /api/v1/uploads (type: avatar) + PUT to R2 presigned URL (05-06)
- notificationQuerySchema mirrors feedQuerySchema exactly — same cursor+limit contract for consistency (06-01)
- restaurantReviewedQuerySchema uses optional q with max(100) to bound ILIKE query size before parameterization (06-01)
- shouldSkipNotification and computeReviewedByFollowed tested as pure functions in Wave 0 — no DB dependency (06-01)
- Notification INSERT in follows route placed after follow INSERT and before reverse-follow check — ordering ensures notification only fires if follow succeeded (06-02)
- Like notification requires SELECT reviews.userId before INSERT — single-row SELECT in else branch only (06-02)
- actorId always sourced from resolveUserId(clerkId), never request body — enforced in notification INSERTs in both follows and likes routes (06-02, T-06-02-04)
- lat/lng returned as TypeScript string (Drizzle numeric type contract) — UI components call parseFloat() before passing to map coordinates (06-03)
- null lat/lng restaurants included in /reviewed but excluded from /map — per D-11; they appear in list only, not on map (06-03)
- restaurantReviewedQuerySchema validates q param (max 100) before ILIKE — prevents unbounded query size (06-03, T-06-03-02)
- reviewedByFollowed computed server-side from authenticated user's follows — never from client-supplied data (06-03, T-06-03-01)
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is browser-exposed by Maps JS API design — separate from server-only GOOGLE_PLACES_API_KEY; must be restricted by HTTP referrer in Cloud Console (06-04, T-06-04-01)
- mapId on Map component required for AdvancedMarker rendering — falls back to 'DEMO_MAP_ID' literal if NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID not set (06-04)
- parseFloat() on lat/lng is mandatory before passing to AdvancedMarker position — Drizzle numeric returns string, @vis.gl/react-google-maps expects number (06-04)
- NotificationBell useInfiniteQuery panel list is enabled only when isOpen — avoids fetching before panel opened (06-04)
- document.title set via useEffect in 'use client' map page — metadata export is not valid in Client Components (06-04)
- react-native-maps plugin added to app.json — EAS dev build rebuild required before map screen can be tested on device (06-05)
- Platform.OS check on PROVIDER_GOOGLE — Android uses Google Maps, iOS falls back to Apple Maps default (no iosGoogleMapsApiKey needed) (06-05)
- Mobile bell uses Ionicons from @expo/vector-icons (already installed) instead of lucide-react-native — avoids new native dependency (06-05)
- read-all PATCH fires on mount in mobile NotificationsScreen; queryClient.invalidateQueries(['notifications-unread']) clears bell badge immediately (06-05)
- androidGoogleMapsApiKey in app.json uses placeholder — production key should be injected via EAS secrets, not committed (06-05, T-06-05-02)

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

Stopped at: Phase 06 Plan 05 complete — v1.0 milestone achieved
All 31 plans across 6 phases complete. All 33 v1 requirements implemented. EAS rebuild required to activate react-native-maps on device.

---
*State initialized: 2026-04-27*
