---
phase: 2
slug: reviews-meals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-reviews-REVW-01 | reviews | 1 | REVW-01 | unit | `pnpm --filter web test:unit -- --grep "REVW-01"` | ❌ W0 | ⬜ pending |
| 2-reviews-REVW-02 | reviews | 1 | REVW-02 | unit | `pnpm --filter web test:unit -- --grep "REVW-02"` | ❌ W0 | ⬜ pending |
| 2-reviews-REVW-03 | reviews | 2 | REVW-03 | smoke | manual — requires R2 credentials | — | ⬜ pending |
| 2-reviews-REVW-04 | reviews | 1 | REVW-04 | unit | `pnpm --filter web test:unit -- --grep "REVW-04"` | ❌ W0 | ⬜ pending |
| 2-reviews-REVW-05 | reviews | 1 | REVW-05 | unit | `pnpm --filter web test:unit -- --grep "REVW-05"` | ❌ W0 | ⬜ pending |
| 2-reviews-REVW-06 | reviews | 3 | REVW-06 | unit | `pnpm --filter web test:unit -- --grep "REVW-06"` | ❌ W0 | ⬜ pending |
| 2-reviews-REVW-07 | reviews | 3 | REVW-07 | unit | `pnpm --filter web test:unit -- --grep "REVW-07"` | ❌ W0 | ⬜ pending |
| 2-meals-MEAL-01 | meals | 2 | MEAL-01 | unit | `pnpm --filter web test:unit -- --grep "MEAL-01"` | ❌ W0 | ⬜ pending |
| 2-meals-MEAL-02 | meals | 2 | MEAL-02 | unit | `pnpm --filter web test:unit -- --grep "MEAL-02"` | ❌ W0 | ⬜ pending |
| 2-meals-MEAL-03 | meals | 2 | MEAL-03 | unit | `pnpm --filter web test:unit -- --grep "MEAL-03"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/reviews.test.ts` — stubs for REVW-01, REVW-02, REVW-04, REVW-05, REVW-06, REVW-07
- [ ] `apps/web/__tests__/restaurants.test.ts` — stubs for MEAL-01, MEAL-02, MEAL-03
- [ ] `reviewSchema` Zod schema added to `packages/shared/src/schemas/index.ts` before tests can import it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `POST /api/v1/uploads` returns presigned URL with valid key | REVW-03 | Requires live R2 credentials (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`) | POST to `/api/v1/uploads` with `{ filename: "test.jpg", contentType: "image/jpeg" }`; verify response has `url` (presigned) and `key` fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
