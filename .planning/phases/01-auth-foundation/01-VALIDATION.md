---
phase: 1
slug: auth-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web) / jest (mobile) |
| **Config file** | vitest.config.ts / jest.config.ts — Wave 0 installs |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 2 | AUTH-03 | integration | `pnpm --filter web test:integration` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | AUTH-04 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/auth.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/mobile/__tests__/auth.test.ts` — stubs for mobile auth flows
- [ ] vitest + jest config — if not already present

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password reset email received | AUTH-04 | Requires real email delivery | Sign up, trigger reset, check inbox within 5 min |
| Google OAuth sign-in (mobile) | AUTH-03 | Requires device + Google account | Open dev build, tap Google sign-in, verify session |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
