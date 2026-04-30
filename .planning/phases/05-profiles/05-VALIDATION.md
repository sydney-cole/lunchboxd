---
phase: 5
slug: profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npm run test` |
| **Full suite command** | `cd apps/web && npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm run test`
- **After every plan wave:** Run `cd apps/web && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | PROF-01, PROF-02 | — | patchUserSchema rejects bio > 500 chars | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 0 | PROF-01 | — | patchUserSchema accepts valid avatarKey | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 0 | PROF-03, PROF-04 | — | profileQuerySchema validates cursor pagination | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-02-xx | 02 | 1 | PROF-01, PROF-02 | — | PATCH /api/v1/users/me validates input | unit | `cd apps/web && npm run test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-03-xx | 03 | 1 | PROF-03, PROF-04 | — | GET /api/v1/users/[username] returns 404 for unknown user | manual | Navigate to /@nonexistent-user | — | ⬜ pending |
| 05-04-xx | 04 | 1 | PROF-05, PROF-06 | — | Follower/following counts match follow graph | manual | Follow/unfollow, check counts on profile | — | ⬜ pending |
| 05-05-xx | 05 | 2 | PROF-04 | — | /@username URL resolves correctly via proxy.ts | manual | Navigate to /@testuser in browser | — | ⬜ pending |
| 05-06-xx | 06 | 2 | PROF-01, PROF-02 | — | Edit profile saves and profile page reflects changes | manual | Edit bio + avatar, verify on profile page | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/profiles.test.ts` — stubs covering:
  - `patchUserSchema` bio max 500, displayName max 50, avatarKey optional
  - `patchUserSchema` rejects bio > 500 chars
  - `patchUserSchema` accepts partial updates (bio only, avatarKey only, all fields)
  - `profileQuerySchema` cursor validation (ISO 8601 string), limit coercion

*Wave 0 creates the test file stub. Tests run against shared schema exports.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/@username` URL renders profile via proxy.ts rewrite | PROF-04 | Requires browser + running dev server | 1. Start `npm run dev`. 2. Navigate to `/@<any-existing-username>`. 3. Verify profile page renders with avatar, bio, stats. |
| `/profile` redirects to `/@<own-username>` | PROF-04 | Requires authenticated session + browser | 1. Log in. 2. Navigate to `/profile`. 3. Verify redirect to `/@<your-username>`. |
| Avatar upload saves and displays on profile | PROF-01 | Requires R2 env vars + file picker interaction | 1. Go to `/profile/edit`. 2. Upload an image. 3. Save. 4. Verify avatar updated on `/@username`. |
| Follower/following list entries link to correct profiles | PROF-06 | Requires social graph data + navigation | 1. Go to `/@username/followers`. 2. Tap a user card. 3. Verify pushed to correct profile. |
| Mobile profile tab shows own profile | PROF-04 | Requires Expo dev client + auth | 1. Log in on mobile. 2. Tap Profile tab. 3. Verify own profile renders (avatar, bio, stats). |
| Mobile follower/following navigation | PROF-06 | Requires Expo dev client + navigation | 1. Tap follower count on mobile profile. 2. Verify FollowListScreen pushes with correct users. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
