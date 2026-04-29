---
phase: 02-reviews-meals
depth: standard
status: findings
files_reviewed: 30
findings:
  critical: 4
  warning: 8
  info: 6
  total: 18
---

# Code Review: Phase 02 — Reviews & Meals

## Summary

30 files reviewed across mobile components, web components, API route handlers, shared schemas, and tests. The API layer and schema design are generally solid — authentication is enforced on every route, Zod validation is used consistently, and IDOR protection is in place. However, four critical issues were found: a missing auth header in the mobile photo upload, a race condition that can create duplicate manual restaurant entries, a non-atomic tag-update in the PATCH route, and a presigned URL that is scoped with no object ownership check allowing any authenticated user to overwrite any object key. Eight warnings cover logic bugs (edit page fetching all reviews to find one, stale restaurant cache skipping Places API, object URL leak, homemade restaurant validation gap) and bad error handling patterns. Six info-level items cover minor improvements.

---

## Findings

### CR-001: Mobile photo upload sends no auth header — presigned URL endpoint is reachable but the upload request itself is unauthenticated (critical)
**File:** `apps/mobile/components/photo-picker.tsx:37-41`
**Issue:** The mobile `PhotoPicker` POSTs to `/api/v1/uploads` to obtain a presigned URL without attaching the Clerk Bearer token. The `uploads` route handler calls `auth()` and will return 401, causing every mobile photo upload to fail silently (the error is caught and the user sees "Photo upload failed").
**Fix:** Obtain the auth token with `useAuth().getToken()` (already imported in `compose.tsx`) and pass `Authorization: Bearer <token>` in the fetch headers to `/api/v1/uploads`.

---

### CR-002: Presigned URL key path includes clerkId but no server-side ownership check — any authenticated user can reference any object key (critical)
**File:** `apps/web/app/api/v1/uploads/route.ts:41` and `apps/web/app/api/v1/reviews/route.ts:23-25`
**Issue:** The upload key format is `reviews/<clerkId>/<uuid>`. The `/api/v1/reviews` POST endpoint accepts any `photoKey` string in the body and constructs `R2_PUBLIC_URL/<photoKey>` without verifying that the key belongs to the authenticated user. A malicious user can supply `photoKey: "reviews/otherClerkId/some-uuid"` to attach another user's photo — or any arbitrary path — to their review. The key is also not validated against a UUID format, so path traversal strings like `../../secret` would be stored verbatim in `photoUrl`.
**Fix:** (1) Validate `photoKey` with a strict regex (e.g. `^reviews/[a-zA-Z0-9_-]+/[0-9a-f-]{36}$`) in the Zod schema or in the route before constructing the URL. (2) Enforce that the `clerkId` segment in the key matches the authenticated caller's `clerkId`. Same fix applies to the PATCH route (`apps/web/app/api/v1/reviews/[id]/route.ts:43-47`).

---

### CR-003: Tag replacement in PATCH route is non-atomic — partial failure leaves inconsistent tag state (critical)
**File:** `apps/web/app/api/v1/reviews/[id]/route.ts:56-65`
**Issue:** The tag update performs two independent database operations: first a DELETE then an INSERT. If the INSERT throws (e.g. constraint violation, connection drop) after the DELETE succeeds, the review is left with zero tags. There is no transaction wrapping these operations.
**Fix:** Wrap the delete and re-insert (and the review UPDATE above) in a single `db.transaction()` call so the whole patch is atomic.

---

### CR-004: Race condition on manual restaurant creation creates duplicate entries (critical)
**File:** `apps/mobile/components/restaurant-search.tsx:81-103` and `apps/web/components/restaurant-search.tsx:96-118`
**Issue:** When a user clicks "Add manually", the component POSTs to `/api/v1/restaurants`. On failure (network error or non-OK response), the component falls back to a client-side `manual-${Date.now()}` id. If the server did actually create the row but the response was lost in transit, the next submit will create a second duplicate row. Additionally, the `restaurants` table has no unique constraint on `(name, source='manual')`, so fast double-taps can create two rows with identical names.
**Fix:** (1) Add a server-side idempotency check (e.g. upsert on name+source for manual entries, or rely on a unique index). (2) The fallback client id `manual-${Date.now()}` will be sent as `restaurantId` in the review payload, which will fail Zod's `.uuid()` validation — this is a secondary crash.

---

### CR-005: Edit page fetches ALL user reviews to find one by id — O(N) fetch, leaks full review list (warning)
**File:** `apps/web/app/(app)/reviews/[id]/edit/page.tsx:26-51`
**Issue:** `fetchAllReviews()` fetches every review for the user and then finds the target by id on the client. This is inefficient for users with many reviews and unnecessarily exposes the full review list to the browser. If the target review was deleted between the list fetch and the find, `review` is `null` and the error state is shown — but this path is already handled.
**Fix:** Add a `GET /api/v1/reviews/:id` endpoint that returns a single review, and use that in the edit page query. In the interim, at minimum add `select: { reviewId: id }` as a query option to avoid re-fetching on unrelated invalidations.

---

### CR-006: Restaurant search skips Google Places call entirely when ANY local result exists — stale/partial cache (warning)
**File:** `apps/web/app/api/v1/restaurants/search/route.ts:16-20`
**Issue:** The search route returns cached DB results immediately if any local row matches. A restaurant named "Taco" that was manually entered will prevent the Google Places API from ever being called for any query containing "taco", even if far better matches exist. This degrades search quality over time as the local cache grows.
**Fix:** Return cached results first but also call the Places API in parallel (or always call it and merge), using the cache as supplemental data rather than a short-circuit guard.

---

### CR-007: Object URL created in web PhotoPicker is not always revoked on unmount — memory leak (warning)
**File:** `apps/web/components/photo-picker.tsx:35` and `84-86`
**Issue:** `URL.createObjectURL(file)` is called and stored in `previewUrl`. It is revoked in `handleRemove` but not in a `useEffect` cleanup. If the component unmounts while a photo is selected (e.g. user navigates away mid-upload), the object URL is leaked for the lifetime of the document.
**Fix:** Add a `useEffect` that returns `() => { if (previewUrl) URL.revokeObjectURL(previewUrl) }` with `[previewUrl]` as dependency.

---

### CR-008: ReviewComposer in edit mode initialises restaurant state with empty name — "restaurant" chip displays blank (warning)
**File:** `apps/web/components/review-composer.tsx:32-36`
**Issue:** When `initialData.restaurantId` is set, `restaurant` state is initialised as `{ id: initialData.restaurantId, name: '' }`. The `RestaurantSearch` component's selected-state rendering shows `value.name`, so the restaurant chip will be blank until the user clears and re-selects. This is a display bug that could lead a user to believe no restaurant is attached when editing.
**Fix:** Pass the restaurant name through `initialData` (e.g. from the existing `restaurant?.name` already available in the `Review` type returned by the API) and use it during state initialisation.

---

### CR-009: `reviewSchema` makes `rating` optional — API accepts review creation with no rating, contradicting UI enforcement (warning)
**File:** `packages/shared/src/schemas/index.ts:28`
**Issue:** `rating` is `z.number().min(0.5).max(5).multipleOf(0.5).optional()`. This means the POST `/api/v1/reviews` handler will accept and persist a review with `rating: undefined`, storing `null` in the `rating` column. The UI enforces a rating client-side, but any direct API call can create a ratingless review. Review cards handle `null` gracefully (shows `— / 5`) so there is no crash, but the data model allows records that the product does not intend.
**Fix:** Make `rating` required in `reviewSchema` (remove `.optional()`). If partial updates need it optional, create a separate `updateReviewSchema` that marks all fields optional.

---

### CR-010: `fanOutToFollowers` is called inside the POST request handler synchronously — slow fan-out blocks HTTP response (warning)
**File:** `apps/web/app/api/v1/reviews/route.ts:48`
**Issue:** For a user with many followers, `fanOutToFollowers` issues one DB write per follower sequentially inside `Promise.all`, all within the HTTP request lifecycle. A user with 1000 followers will have a noticeably slow review creation response. A DB failure during fan-out causes a 500 response even though the review was already inserted.
**Fix:** Either use a bulk insert (`db.insert(feedItems).values(feedRows)` already does this — this is actually fine for small follower counts) but the fan-out should be moved to a background job or queue for scale. At minimum, do not let fan-out failure roll back or mask the review creation success — catch and log separately.

---

### CR-011: `review-card.tsx` renders restaurant name twice for non-homemade reviews (warning)
**File:** `apps/web/components/review-card.tsx:73-75` and `119-123`
**Issue:** The header row renders `restaurantName` in a `<span>` (line 73), and separately, a second `<p>` at line 119-123 renders `review.restaurant.name` again for non-homemade reviews with a restaurant. Both blocks render in normal cases, showing the restaurant name duplicated in the card.
**Fix:** Remove one of the two renderings. The conditional at line 73 renders an empty string for non-homemade, so the intent appears to be that line 119-123 is the primary display — remove lines 73-75 or guard line 119-123 behind a "secondary detail" flag.

---

### CR-012: `review-card.tsx` always renders "Show more / Show less" toggle even for short notes (warning)
**File:** `apps/web/components/review-card.tsx:146-153`
**Issue:** The expand/collapse toggle button is rendered whenever `review.body` is truthy, regardless of whether the body is actually clamped. A one-line note will show a "Show more" button that does nothing meaningful (CSS line-clamp won't clamp a short string).
**Fix:** Either use a `useRef` + `scrollHeight > clientHeight` check to detect overflow, or conditionally show the toggle only after expanding once (toggle always starts hidden, shows "Show less" after expand).

---

### CR-013: `restaurants/route.ts` (POST) has no length cap on restaurant name — unbounded string insert (info)
**File:** `apps/web/app/api/v1/restaurants/route.ts:10-13`
**Issue:** The only validation is `name.trim().length === 0`. There is no maximum length check, allowing arbitrarily long names to be stored. The schema defines `name` as `text` (unlimited in PostgreSQL) so there is no DB-level guard either.
**Fix:** Add `name.trim().length > 200` (or similar) guard and return 400. Alternatively add a `restaurantCreateSchema` using Zod with `.max(200)`.

---

### CR-014: `linearGradient` id in SVG star is not unique across multiple star components on the same page (info)
**File:** `apps/web/components/star-rating.tsx:44` and `64`
**Issue:** The gradient `id` is `star-gradient-${starIndex}` (1–5). When two `StarRating` components exist on the same page (e.g. a list of review cards), all half-star gradients from the second component will reference the first component's `<defs>`, which may already be fully-filled or empty. The result is incorrect star fill colors in read-only display contexts.
**Fix:** Include a stable component-instance id in the gradient id (e.g. using `useId()` from React 18) to make each gradient globally unique.

---

### CR-015: Mobile `tag-input.tsx` uses array index as React key for tag chips (info)
**File:** `apps/mobile/components/tag-input.tsx:54`
**Issue:** `key={index}` is used for tag chips. When a tag is removed from the middle of the array, React will reuse DOM nodes keyed by position, which can cause animation glitches or stale state if the chip component ever becomes stateful.
**Fix:** Use `key={tag}` (tags are unique by the `!tags.includes(tag)` check) or `key={\`${tag}-${index}\`}` as the web version does.

---

### CR-016: `mealDate` is accepted as a free-text input on mobile with no format validation before submit (info)
**File:** `apps/mobile/app/(app)/(tabs)/compose.tsx:180-189`
**Issue:** The mobile compose screen uses a plain `TextInput` with `placeholder="YYYY-MM-DD"` and no date format validation before the payload is built. An invalid string like "yesterday" passes through to the API, where it will fail Zod's regex but only after submission. The error is swallowed into the generic "Something went wrong" message with no field-level feedback.
**Fix:** Either use a native `DateTimePicker` component, or validate the `mealDate` string client-side against `/^\d{4}-\d{2}-\d{2}$/` and show an inline error before calling `handleSubmit`.

---

### CR-017: `STAR_PATH` constant is defined in mobile `star-rating.tsx` but never used (info)
**File:** `apps/mobile/components/star-rating.tsx:12-13`
**Issue:** `const STAR_PATH = 'M16 2.5L19.708...'` is declared at module level but the component uses text-based Unicode stars (`★`) instead of SVG. The dead constant adds noise.
**Fix:** Remove the unused constant.

---

### CR-018: Test coverage for auth/IDOR scenarios is all `.todo` — critical security paths untested (info)
**File:** `apps/web/__tests__/reviews.test.ts:61-68`
**Issue:** The test cases for "PATCH returns 403 when caller is not review owner" (REVW-06) and "DELETE sets deleted_at timestamp" (REVW-07) are all `.todo`. These are exactly the IDOR protections added in `reviews/[id]/route.ts`. Without integration tests, a future refactor of the ownership check could silently regress.
**Fix:** Implement these integration tests against a test database (Neon branch or in-memory SQLite with Drizzle) as a priority before Phase 03.

---

## No Issues

The following files had no significant findings:

- `apps/web/components/delete-dialog.tsx` — focus management, Escape handling, and backdrop click are all correct.
- `apps/web/components/floating-action-button.tsx` — clean and correct.
- `apps/web/components/meal-type-toggle.tsx` (web) and mobile equivalent — correct ARIA usage.
- `apps/web/components/query-provider.tsx` — standard, correct QueryClient instantiation via `useState`.
- `apps/web/lib/schema.ts` — partial unique index on `placeId` for Google Places, correct soft-delete pattern, correct follower graph indices.
- `packages/shared/src/types/index.ts` — types match schema correctly.
- `apps/web/__tests__/restaurants.test.ts` — schema-level tests are correct and pass.
- `apps/web/app/(app)/reviews/new/page.tsx` — trivial wrapper, no issues.
- `apps/web/app/(app)/reviews/page.tsx` — correct client-side sort, correct delete-mutation flow.
- `apps/web/lib/queries.ts` — `fanOutToFollowers` bulk insert is correct (single `values(feedRows)` call).
