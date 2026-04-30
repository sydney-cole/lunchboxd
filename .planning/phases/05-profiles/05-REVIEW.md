---
phase: 05-profiles
status: issues_found
files_reviewed: 19
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
---

# Phase 05 — Profiles: Code Review

**Reviewed:** 2026-04-30
**Depth:** Standard
**Reviewer:** gsd-code-reviewer

---

## Summary

The Phase 05 profiles implementation is generally sound. The API layer correctly uses Clerk auth, applies Zod validation schemas, avoids N+1 queries, and protects sensitive fields. The main concerns are two critical security/correctness issues: a client-side auth bypass on the followers/following web pages, and an unvalidated `type` field in the uploads route that could allow unauthorized key prefixes. A cluster of warning-level issues covers a non-functional Follow button, a side-effectful render-phase fetch in the mobile edit screen, missing pagination on followers/following endpoints, and a proxy/middleware bug that could break auth enforcement for `/@username` routes.

---

## Critical Findings

### C-01 — Web followers/following pages fetch without auth token (security + correctness)

**Files:** `apps/web/app/(app)/[username]/followers/page.tsx` (line 28), `apps/web/app/(app)/[username]/following/page.tsx` (line 28)

**Issue:** Both client pages call `fetch('/api/v1/users/${username}/followers')` and `fetch('/api/v1/users/${username}/following')` without attaching an `Authorization` header. The API route handlers call `await auth()` but treat auth as *optional* — unauthenticated requests still return all follower/following rows, just without `followState` enrichment. This is correct server-side behavior, but it means these pages show the full list to unauthenticated visitors even when that data should require login.

More importantly, the `followState` field (used by `UserSearchCard`) will always be `'none'` for every user because the viewer is never identified. A logged-in user will see "Follow" buttons for everyone, including people they already follow. This is a functional regression — the follow-state enrichment logic in the API is correct, but the client never provides the token.

The mobile versions (`followers/[username].tsx`, `following/[username].tsx`) correctly call `getToken()` and attach `Authorization: Bearer ${token}`.

**Fix required:** Use Clerk's `useAuth()` hook to obtain the session token and attach it to the fetch, or route through Next.js middleware that forwards the session cookie (the session cookie is already sent in same-origin requests; verify if Clerk's server-side `auth()` picks it up from the cookie automatically without an explicit header — if so, this may only be a UX issue, not a security bypass).

---

### C-02 — Upload route accepts `type` field from untrusted client input without schema validation

**File:** `apps/web/app/api/v1/uploads/route.ts` (lines 33–43)

**Issue:** The `type` field is destructured directly from `req.json()` with a TypeScript cast but no runtime Zod validation:

```ts
const { contentType, type = 'review' } = body as { contentType: string; type?: 'review' | 'avatar' }
```

The TypeScript cast is erased at runtime. A client can send `type: "../../etc"` or any arbitrary string. The `prefix` variable becomes `body.type + "/"`, which is directly embedded in the R2 object key:

```ts
const prefix = type === 'avatar' ? 'avatars' : 'reviews'
```

The conditional on line 42 means only `'avatar'` maps to `avatars/`; anything else maps to `reviews/`. So the path traversal risk here is low because unrecognised values fall to `reviews`. **However**, a client can bypass the `type` intent entirely — e.g., supply `type: "avatar"` to get a presigned URL with the `avatars/` prefix and then use that key to replace another user's avatar via the `/api/v1/users/me` PATCH endpoint. The avatarKey ownership check in `me/route.ts` (line 26–28) uses `split('/')[1]` to compare the clerkId segment, which does correctly prevent one user from using another user's key. But the type distinction (`avatars` vs `reviews`) is not enforced — a `reviews/<clerkId>/<uuid>` key can be submitted as `avatarKey` and the regex in `patchUserSchema` permits it:

```ts
avatarKey: z.string().regex(/^(avatars|reviews)\/[a-zA-Z0-9_-]+\/[0-9a-f-]{36}$/).optional()
```

This means any review photo key can be set as a profile avatar, which may not be intended. The `type` field in the upload route should be validated with Zod to enforce the allowed enum values explicitly and the `patchUserSchema` avatarKey regex should restrict to `avatars/` only.

---

## Warning Findings

### W-01 — Follow button is non-functional (missing onPress handler)

**File:** `apps/mobile/app/(app)/profile/[username].tsx` (lines 186–191)

**Issue:** The Follow `Pressable` has no `onPress` handler. A non-owner viewing another user's profile sees a "Follow" button that does nothing:

```tsx
<Pressable
  style={styles.followButton}
  accessibilityLabel={`Follow ${user.username}`}
>
  <Text style={styles.followButtonText}>Follow</Text>
</Pressable>
```

The web profile page uses `<FollowButton targetUserId={user.id} initialState="none" />` (a proper component). The mobile version has a stub. This means the core social action (following users) is inaccessible on mobile.

**Note:** The `onEdit` and `onDelete` callbacks in `apps/web/app/(app)/[username]/page.tsx` (lines 278–279) are also empty (`onEdit={() => {}}`, `onDelete={() => {}}`), though those may be intentionally deferred to a future review editing phase.

---

### W-02 — Side-effectful state mutation inside render body (mobile edit screen)

**File:** `apps/mobile/app/(app)/profile/edit.tsx` (lines 35–48)

**Issue:** The pre-fill logic runs directly inside the component function body, outside any effect or event handler:

```ts
if (!initialized && clerkUser?.username) {
  setInitialized(true)
  getToken().then((token) => {
    fetch(...)
      .then((data) => {
        if (data.user?.bio) setBio(data.user.bio)
        ...
      })
  })
}
```

Calling `setState` during render (even conditionally) is a React anti-pattern. In React's concurrent mode this can cause double-invocation of render, leading to double API calls or race conditions. `setInitialized(true)` is called synchronously in render, which triggers another render immediately. The correct pattern is `useEffect(() => { ... }, [])` with a dependency on `clerkUser?.username`.

The web equivalent in `edit/page.tsx` (lines 27–38) has the same pattern (`if (isLoaded && clerkUser && !profileLoaded) { setProfileLoaded(true); fetch(...) }`). This is equally problematic.

---

### W-03 — No pagination on followers/following endpoints (scalability)

**Files:** `apps/web/app/api/v1/users/[username]/followers/route.ts`, `apps/web/app/api/v1/users/[username]/following/route.ts`

**Issue:** Both endpoints return the full followers/following list in a single query with no `LIMIT`, `OFFSET`, or cursor-based pagination. For users with large follower counts (thousands+), this will:
- Return very large JSON payloads over the network
- Cause slow DB queries without a row limit
- Potentially OOM the serverless function

The reviews endpoint correctly uses cursor-based pagination with `limit+1` trick. Followers/following should adopt the same pattern, especially since the `FlatList` / list UI on both web and mobile already renders the full array.

---

### W-04 — Username not URL-encoded in API fetch URLs

**Files:** Multiple — `followers/[username].tsx` (line 29), `following/[username].tsx` (line 29), `profile/[username].tsx` (lines 64, 84, 86), `edit.tsx` (line 38)

**Issue:** The username is interpolated directly into fetch URLs without `encodeURIComponent()`:

```ts
fetch(`${API_BASE_URL}/api/v1/users/${username}/followers`, ...)
```

If a username contains characters that are valid per the signup regex (`^[a-zA-Z0-9_]+$`) then this is safe, as none of those characters require URL encoding. However, the application's own signup schema and the API's DB lookup both accept underscores — not a URL-unsafe character. This is low risk given the current schema, but is worth noting: if the username regex ever changes (e.g., to allow `.` or `-`), the URLs would silently break. The mobile `reviews` query at line 84 does correctly use `encodeURIComponent(pageParam)` for the cursor, showing inconsistent practice.

---

### W-05 — `proxy.ts` `/@username` rewrite duplicated in `clerkMiddleware`, bypassing auth protection

**File:** `apps/web/proxy.ts` (lines 17–28, 32–44)

**Issue:** The `/@username` rewrite logic is implemented twice: once in the standalone `proxy()` export (lines 17–28) and once inside the `clerkMiddleware` default export (lines 36–40). The `clerkMiddleware` version correctly applies the rewrite *before* calling `auth.protect()` for non-public routes. However, when the rewrite fires at line 38–40, it returns `NextResponse.rewrite(...)` immediately **without calling `auth.protect()`**. The `!isPublicRoute(request)` check at line 42 is never reached for `/@username` paths.

This means all `/@username` routes — including `/profile/edit` (accessed as `/@<username>/...` — wait, edit is at `/profile/edit` not under `/@`) — may bypass auth enforcement in the middleware. In practice the profile pages are currently marked client-side and redirect unauthenticated users via Clerk's client SDK, so real impact may be limited. But relying on client-side auth for route protection is not a robust security posture. The auth check should run before or as part of the rewrite, not be short-circuited by it.

---

### W-06 — `userStats` data staleness — `GET /api/v1/users/[username]` reads from a denormalized cache table

**File:** `apps/web/app/api/v1/users/[username]/route.ts` (lines 33–43)

**Issue:** Follower count, following count, and review count are served from `userStats` rather than computed directly from the source tables. This is a standard optimization, but the review makes no mention of how `userStats` is kept current (triggers, background job, webhook?). If `userStats` rows are not updated atomically with follow/unfollow/review operations, the profile page will display stale counts — e.g., immediately after following someone, the follower count won't reflect the new state.

This is architectural context-dependent (the update mechanism may be implemented elsewhere), but the route should be noted: if `userStats` sync is missing or lagging, counts shown in the profile header will be incorrect. The route should at minimum fall back gracefully when `stats` is null (it does: `stats ?? { followerCount: '0', ... }` on line 106), but there's no indication to the caller that the data may be stale.

---

### W-07 — `me/route.ts` PATCH sends all fields even when unchanged

**File:** `apps/web/app/api/v1/users/me/route.ts` (lines 38–44), `apps/mobile/app/(app)/profile/edit.tsx` (lines 100–103), `apps/web/app/(app)/profile/edit/page.tsx` (lines 101–104)

**Issue:** The client always sends `bio` and `displayName` regardless of whether the user changed them (the condition `if (bio !== undefined)` is always true since these are `useState('')` with string values). The server then writes both to the DB even when unchanged. This inflates write traffic and prevents distinguishing "user explicitly cleared bio" from "user never touched bio." The `patchUserSchema` correctly uses `.optional()` for all fields — the client should only send the fields that were actually modified.

---

## Informational Findings

### I-01 — `followerCount` / `followingCount` / `reviewCount` are typed as `string` not `number`

**Files:** `apps/mobile/app/(app)/profile/[username].tsx` (lines 30–32), `apps/web/app/(app)/[username]/page.tsx` (lines 23–25)

The `ProfileStats` interface types these as `string`. The API returns them from `userStats` which is a denormalized table — the column type determines the runtime type. If these are stored as integers in PostgreSQL, Drizzle will return numbers, but the TypeScript interface says string. The rendered output (`{stats.followerCount} followers`) works either way via implicit coercion, but TypeScript won't catch misuse (e.g., arithmetic on the count). A numeric type would be more correct.

---

### I-02 — `rating` typed as `string | null` in profile review types but schema stores as numeric

**Files:** `apps/mobile/app/(app)/profile/[username].tsx` (line 41), `apps/web/app/(app)/[username]/page.tsx` (line 30)

`rating` is `string | null` in the client-side `ProfileReview` interface. The mobile render at line 221 calls `parseFloat(item.rating)` suggesting it's actually a string from the DB (Drizzle decimal columns may return strings). This is consistent but implicit — the `reviewSchema` in `shared/schemas/index.ts` validates `rating` as `z.number()`, which means incoming review creation values are numbers. The DB layer serialization is inconsistent. The type should be documented and consistent across the stack.

---

### I-03 — Web profile page has no server-side metadata (SEO)

**File:** `apps/web/app/(app)/[username]/page.tsx`

The profile page is a Client Component (`'use client'`). No `generateMetadata` function exists in the route segment. Profile pages (`/@sarah`) would benefit from server-rendered `<title>` and Open Graph tags for shareability. This is not a bug but a notable omission for a social app.

---

### I-04 — Missing `limit` default in reviews URL when no cursor (mobile)

**File:** `apps/mobile/app/(app)/profile/[username].tsx` (line 85)

When fetching the first page, the URL is `/api/v1/users/${username}/reviews` with no `limit` parameter. The server-side `profileQuerySchema` defaults `limit` to 20 when absent, so this works correctly. However, subsequent pages append `&limit=20` explicitly. The behavior is consistent but inconsistently expressed — first page relies on server default, subsequent pages are explicit. This creates a subtle discrepancy if the server default changes.

---

### I-05 — Test suite lacks coverage for avatarKey ownership mismatch

**File:** `apps/web/__tests__/profiles.test.ts`

The `patchUserSchema` tests correctly verify path traversal rejection and field validation. However, there are no tests for the server-side business rule that `avatarKey.split('/')[1]` must match the authenticated `clerkId`. That check lives in `me/route.ts` (not the schema), but an integration test or at minimum a unit test of the ownership check logic would prevent regressions on this security-relevant validation.

---

## File-by-File Status

| File | Status | Notes |
|------|--------|-------|
| `apps/mobile/app/(app)/(tabs)/profile.tsx` | OK | Simple delegation to ProfileContent |
| `apps/mobile/app/(app)/followers/[username].tsx` | OK | Auth token attached correctly |
| `apps/mobile/app/(app)/following/[username].tsx` | OK | Auth token attached correctly |
| `apps/mobile/app/(app)/profile/[username].tsx` | Warning | W-01 (no-op Follow button), W-04 (no encodeURIComponent) |
| `apps/mobile/app/(app)/profile/edit.tsx` | Warning | W-02 (render-phase side effect), W-07 (always sends all fields) |
| `apps/web/__tests__/profiles.test.ts` | Info | I-05 (missing ownership check test) |
| `apps/web/app/(app)/[username]/followers/page.tsx` | Critical | C-01 (no auth token on fetch) |
| `apps/web/app/(app)/[username]/following/page.tsx` | Critical | C-01 (no auth token on fetch) |
| `apps/web/app/(app)/[username]/page.tsx` | Warning | W-01 (empty onEdit/onDelete stubs), I-01, I-02, I-03 |
| `apps/web/app/(app)/profile/edit/page.tsx` | Warning | W-02 (render-phase side effect), W-07 (always sends all fields) |
| `apps/web/app/(app)/profile/page.tsx` | OK | Correct server redirect pattern |
| `apps/web/app/api/v1/uploads/route.ts` | Critical | C-02 (unvalidated type field, no Zod parse) |
| `apps/web/app/api/v1/users/[username]/followers/route.ts` | Warning | W-03 (no pagination) |
| `apps/web/app/api/v1/users/[username]/following/route.ts` | Warning | W-03 (no pagination) |
| `apps/web/app/api/v1/users/[username]/reviews/route.ts` | OK | Correct cursor pagination, batch queries, no N+1 |
| `apps/web/app/api/v1/users/[username]/route.ts` | Warning | W-06 (userStats staleness), I-01 |
| `apps/web/app/api/v1/users/me/route.ts` | OK | Auth check, schema validation, ownership check all correct |
| `apps/web/proxy.ts` | Warning | W-05 (auth.protect() bypassed for /@username routes) |
| `packages/shared/src/schemas/index.ts` | Warning | C-02 (avatarKey regex permits `reviews/` prefix for avatars) |

---

## Prioritized Fix List

1. **C-01** — Attach session token to follower/following fetches in web client pages (or confirm cookie-based session is sufficient)
2. **C-02** — Add Zod validation for `type` field in uploads route; restrict `patchUserSchema` avatarKey regex to `avatars/` prefix only
3. **W-01** — Wire up Follow mutation in mobile `ProfileContent` component
4. **W-05** — Fix proxy middleware to run `auth.protect()` for `/@username` routes that require authentication
5. **W-02** — Move pre-fill fetch to `useEffect` in both mobile and web edit screens
6. **W-03** — Add cursor-based pagination to followers/following endpoints
7. **W-07** — Only send modified fields to PATCH endpoint (track dirty state in edit forms)
