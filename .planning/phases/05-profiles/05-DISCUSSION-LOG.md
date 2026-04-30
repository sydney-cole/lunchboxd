# Phase 5: Profiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 05-profiles
**Areas discussed:** Profile URL structure, Avatar upload flow, Edit profile UX, Followers/following lists

---

## Profile URL Structure

| Option | Description | Selected |
|--------|-------------|----------|
| /@username | Clean social-app convention (Twitter/Instagram). Own profile at /profile redirects to /@username. | ✓ |
| /u/[username] | Unambiguous namespace, avoids top-level route collisions. | |
| /users/[username] | Verbose but RESTful, consistent with /api/v1/users/... | |

**User's choice:** `/@username`
**Notes:** Own profile redirects `/profile → /@<username>`. Mobile Profile tab renders own profile directly; viewing others pushes a new screen.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tab shows own profile directly | Profile tab renders own /@username profile. Others' profiles push a new screen. | ✓ |
| Tab is a menu/hub | Hub with options: View profile, Edit profile, Settings, etc. | |

**User's choice:** Tab shows own profile directly.

---

## Avatar Upload Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing R2 pipeline | POST /api/v1/uploads → R2 → PATCH /api/v1/users/me. Same as meal photos. | ✓ |
| Clerk's built-in profile image | Zero backend work but avatar lives in Clerk's CDN, not R2. | |

**User's choice:** Reuse existing R2 pipeline.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Initial/letter avatar | First letter of username in a colored circle. Already used in mobile FeedCard. | ✓ |
| Generic silhouette icon | Gray person icon placeholder. | |
| You decide | Claude picks implementation. | |

**User's choice:** Initial/letter avatar.

---

## Edit Profile UX

| Option | Description | Selected |
|--------|-------------|----------|
| Separate /profile/edit page | Dedicated edit page with form fields for bio and avatar upload. | ✓ |
| Inline on profile page | Click bio text to edit in-place; tap avatar to open file picker. | |
| Modal overlay | Edit Profile button opens a modal with the form. | |

**User's choice:** Separate `/profile/edit` page (and equivalent mobile screen).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Own profile only | Edit Profile button shown only when viewer = profile owner. Others see Follow button. | ✓ |
| You decide | Claude handles conditional rendering. | |

**User's choice:** Own profile only — show [Edit Profile] for own profile, [Follow] for others.

---

## Followers/Following Lists

| Option | Description | Selected |
|--------|-------------|----------|
| Separate page | Navigate to /@username/followers or /@username/following. Full list with follow buttons. | ✓ |
| Modal overlay | Bottom sheet (mobile) or dialog (web) with list inline on profile page. | |

**User's choice:** Separate page. Web: `/@username/followers`, `/@username/following`. Mobile: new screens pushed onto stack.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show follow state | Reuse UserSearchCard component — already renders follow state and FollowButton. | ✓ |
| Names only, no actions | Just show user list without follow buttons. | |

**User's choice:** Show follow state — reuse UserSearchCard.

---

## Claude's Discretion

- Display name field on edit page (include if straightforward given schema already has `displayName`)
- Review history pagination on profile (infinite scroll vs full list)
- Profile page layout ordering
- Mobile ProfileScreen reuse strategy (same component parameterized by username)

## Deferred Ideas

None — discussion stayed within phase scope.
