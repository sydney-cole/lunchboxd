---
phase: 05-profiles
plan: 06
subsystem: mobile-screens
tags: [profiles, mobile, expo, clerk, tanstack-query, react-native]
dependency_graph:
  requires:
    - 05-02 (GET /api/v1/users/[username], PATCH /api/v1/users/me, GET /api/v1/users/[username]/reviews)
    - 05-03 (GET /api/v1/users/[username]/followers, GET /api/v1/users/[username]/following)
  provides:
    - apps/mobile/app/(app)/(tabs)/profile.tsx — own profile tab rendering full ProfileContent
    - apps/mobile/app/(app)/profile/[username].tsx — pushed profile screen + shared ProfileContent component
    - apps/mobile/app/(app)/profile/edit.tsx — edit profile with bio, displayName, avatar R2 upload
    - apps/mobile/app/(app)/followers/[username].tsx — followers list with UserSearchCard
    - apps/mobile/app/(app)/following/[username].tsx — following list with UserSearchCard
  affects: []
tech_stack:
  added: []
  patterns:
    - ProfileContent shared component (exported from [username].tsx, imported by profile tab)
    - getToken() inside queryFn/mutationFn — never at hook level
    - StyleSheet.create throughout — NativeWind not used in this project
    - useInfiniteQuery with initialPageParam null for paginated reviews
    - expo-image-picker + presigned R2 upload for avatar (POST /api/v1/uploads, then PUT to R2)
    - Pessimistic like mutation (invalidate on settle, no optimistic update)
key_files:
  created:
    - apps/mobile/app/(app)/profile/[username].tsx
    - apps/mobile/app/(app)/profile/edit.tsx
    - apps/mobile/app/(app)/followers/[username].tsx
    - apps/mobile/app/(app)/following/[username].tsx
  modified:
    - apps/mobile/app/(app)/(tabs)/profile.tsx
decisions:
  - ProfileContent is exported from [username].tsx and imported by the own-profile tab to eliminate code duplication
  - Like mutation on profile page targets ['profile-reviews', username] cache key — separate from ['feed'] and ['my-reviews']
  - getToken() always called inside queryFn/mutationFn per threat model requirement (stale token prevention)
  - Avatar upload on mobile uses expo-image-picker MediaTypeOptions.Images with allowsEditing + 1:1 aspect crop
  - Edit profile pre-fills bio/displayName by fetching the profile endpoint on first render (not storing in React state from Clerk)
  - Follower/following lists use flat useQuery (not paginated) — acceptable for MVP; pagination can be added when needed
metrics:
  duration: "4m"
  completed_date: "2026-04-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 5 Plan 06: Mobile Profile Screens Summary

**One-liner:** Five mobile screens — own profile tab (replacing stub), pushed user profile screen, edit profile with R2 avatar upload, and followers/following lists — all using StyleSheet.create and getToken() inside async functions.

## What Was Built

Wave 2 mobile screens completing Phase 5 profile functionality on iOS/Android.

### Task 1: Own Profile Tab and Shared ProfileContent + Pushed Profile Screen

Created `apps/mobile/app/(app)/profile/[username].tsx`:

- Exports `ProfileContent` component parameterized by username — single source of truth for profile rendering
- Fetches profile via `GET /api/v1/users/${username}` with Bearer token inside queryFn
- Paginated reviews via `useInfiniteQuery` targeting `GET /api/v1/users/${username}/reviews`
- Like mutation targets `['profile-reviews', username]` query key with `onSettled` invalidation
- Avatar: 80px circle with letter fallback (accent tint + accent text, 28px)
- Stats row: follower/following counts as Pressable — navigates to `/followers/${username}` and `/following/${username}`
- CTA: "Edit profile" button for owner, "Follow" placeholder for others
- Default export `ProfileScreen` uses `useLocalSearchParams` to read username from route

Replaced stub at `apps/mobile/app/(app)/(tabs)/profile.tsx`:

- Imports `ProfileContent` from `../profile/[username]`
- Reads `clerkUser.username` from `useUser()` to render own profile
- Returns empty View while Clerk loads to prevent flash

### Task 2: Edit Profile Screen, Followers Screen, and Following Screen

Created `apps/mobile/app/(app)/profile/edit.tsx`:

- Pre-fills bio and displayName by fetching profile endpoint on first render
- Avatar upload: `expo-image-picker.launchImageLibraryAsync` → `POST /api/v1/uploads` (type: 'avatar') → PUT blob to R2 presigned URL
- `getToken()` called inside `handlePickAvatar` and `handleSave` — never at hook level
- `PATCH /api/v1/users/me` sends `{ bio, displayName, avatarKey }` to persist changes
- Invalidates `['profile', username]` query on success; navigates `router.back()`
- `maxLength={500}` on bio TextInput; `maxLength={50}` on displayName

Created `apps/mobile/app/(app)/followers/[username].tsx`:

- `useLocalSearchParams` reads username from route
- `useQuery` fetches `GET /api/v1/users/${username}/followers` with Bearer token inside queryFn
- FlatList renders `UserSearchCard` components (existing mobile component)
- Empty state: "No followers yet" / "Share your profile to find people to follow you."

Created `apps/mobile/app/(app)/following/[username].tsx`:

- Mirrors followers screen but uses `['following', username]` query key
- Endpoint: `GET /api/v1/users/${username}/following`
- Empty state: "Not following anyone yet" / "Search for friends to follow."

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The Follow button in ProfileContent (for non-owner view) is a plain Pressable with accent styling but no actual follow mutation wired. It renders correctly per UI-SPEC but does not call the follow API. The existing `FollowButton` mobile component (`apps/mobile/components/follow-button.tsx`) could be wired here in a future plan — the plan spec used a plain Pressable as the placeholder for this MVP.

## Self-Check: PASSED
