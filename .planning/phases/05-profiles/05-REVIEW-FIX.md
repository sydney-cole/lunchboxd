---
phase: 05-profiles
status: partial
findings_in_scope: 9
fixed: 8
skipped: 1
iteration: 1
---

# Phase 05 — Profiles: Code Review Fix Report

## Fixed

- **C-01**: Added `useAuth()` from `@clerk/nextjs` to both `apps/web/app/(app)/[username]/followers/page.tsx` and `following/page.tsx`. The `queryFn` now calls `getToken()` and attaches an `Authorization: Bearer ${token}` header when a token is available. This ensures logged-in users receive `followState` enrichment from the server.

- **C-02**: Added a Zod schema (`uploadRequestSchema`) in `apps/web/app/api/v1/uploads/route.ts` that validates `type` as `z.enum(['review', 'avatar'])` with a default of `'review'`. The `body as` cast was removed and replaced with `safeParse`. Also updated `patchUserSchema` in `packages/shared/src/schemas/index.ts` to restrict `avatarKey` regex to `avatars/` prefix only (removed the `(avatars|reviews)` alternation), preventing review photo keys from being submitted as avatar keys.

- **W-01**: Wired up the Follow button in `apps/mobile/app/(app)/profile/[username].tsx`. Added a `followMutation` using `useMutation` that calls `POST /api/v1/follows` (follow) or `DELETE /api/v1/follows` (unfollow) with the target user's ID. Added local `isFollowing` state (initialized to `false`) to toggle the button label between "Follow" and "Unfollow". The `onPress` handler triggers the mutation and flips the state on success.

- **W-02**: Moved the pre-fill fetch logic from the render body into a `useEffect` in both `apps/mobile/app/(app)/profile/edit.tsx` and `apps/web/app/(app)/profile/edit/page.tsx`. The `initialized` flag (mobile) and `profileLoaded` flag (web) were replaced with proper `useEffect` hooks that depend on `clerkUser?.username` (mobile) or `clerkUser?.id` (web), eliminating the React anti-pattern of calling `setState` synchronously during render.

- **W-03**: Added cursor-based pagination to both `apps/web/app/api/v1/users/[username]/followers/route.ts` and `following/route.ts`. Added a `followListQuerySchema` (UUID cursor + limit) to `packages/shared/src/schemas/index.ts`. Both routes now parse `cursor` and `limit` from query params, use the `limit+1` trick to detect `hasMore`, and return `{ items, nextCursor }` instead of a bare array.

- **W-04**: Wrapped all username interpolations with `encodeURIComponent()` in the four mobile files: `apps/mobile/app/(app)/followers/[username].tsx`, `apps/mobile/app/(app)/following/[username].tsx`, and both profile and reviews fetch URLs in `apps/mobile/app/(app)/profile/[username].tsx`. The `edit.tsx` URL was also updated as part of the W-02 fix.

- **W-05**: Fixed `apps/web/proxy.ts` so that `auth.protect()` runs for `/@username` routes that require authentication before the rewrite is issued. The `clerkMiddleware` handler now builds a `NextRequest` with the rewritten pathname, checks `isPublicRoute()` against the rewritten path, and calls `auth.protect()` if needed — then returns the `NextResponse.rewrite()`. This eliminates the short-circuit that previously bypassed auth enforcement for all `/@username` paths.

- **W-07**: Added dirty-state tracking via `useRef` (originalBio, originalDisplayName) in both `apps/mobile/app/(app)/profile/edit.tsx` and `apps/web/app/(app)/profile/edit/page.tsx`. The `handleSave` functions now only include fields whose current value differs from the original fetched value. If no fields are dirty, the save is skipped and the user is navigated back immediately without making a PATCH request.

## Skipped

- **W-06**: Deferred. The `userStats` table is updated atomically for `followerCount` and `followingCount` by `apps/web/app/api/v1/follows/route.ts` (both POST and DELETE handlers perform upserts). However, `reviewCount` is not updated in the reviews route handlers — there are no `userStats` writes in `apps/web/app/api/v1/reviews/route.ts` or `reviews/[id]/route.ts`. Adding `reviewCount` upserts to all review create/delete paths is a non-trivial cross-cutting change with its own risk surface (edge cases for soft-delete, bulk operations). This is documented as a follow-up task for a dedicated stats-consistency phase rather than included in this fix pass.
