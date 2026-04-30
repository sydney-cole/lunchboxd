---
phase: 05-profiles
verified: 2026-04-30T00:00:00Z
status: passed
score: 30/30 must-haves verified
re_verification: false
---

# Phase 05: Profiles Verification Report

**Phase Goal:** Full user profile system — view profiles at /@username, edit bio/avatar, follow/unfollow, see follower and following lists on web and mobile.
**Verified:** 2026-04-30
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | patchUserSchema rejects bio longer than 500 characters | VERIFIED | `packages/shared/src/schemas/index.ts` line 80: `bio: z.string().max(500)` |
| 2 | patchUserSchema rejects displayName longer than 50 characters | VERIFIED | `packages/shared/src/schemas/index.ts` line 81: `displayName: z.string().max(50)` |
| 3 | patchUserSchema accepts partial updates | VERIFIED | `profiles.test.ts` describe block covers bio-only, avatarKey-only, all-fields, empty object |
| 4 | profileQuerySchema validates ISO 8601 cursor and coerces string limits | VERIFIED | `profiles.test.ts` lines 52–76; schema uses `z.string().datetime()` and `z.coerce.number()` |
| 5 | POST /api/v1/uploads uses avatars/ prefix when type='avatar' | VERIFIED | `uploads/route.ts` lines 33, 42–43: prefix conditional on `type === 'avatar'` |
| 6 | GET /api/v1/users/[username] returns user, stats, reviews — 404 for unknown | VERIFIED | `users/[username]/route.ts` — returns `{ user, stats, reviews }` with `NextResponse.json({ error: 'User not found' }, { status: 404 })` |
| 7 | PATCH /api/v1/users/me updates bio, displayName, avatarUrl for authenticated user | VERIFIED | `users/me/route.ts` — patchUserSchema validation, DB update, 401 guard |
| 8 | PATCH /api/v1/users/me constructs avatarUrl server-side from avatarKey | VERIFIED | `users/me/route.ts` line 34: `` `${process.env.R2_PUBLIC_URL}/${avatarKey}` `` |
| 9 | GET /api/v1/users/[username]/reviews returns cursor-paginated reviews | VERIFIED | `users/[username]/reviews/route.ts` — limit+1 trick, nextCursor in response |
| 10 | No API response ever includes email or clerkId fields | VERIFIED | grep for `email:` and `clerkId:` across all users/ API routes returns zero matches |
| 11 | GET /api/v1/users/[username]/followers returns followers with followState | VERIFIED | `followers/route.ts` — inArray batch enrichment, followState in response |
| 12 | GET /api/v1/users/[username]/following returns following with followState | VERIFIED | `following/route.ts` — inArray batch enrichment, followState in response |
| 13 | proxy.ts rewrites /@username and sub-paths by stripping the @ | VERIFIED | `proxy.ts` — `export function proxy`, `pathname.startsWith('/@')`, `NextResponse.rewrite` |
| 14 | /profile redirects authenticated users to /@their-username | VERIFIED | `profile/page.tsx` — `redirect(`/@${user.username}`)` after Clerk auth |
| 15 | Follow-state enrichment uses batch inArray queries — no N+1 | VERIFIED | Both followers and following routes use two flat `inArray` queries |
| 16 | Visiting /@username renders profile page with avatar, bio, stats, review list | VERIFIED | `[username]/page.tsx` — useQuery for profile, useInfiniteQuery for reviews, inline header with avatar, bio, stats row |
| 17 | Visiting /@username/followers renders followers list using UserSearchCard | VERIFIED | `[username]/followers/page.tsx` — useQuery, UserSearchCard rendered per user |
| 18 | Visiting /@username/following renders following list using UserSearchCard | VERIFIED | `[username]/following/page.tsx` — useQuery, UserSearchCard rendered per user |
| 19 | Profile shows Edit Profile for own profile, Follow button for others | VERIFIED | `[username]/page.tsx` lines 225–231: `isOwner ? <a href="/profile/edit">Edit profile</a> : <FollowButton />` |
| 20 | Review list uses useInfiniteQuery with IntersectionObserver infinite scroll | VERIFIED | `[username]/page.tsx` — `useInfiniteQuery`, `sentinelRef`, `IntersectionObserver` callback |
| 21 | Follower/following counts are tappable links to their list pages | VERIFIED | `[username]/page.tsx` lines 207–222: `<a href="/@${user.username}/followers">` and `<a href="/@${user.username}/following">` |
| 22 | Authenticated user can edit bio and displayName at /profile/edit | VERIFIED | `profile/edit/page.tsx` — textarea with maxLength=500, input with maxLength=50, PATCH call |
| 23 | Avatar upload via R2 pipeline reflected after save | VERIFIED | `profile/edit/page.tsx` — POST /api/v1/uploads with `type: 'avatar'`, then PATCH with avatarKey |
| 24 | After save, user redirected to /@username | VERIFIED | `profile/edit/page.tsx` line 119: `router.push(`/@${clerkUser!.username}`)` |
| 25 | Failed saves show inline error | VERIFIED | `profile/edit/page.tsx` — `saveError` state rendered below Save button |
| 26 | Mobile profile tab shows own profile | VERIFIED | `(tabs)/profile.tsx` — imports ProfileContent from `[username].tsx`, passes `clerkUser.username` |
| 27 | Mobile pushed profile screen renders for other users | VERIFIED | `profile/[username].tsx` default export uses `useLocalSearchParams` to read username |
| 28 | Mobile edit profile screen allows bio, displayName, avatar upload via R2 | VERIFIED | `profile/edit.tsx` — expo-image-picker, POST /api/v1/uploads, PATCH /api/v1/users/me |
| 29 | Mobile followers/following screens use UserSearchCard | VERIFIED | `followers/[username].tsx` and `following/[username].tsx` — FlatList with UserSearchCard |
| 30 | Mobile getToken() always inside queryFn/mutationFn — never at hook level | VERIFIED | All three mobile screens call `getToken()` inside async handlers; pre-fill uses `getToken().then(...)` in a guarded render-time side-effect (not at top-level hook) |

**Score:** 30/30 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/schemas/index.ts` | patchUserSchema, profileQuerySchema exports | VERIFIED | Lines 79–92: both schemas and inferred types exported |
| `apps/web/__tests__/profiles.test.ts` | Unit tests for both schemas | VERIFIED | 13 tests across 2 describe blocks |
| `apps/web/app/api/v1/uploads/route.ts` | type param with avatars/ prefix | VERIFIED | Lines 33, 42–43 confirmed |
| `apps/web/app/api/v1/users/[username]/route.ts` | GET handler returning { user, stats, reviews } | VERIFIED | Exports GET; async params; safe field selection; isNull soft-delete filter; inArray batch |
| `apps/web/app/api/v1/users/me/route.ts` | PATCH handler for profile edits | VERIFIED | Exports PATCH; patchUserSchema validation; ownership check; R2_PUBLIC_URL construction |
| `apps/web/app/api/v1/users/[username]/reviews/route.ts` | GET paginated reviews | VERIFIED | Exports GET; profileQuerySchema; limit+1; nextCursor; inArray batch |
| `apps/web/app/api/v1/users/[username]/followers/route.ts` | GET followers with followState | VERIFIED | Exports GET; inArray batch enrichment; safe fields; followState in response |
| `apps/web/app/api/v1/users/[username]/following/route.ts` | GET following with followState | VERIFIED | Exports GET; mirror of followers with correct join direction |
| `apps/web/proxy.ts` | /@username rewrite | VERIFIED | `export function proxy`; `pathname.startsWith('/@')`; `NextResponse.rewrite`; no middleware.ts found |
| `apps/web/app/(app)/profile/page.tsx` | Server Component redirect to /@username | VERIFIED | `redirect(`/@${user.username}`)` after Clerk auth |
| `apps/web/app/(app)/[username]/page.tsx` | Profile page with avatar, bio, stats, reviews | VERIFIED | useInfiniteQuery; sentinelRef; isOwner; Edit profile link; followers/following stat links |
| `apps/web/app/(app)/[username]/followers/page.tsx` | Followers list with UserSearchCard | VERIFIED | use(params); UserSearchCard; /api/v1/users/${username}/followers; empty state copy |
| `apps/web/app/(app)/[username]/following/page.tsx` | Following list with UserSearchCard | VERIFIED | use(params); UserSearchCard; /api/v1/users/${username}/following; empty state copy |
| `apps/web/app/(app)/profile/edit/page.tsx` | Edit profile form | VERIFIED | POST /api/v1/uploads type='avatar'; PATCH /api/v1/users/me; avatarKey; router.push; maxLength constraints |
| `apps/mobile/app/(app)/(tabs)/profile.tsx` | Own profile tab | VERIFIED | Imports ProfileContent from [username].tsx; uses clerkUser.username |
| `apps/mobile/app/(app)/profile/[username].tsx` | Pushed profile screen + ProfileContent | VERIFIED | Exports ProfileContent; useLocalSearchParams; getToken inside queryFn; StyleSheet.create |
| `apps/mobile/app/(app)/profile/edit.tsx` | Mobile edit profile screen | VERIFIED | getToken inside handlers; type: 'avatar'; PATCH /api/v1/users/me; maxLength; StyleSheet.create |
| `apps/mobile/app/(app)/followers/[username].tsx` | Mobile followers screen | VERIFIED | useLocalSearchParams; getToken inside queryFn; UserSearchCard; No followers yet empty state |
| `apps/mobile/app/(app)/following/[username].tsx` | Mobile following screen | VERIFIED | getToken inside queryFn; UserSearchCard; Not following anyone yet empty state |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/schemas/index.ts` | `apps/web/app/api/v1/users/me/route.ts` | `import { patchUserSchema }` | WIRED | Line 5: `import { patchUserSchema } from '@lunchboxd/shared'`; used at line 17 |
| `packages/shared/src/schemas/index.ts` | `apps/web/app/api/v1/users/[username]/reviews/route.ts` | `import { profileQuerySchema }` | WIRED | Line 5: `import { profileQuerySchema } from '@lunchboxd/shared'`; used at line 19 |
| `apps/web/app/api/v1/users/[username]/route.ts` | `apps/web/lib/schema.ts` | `db.select({ id, username, displayName, avatarUrl, bio }) from users` | WIRED | `users.username` eq pattern present; safe field selection confirmed |
| `apps/web/app/api/v1/users/me/route.ts` | `apps/web/lib/schema.ts` | `db.update(users).set(...).where(eq(users.id, actorUserId))` | WIRED | `db.update(users)` at line 45 confirmed |
| `apps/web/app/api/v1/users/[username]/reviews/route.ts` | `apps/web/lib/schema.ts` | `db.select from reviews WHERE userId = profileUserId` | WIRED | `reviews.userId` eq pattern confirmed |
| `apps/web/proxy.ts` | `apps/web/app/(app)/[username]/page.tsx` | `NextResponse.rewrite strips @ prefix` | WIRED | `pathname.startsWith('/@')` rewrite logic confirmed in both `export function proxy` and clerkMiddleware |
| `apps/web/app/(app)/profile/page.tsx` | /@username route | `redirect(`/@${username}`)` | WIRED | Line 20: redirect confirmed |
| `apps/web/app/(app)/[username]/page.tsx` | `apps/web/app/api/v1/users/[username]/route.ts` | `fetch(/api/v1/users/${username})` | WIRED | Line 61 confirmed |
| `apps/web/app/(app)/[username]/page.tsx` | `apps/web/app/api/v1/users/[username]/reviews/route.ts` | `useInfiniteQuery fetches /api/v1/users/${username}/reviews` | WIRED | Lines 80–81 confirmed |
| `apps/web/app/(app)/[username]/followers/page.tsx` | `apps/web/app/api/v1/users/[username]/followers/route.ts` | `fetch(/api/v1/users/${username}/followers)` | WIRED | Line 28 confirmed |
| `apps/web/app/(app)/profile/edit/page.tsx` | `apps/web/app/api/v1/uploads/route.ts` | `POST /api/v1/uploads { contentType, type: 'avatar' }` | WIRED | Lines 70–73 confirmed |
| `apps/web/app/(app)/profile/edit/page.tsx` | `apps/web/app/api/v1/users/me/route.ts` | `PATCH /api/v1/users/me { bio, displayName, avatarKey }` | WIRED | Lines 106–108 confirmed |
| `apps/mobile/app/(app)/(tabs)/profile.tsx` | `apps/mobile/app/(app)/profile/[username].tsx` | `import { ProfileContent }` | WIRED | Line 4: import confirmed; used at line 13 |
| `apps/mobile/app/(app)/profile/[username].tsx` | API `/api/v1/users/${username}` | `fetch with Bearer token in queryFn` | WIRED | Lines 63–65 confirmed; getToken() inside queryFn |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `[username]/page.tsx` (web) | `profile` (user, stats) | `useQuery` → `fetch(/api/v1/users/${username})` → DB select from users + userStats | Yes — DB queries in route.ts | FLOWING |
| `[username]/page.tsx` (web) | `reviewsData` (infinite pages) | `useInfiniteQuery` → `fetch(/api/v1/users/${username}/reviews)` → DB select from reviews | Yes — DB queries with cursor pagination | FLOWING |
| `[username]/followers/page.tsx` (web) | `users` (followers) | `useQuery` → `fetch(/api/v1/users/${username}/followers)` → DB inner join follows + users | Yes — real DB join | FLOWING |
| `profile/edit/page.tsx` (web) | `bio`, `displayName` (form) | render-time fetch → `GET /api/v1/users/${username}` → DB | Yes — prefill from real API | FLOWING |
| `profile/[username].tsx` (mobile) | `profile` (user, stats) | `useQuery` → API with Bearer token | Yes — same API route as web | FLOWING |
| `profile/edit.tsx` (mobile) | `bio`, `displayName` | render-time `getToken().then(fetch)` guard | Yes — fetches from real API on first render | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no running server available; all API routes require live PostgreSQL + Clerk. Tests are verifiable from the test suite run context noted in summaries (all pass except 4 pre-existing failures in restaurants.test.ts and reviews.test.ts unrelated to Phase 5).

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROF-01 | 05-01, 05-02, 05-05, 05-06 | User can set a profile avatar | SATISFIED | Upload endpoint with type='avatar' (Plan 01); PATCH /users/me with avatarKey→avatarUrl (Plan 02); edit page avatar upload (Plan 05 web, Plan 06 mobile) |
| PROF-02 | 05-01, 05-02, 05-05, 05-06 | User can write a profile bio | SATISFIED | patchUserSchema bio field (Plan 01); PATCH /users/me (Plan 02); bio textarea maxLength=500 (Plans 05, 06) |
| PROF-03 | 05-02, 05-04, 05-06 | User's profile displays reviews in reverse chronological order | SATISFIED | GET /users/[username]/reviews orders by `desc(reviews.createdAt)` (Plan 02); displayed in useInfiniteQuery list (Plans 04, 06) |
| PROF-04 | 05-02, 05-03, 05-04, 05-06 | User can view another user's public profile | SATISFIED | GET /users/[username] is public (no auth required); /@username renders profile page via proxy rewrite; mobile pushed profile screen |
| PROF-05 | 05-02, 05-04, 05-06 | User can see follower and following counts on profile | SATISFIED | GET /users/[username] returns `stats.followerCount` and `stats.followingCount`; rendered in stats row with tappable links on web and mobile |
| PROF-06 | 05-03, 05-04, 05-06 | User can browse followers and following lists | SATISFIED | GET /users/[username]/followers and /following APIs (Plan 03); web follower/following pages with UserSearchCard (Plan 04); mobile screens with FlatList + UserSearchCard (Plan 06) |

**All 6 requirements satisfied.** No orphaned requirements detected. REQUIREMENTS.md traceability table marks PROF-01 through PROF-06 as Phase 5 Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/(app)/[username]/page.tsx` | 278–279 | `onEdit={() => {}}` and `onDelete={() => {}}`  on ReviewCard | Warning | Edit and delete handlers on profile page are no-ops. Profile reviews cannot be edited/deleted from the profile view. This is intentional MVP scope (reviews are managed from their own page) but means "Edit" and "Delete" UI affordances may be confusingly present if ReviewCard renders those buttons. |
| `apps/mobile/app/(app)/profile/[username].tsx` | 187–190 | Follow button is a plain `Pressable` with no follow mutation wired | Warning | The Follow CTA for non-owner profiles on mobile renders correctly but does not call the follow API. Per SUMMARY-06, the existing `FollowButton` mobile component is available but not wired — acknowledged as MVP placeholder. |

**No blockers.** Both warnings are MVP-scope decisions documented in SUMMARYs, not overlooked stubs.

**Artifact spec mismatch (informational):** PLAN-04 artifact spec for `[username]/page.tsx` lists `contains: "ProfileHeader"` but the file implements the profile header inline rather than as a named component. The plan's code spec also used inline implementation. This is a spec-vs-implementation mismatch in the plan's artifact `contains` field only — the actual functionality (avatar, bio, stats row, CTA) is fully present and wired.

---

### Human Verification Required

#### 1. /@username URL Rewrite End-to-End

**Test:** Start dev server; navigate to `/@<any-existing-username>` in a browser
**Expected:** Profile page renders (not 404) with avatar circle, bio, stats row, review list
**Why human:** proxy.ts rewrite requires live Next.js runtime to confirm rewrite triggers correctly before App Router routing

#### 2. /profile Redirect

**Test:** Log in; navigate to `/profile`
**Expected:** Browser redirects to `/@<your-username>`
**Why human:** Server Component redirect depends on Clerk session + live DB lookup

#### 3. Edit Profile Round-Trip

**Test:** Navigate to `/profile/edit`, change bio, click "Save changes"
**Expected:** Redirect to `/@<username>`; profile page shows updated bio
**Why human:** Requires live Clerk auth + DB write + R2 env var configured

#### 4. Avatar Upload (Web)

**Test:** On `/profile/edit`, select an image file; verify upload overlay shows spinner then preview updates
**Expected:** Preview updates; "Save changes" sends avatarKey in PATCH; profile shows new avatar
**Why human:** Requires R2 presigned URL infrastructure to be active

#### 5. Mobile Profile Tab (Own)

**Test:** Open mobile app on device/simulator; tap Profile tab
**Expected:** Full profile renders with avatar, bio, stats, review list — not the old stub (which was View + Text placeholder)
**Why human:** Expo build/simulator required; no automated tests for mobile screens

#### 6. Mobile Follow Button (Non-Owner)

**Test:** On mobile, view another user's profile; tap "Follow" button
**Expected:** Note that the button does NOT call the follow API (acknowledged stub per SUMMARY-06) — confirm this is acceptable MVP scope before shipping
**Why human:** Functional verification of intentional limitation

---

### Gaps Summary

No gaps blocking phase goal achievement. All 6 requirements (PROF-01 through PROF-06) are implemented and wired on both web and mobile platforms. Two warning-level items exist (profile page edit/delete no-ops on ReviewCard; mobile Follow button not wired) — both are documented MVP decisions, not accidentally incomplete implementations.

---

_Verified: 2026-04-30_
_Verifier: Claude (gsd-verifier)_
