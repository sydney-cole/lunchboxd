---
phase: 6
slug: notifications-location
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test` |
| **Full suite command** | `pnpm --filter web test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test`
- **After every plan wave:** Run `pnpm --filter web test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | NOTF-01 | — | `notificationQuerySchema` rejects invalid cursor | unit | `pnpm --filter web test` | ❌ W0: `__tests__/notifications.test.ts` | ⬜ pending |
| 6-01-02 | 01 | 0 | NOTF-01 | T-6-05 | Self-notification skip: `actorId === userId` → no INSERT | unit | `pnpm --filter web test` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 0 | NOTF-02 | — | Notification INSERT skipped on unlike branch (only on like) | unit | `pnpm --filter web test` | ❌ W0 | ⬜ pending |
| 6-01-04 | 01 | 0 | LOCN-02 | — | `restaurantReviewedQuerySchema` rejects `q` > 100 chars | unit | `pnpm --filter web test` | ❌ W0 | ⬜ pending |
| 6-01-05 | 01 | 0 | LOCN-03 | — | `reviewedByFollowed` is `false` for all pins when user follows nobody | unit | `pnpm --filter web test` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | NOTF-01 | T-6-01 | `GET /api/v1/notifications` scoped to `userId = $me` (no other user's notifications) | integration (manual) | curl against dev server | Manual | ⬜ pending |
| 6-02-02 | 02 | 1 | NOTF-03 | T-6-02 | `GET /api/v1/notifications/unread` returns `{ hasUnread: boolean }` | integration (manual) | curl against dev server | Manual | ⬜ pending |
| 6-02-03 | 02 | 1 | NOTF-03 | T-6-02 | `PATCH /api/v1/notifications/read-all` sets `read = true` for caller's rows only | integration (manual) | curl against dev server | Manual | ⬜ pending |
| 6-03-01 | 03 | 1 | LOCN-01 | — | `GET /api/v1/restaurants/map` returns only rows with non-null lat/lng | integration (manual) | curl against dev server | Manual | ⬜ pending |
| 6-03-02 | 03 | 1 | LOCN-03 | — | `reviewedByFollowed: true` only for restaurants reviewed by followed users | integration (manual) | curl against dev server | Manual | ⬜ pending |
| 6-03-03 | 03 | 1 | LOCN-02 | — | `GET /api/v1/restaurants/reviewed?q=brooklyn` returns matching restaurants (with + without lat/lng) | integration (manual) | curl against dev server | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/notifications.test.ts` — unit tests for:
  - `notificationQuerySchema` cursor validation + limit coercion (mirrors `feedQuerySchema` tests)
  - `restaurantReviewedQuerySchema` `q` max-length (100 char) validation
  - Self-notification skip logic (actorId === userId → no INSERT)
  - `reviewedByFollowed` computation helper (if extracted to pure function)

*Existing Vitest infrastructure in `apps/web/__tests__/` covers all unit tests. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell shows red dot after follow event | NOTF-01 | Requires live DB + auth session | Follow a user in dev, check nav bell shows red dot |
| Bell shows red dot after like event | NOTF-02 | Requires live DB + auth session | Like a review in dev, check nav bell shows red dot |
| Opening notification panel clears red dot | NOTF-03 | UI state + API interaction | Open panel, close it, verify dot is gone and `hasUnread` returns false |
| Map renders followed-user pins in distinct color | LOCN-03 | Visual rendering in browser | Visit /map as a user who follows others; verify red-orange pins for followed restaurants |
| Manual-entry restaurants absent from map | LOCN-01 | Map visual inspection | Create a review with manual restaurant entry (null lat/lng); confirm pin does not appear on map |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
