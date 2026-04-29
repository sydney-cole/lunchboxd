---
phase: 4
slug: feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (confirmed in `apps/web/vitest.config.ts`) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npm run test` |
| **Full suite command** | `cd apps/web && npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm run test`
- **After every plan wave:** Run `cd apps/web && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | FEED-01 | — | feedQuerySchema rejects invalid cursor | unit | `cd apps/web && npm run test` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | FEED-01 | — | feedQuerySchema accepts null cursor | unit | `cd apps/web && npm run test` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | FEED-02 | — | feedQuerySchema coerces limit, enforces max 100 | unit | `cd apps/web && npm run test` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | FEED-02 | — | formatRelativeTime "just now" for sub-minute | unit | `cd apps/web && npm run test` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 0 | FEED-02 | — | formatRelativeTime "2h" for 2-hour diff | unit | `cd apps/web && npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/feed.test.ts` — stubs for FEED-01, FEED-02 (feedQuerySchema validation + formatRelativeTime unit tests)

*Wave 0 creates test stubs before implementation so failures are caught task-by-task.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Infinite scroll appends items on web | FEED-02 | Requires browser viewport + scroll interaction | Load feed, scroll to bottom, confirm new cards append without navigation |
| Pull-to-refresh loads new items on mobile | FEED-02 | Requires physical/simulated device gesture | Pull down on feed, confirm activity indicator shows, new reviews appear |
| Feed shows reviews from followed users | FEED-01 | Requires seeded multi-user state | User A follows User B, User B posts review, User A's feed shows it |
| Empty state shown for unfollowed user | FEED-01 | Requires fresh account state | New user with no follows sees "Follow someone to see their reviews here" |
| Auth redirect for unauthenticated `/` | FEED-01 | Requires browser session state | Sign out, visit `/`, confirm redirect to `/sign-in` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
