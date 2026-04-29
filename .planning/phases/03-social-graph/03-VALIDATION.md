---
phase: 3
slug: social-graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | SOCL-01, SOCL-02, SOCL-03 | — | N/A | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | SOCL-04 | — | N/A | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | SOCL-05 | — | N/A | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SOCL-01 | — | Clerk auth() validates actor before follow write | unit | `pnpm --filter web test:unit` | ✅ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SOCL-02 | — | Clerk auth() validates actor before unfollow | unit | `pnpm --filter web test:unit` | ✅ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | SOCL-03 | — | Mutual friendship detection correct | unit | `pnpm --filter web test:unit` | ✅ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | SOCL-04 | — | Like toggle idempotent | unit | `pnpm --filter web test:unit` | ✅ W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | SOCL-05 | — | Search rejects query < 2 chars | unit | `pnpm --filter web test:unit` | ✅ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SOCL-04 | — | Optimistic update rolls back on error | manual | — | — | ⬜ pending |
| 03-04-01 | 04 | 2 | SOCL-01, SOCL-02, SOCL-05 | — | Mobile Bearer token used for all social API calls | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/social.test.ts` — Zod schema stubs for SOCL-01 through SOCL-05
- [ ] Schema migration: add `uniqueIndex('friendships_unique_idx')` on `(friendships.userAId, friendships.userBId)` in `apps/web/lib/schema.ts`

*Wave 0 installs test stubs before any API routes are written so validation can run from the first commit.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optimistic like rollback on network error | SOCL-04 | Requires simulated API failure | Toggle airplane mode after tapping like; confirm count reverts |
| Three-state follow button (Follow → Following → Friends) | SOCL-01, SOCL-03 | Requires two test accounts + real DB | Follow User A from User B, then follow User B from User A; confirm button shows "Friends" on both sides |
| Feed cleanup on unfollow | SOCL-02 | Requires feed_items rows; no feed UI yet | Query `feed_items` table directly after unfollow; confirm rows for that user's reviews are gone |
| Mobile user search debounce | SOCL-05 | UI timing behavior | Type 1 char, confirm no API call; type 2nd char, confirm call fires |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
