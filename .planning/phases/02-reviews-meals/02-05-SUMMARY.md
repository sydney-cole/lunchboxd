---
phase: 02-reviews-meals
plan: 05
subsystem: web-ui
tags: [review-list, review-card, edit-review, delete-review, fab, tanstack-query]
dependency_graph:
  requires: [02-03, 02-04]
  provides: [review-list-page, review-card, floating-action-button, delete-dialog, edit-review-page]
  affects: [root-layout]
tech_stack:
  added: [QueryClientProvider setup]
  patterns: [TanStack Query useQuery/useMutation, client components with router navigation, modal dialogs with focus trap]
key_files:
  created:
    - apps/web/components/review-card.tsx
    - apps/web/components/floating-action-button.tsx
    - apps/web/components/delete-dialog.tsx
    - apps/web/app/(app)/reviews/page.tsx
    - apps/web/app/(app)/reviews/[id]/edit/page.tsx
    - apps/web/components/query-provider.tsx
  modified:
    - apps/web/app/layout.tsx
decisions:
  - QueryProvider added at root layout level so TanStack Query works across all client pages
  - Edit page fetches all reviews and filters by ID (no single-review GET endpoint exists)
  - ReviewCard header row shows restaurant name inline for non-homemade; 'Homemade' badge for homemade type
metrics:
  duration_seconds: 125
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
---

# Phase 02 Plan 05: Review List, Edit, Delete, and FAB Summary

**One-liner:** Review list page at /reviews with ReviewCard, FAB, delete confirmation dialog, and edit page at /reviews/[id]/edit using ReviewComposer in edit mode.

---

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Build ReviewCard, FloatingActionButton, and DeleteDialog components | 88a488c | Done |
| 2 | Build review list page (/reviews) and edit page (/reviews/[id]/edit) | aeb0ccd | Done |

---

## What Was Built

### Components

**`ReviewCard`** (`apps/web/components/review-card.tsx`)
- Full-width photo thumbnail (160px height), restaurant name or Homemade badge
- Read-only StarRating with `size="sm"` (20px stars)
- Review note with 3-line `line-clamp` and "Show more / Show less" toggle
- Tags displayed as comma-separated text, meal date formatted as "Apr 29, 2026"
- Kebab menu (MoreHorizontal icon) with Pencil + "Edit" and Trash2 + "Delete" actions
- Card hover: `border-accent` transition

**`FloatingActionButton`** (`apps/web/components/floating-action-button.tsx`)
- Fixed `bottom-6 right-6 z-50`, 56x56px circular button
- Accent background (`#F97316`), white Plus icon (24px)
- `aria-label="Write a review"`, rendered as Next.js `<Link>` to `/reviews/new`
- Accent-tinted shadow, hover/active states with scale-95 on active

**`DeleteDialog`** (`apps/web/components/delete-dialog.tsx`)
- `role="dialog"` with `aria-modal` and `aria-labelledby`
- Title: "Delete this review?", body: "This can't be undone."
- "Keep Review" (outlined cancel) + "Delete" (destructive red confirm) — both 44px tall
- Focus trap: cancel button receives focus on open; Escape closes when not loading
- Loader2 spinner in confirm button when `loading={true}`

### Pages

**`/reviews`** (`apps/web/app/(app)/reviews/page.tsx`)
- TanStack Query `useQuery` with `queryKey: ['my-reviews']` to fetch `GET /api/v1/reviews`
- Reviews sorted reverse chronological (`createdAt` descending)
- Empty state: UtensilsCrossed icon + "No reviews yet" + "Tap + to log your first meal."
- Loading state: centered Loader2 spinner
- Delete flow: sets `deleteTargetId` state → opens DeleteDialog → `useMutation` calls `DELETE /api/v1/reviews/:id` → invalidates `['my-reviews']` query
- Edit flow: `router.push('/reviews/${id}/edit')` from ReviewCard's `onEdit`
- FloatingActionButton fixed bottom-right

**`/reviews/[id]/edit`** (`apps/web/app/(app)/reviews/[id]/edit/page.tsx`)
- Fetches all reviews via `useQuery({ queryKey: ['review', id] })` and filters by ID
- Passes `initialData` to `ReviewComposer mode="edit"` including id, mealType, rating, note, photoKey, tags, mealDate
- `onSuccess` callback navigates to `/reviews`
- "Delete review" text button (14px/semibold/destructive, right-aligned) opens DeleteDialog
- On delete confirm: calls `DELETE /api/v1/reviews/:id`, invalidates `['my-reviews']`, redirects to `/reviews`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added TanStack Query provider to root layout**
- **Found during:** Task 2 — `useQuery` requires `QueryClientProvider` in the tree
- **Issue:** No `QueryClientProvider` existed; TanStack Query hooks would throw at runtime
- **Fix:** Created `apps/web/components/query-provider.tsx` with `QueryClient` initialized in `useState` (per TanStack Query docs for Next.js App Router SSR safety), added `<QueryProvider>` wrapper to `apps/web/app/layout.tsx`
- **Files modified:** `apps/web/components/query-provider.tsx` (created), `apps/web/app/layout.tsx` (modified)
- **Commit:** aeb0ccd

---

## Known Stubs

- Edit page fetches all reviews and filters by ID because no single-review GET endpoint exists. This works correctly but is slightly less efficient than `GET /api/v1/reviews/:id`. A future plan can add the endpoint and update this page.
- `ReviewComposer` in edit mode receives `restaurantId` (from review data) but cannot populate the restaurant name display input — noted in STATE.md from Plan 04. The edit page does not resolve this; users will see the restaurant search field empty in edit mode for restaurant reviews.

---

## Self-Check

**Files created/exist:**
- apps/web/components/review-card.tsx — FOUND
- apps/web/components/floating-action-button.tsx — FOUND
- apps/web/components/delete-dialog.tsx — FOUND
- apps/web/app/(app)/reviews/page.tsx — FOUND
- apps/web/app/(app)/reviews/[id]/edit/page.tsx — FOUND
- apps/web/components/query-provider.tsx — FOUND

**Commits:**
- 88a488c — feat(02-05): add ReviewCard, FloatingActionButton, and DeleteDialog components
- aeb0ccd — feat(02-05): add review list page and edit page with TanStack Query

## Self-Check: PASSED
