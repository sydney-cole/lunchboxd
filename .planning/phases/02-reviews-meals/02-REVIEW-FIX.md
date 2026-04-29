---
phase: 02-reviews-meals
status: all_fixed
fix_scope: critical_warning
findings_in_scope: 12
fixed: 12
skipped: 0
iteration: 1
---

# Code Review Fix Report: Phase 02

## Fixed

### CR-001: Mobile photo upload sends no auth header
**Fix applied:** Added `onGetToken: () => Promise<string | null>` prop to mobile `PhotoPicker`. Token is fetched before the presigned URL request and passed as `Authorization: Bearer <token>`. `compose.tsx` passes `getToken` from `useAuth()`.
**Commit:** fix(02-reviews): add auth header to mobile photo upload (CR-001)

---

### CR-002: No ownership check on photoKey — IDOR
**Fix applied:** In both `reviews/route.ts` (POST) and `reviews/[id]/route.ts` (PATCH), added validation that `photoKey` matches `^reviews/[a-zA-Z0-9_-]+/[0-9a-f-]{36}$` and that the clerkId path segment equals the authenticated caller's `clerkId`. Returns 400 on mismatch.
**Commit:** fix(02-reviews): validate photoKey ownership on POST and PATCH (CR-002)

---

### CR-003: Non-atomic tag replacement in PATCH
**Fix applied:** Wrapped the review `UPDATE`, tag `DELETE`, and tag `INSERT` in a single `db.transaction(async (tx) => { ... })` call using Drizzle's transaction API. Partial failure now rolls back all three operations atomically.
**Commit:** fix(02-reviews): wrap PATCH tag replacement in db.transaction (CR-003)

---

### CR-004: Manual restaurant fallback uses invalid `manual-${Date.now()}` id
**Fix applied:** In both web and mobile `RestaurantSearch`, removed the client-side fallback entirely. On POST failure (non-OK response or network error), `setError('Could not save restaurant. Please try again.')` is called and `onChange` is not called. The user must retry — no invalid UUID is ever submitted.
**Commit:** fix(02-reviews): remove invalid manual-${Date.now()} restaurant fallback (CR-004)

---

### CR-005: Edit page fetches all reviews to find one by id
**Fix applied:** Added `GET /api/v1/reviews/:id` handler in `reviews/[id]/route.ts` that returns the single review with tags and restaurant, enforcing ownership. Edit page now calls `fetchReviewById(id)` which fetches only `GET /api/v1/reviews/:id`.
**Commit:** fix(02-reviews): add GET /reviews/:id endpoint and update edit page (CR-005, CR-009)

---

### CR-006: Restaurant search short-circuits on any local cache hit
**Fix applied:** Changed the short-circuit condition from `cached.length > 0` to `cached.length >= 5`. When fewer than 5 local results exist, the Places API is always called and results are merged (deduped by id, capped at 5). Falls back to cached results if Places API fails.
**Commit:** fix(02-reviews): always call Places API unless cache has 5+ results (CR-006)

---

### CR-007: Object URL not revoked on unmount in web PhotoPicker
**Fix applied:** Added `useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) } }, [previewUrl])`. The cleanup runs whenever `previewUrl` changes (revoking the previous URL) and on component unmount.
**Commit:** fix(02-reviews): revoke object URL on unmount in web PhotoPicker (CR-007)

---

### CR-008: Edit mode initialises restaurant state with empty name
**Fix applied:** Added `restaurantName?: string` to `ReviewComposerProps.initialData`. Restaurant state is now initialised as `{ id, name: initialData.restaurantName ?? '' }`. The edit page passes `review.restaurant?.name` as `restaurantName`.
**Commit:** fix(02-reviews): populate restaurant name in edit mode composer (CR-008)

---

### CR-009: `rating` is optional in reviewSchema — API accepts ratingless reviews
**Fix applied:** Removed `.optional()` from `rating` in `reviewSchema` — POST now requires a rating. Added `updateReviewSchema = reviewSchema.partial()` for PATCH where all fields are optional. PATCH route uses `updateReviewSchema`. Exported `UpdateReviewInput` type.
**Commit:** fix(02-reviews): add GET /reviews/:id endpoint and update edit page (CR-005, CR-009)

---

### CR-010: fanOutToFollowers failure masks review creation success
**Fix applied:** Wrapped `await fanOutToFollowers(...)` in `try/catch`. Error is logged via `console.error` but not re-thrown. Review creation response (`201`) is returned regardless of fan-out outcome.
**Commit:** fix(02-reviews): catch fanOutToFollowers failure without returning 500 (CR-010)

---

### CR-011: Restaurant name rendered twice in review-card
**Fix applied:** Removed the secondary `<p>` block that re-rendered `review.restaurant.name` below the header row. The header `<span>` now renders `restaurantName` unconditionally (which is `'Homemade'` or the restaurant name or `'Unknown Restaurant'`). The redundant "Homemade" badge span was also removed since the name is now always shown.
**Commit:** fix(02-reviews): remove duplicate restaurant name and guard Show more toggle (CR-011, CR-012)

---

### CR-012: "Show more" toggle renders for short notes
**Fix applied:** Added `bodyRef` (ref on the `<p>` element) and a `useEffect` that sets `isClamped` based on `scrollHeight > clientHeight`. The Show more/less button is only rendered when `isClamped || expanded` is true, so one-line notes never show the toggle.
**Commit:** fix(02-reviews): remove duplicate restaurant name and guard Show more toggle (CR-011, CR-012)

---

## Skipped / Partial

None — all 12 findings in scope were fixed.
