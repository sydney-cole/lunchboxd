---
phase: 02-reviews-meals
plan: 06
subsystem: mobile-ui
tags: [expo, react-native, expo-image-picker, nativewind, clerk-expo, mobile-composer]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [mobile-composer-screen, mobile-star-rating, mobile-tag-input, mobile-restaurant-search, mobile-photo-picker, mobile-meal-type-toggle]
  affects: [mobile-tabs-layout]
tech_stack:
  added: [expo-image-picker ~55.0.19 (already present in package.json)]
  patterns:
    - "React Native StyleSheet API for all component styling using @lunchboxd/shared design tokens"
    - "Pressable with left/right absolute zones for half-star rating touch areas"
    - "debounced fetch in useCallback + useEffect for mobile restaurant autocomplete"
    - "expo-image-picker launchImageLibraryAsync → fetch blob → PUT presigned URL for photo upload"
    - "Clerk getToken() + Authorization Bearer header for mobile API requests (no cookies)"
    - "keyboardShouldPersistTaps handled on ScrollView for autocomplete tap through"
key_files:
  created:
    - apps/mobile/components/meal-type-toggle.tsx
    - apps/mobile/components/star-rating.tsx
    - apps/mobile/components/tag-input.tsx
    - apps/mobile/components/restaurant-search.tsx
    - apps/mobile/components/photo-picker.tsx
    - apps/mobile/app/(app)/(tabs)/compose.tsx
  modified: []
decisions:
  - "Star rating uses Text character stars (★) instead of react-native-svg to avoid native module dependency"
  - "RestaurantSearch dropdown renders as ScrollView below input (not floating) to avoid z-index issues on mobile"
  - "Photo picker uses emoji camera icon instead of a vector icon library to minimize native dependencies"
  - "Clerk Bearer token obtained via getToken() from useAuth hook — API routes accept both cookies and Bearer tokens"
metrics:
  duration_seconds: 90
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 0
---

# Phase 02 Plan 06: Mobile Review Composer Summary

**One-liner:** Expo mobile review composer screen at /compose tab with five React Native input components (MealTypeToggle, StarRating, TagInput, RestaurantSearch, PhotoPicker) submitting to POST /api/v1/reviews with Clerk Bearer token auth.

---

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Install expo-image-picker and build mobile input components | 8ca5255 | Done |
| 2 | Build mobile composer screen wiring all components | abbdc0c | Done |
| 3 | Verify end-to-end review creation flow on web | — | CHECKPOINT: Awaiting human verification |

---

## What Was Built

### Mobile Input Components (`apps/mobile/components/`)

**`MealTypeToggle`** (`meal-type-toggle.tsx`)
- Two TouchableOpacity buttons side by side, full-width, 44px height, 12px borderRadius
- Selected: accent (`#F97316`) background, white text, fontWeight 600
- Unselected: surface background, text-primary color, fontWeight 400
- Props: `value: 'restaurant' | 'homemade'`, `onChange: (v) => void`

**`StarRating`** (`star-rating.tsx`)
- 5 text-character stars (★) with separate Pressable left/right half-zones for 0.5 increment selection
- Selected fill: `#F97316`, unselected: `#E7D5C5`; half-star overlays left star half with clipped View
- 32px star size, 44px container height for touch target compliance
- Displays `{value} / 5` label below in text-secondary color
- Props: `value: number`, `onChange: (v: number) => void`, `readOnly?: boolean`

**`TagInput`** (`tag-input.tsx`)
- TextInput (16px, 44px height) with onSubmitEditing and comma detection to commit tags
- Tag chips with surface bg, border, 4px borderRadius, × remove Pressable
- `flexWrap: 'wrap'` chip container
- Props: `tags: string[]`, `onChange: (tags: string[]) => void`

**`RestaurantSearch`** (`restaurant-search.tsx`)
- TextInput with 300ms debounced API call to `GET ${API_BASE_URL}/api/v1/restaurants/search?q=`
- ScrollView results list below input with `keyboardShouldPersistTaps="handled"`
- "Add manually" option when results empty — calls `POST ${API_BASE_URL}/api/v1/restaurants`
- Selected state shows restaurant name with × to clear
- Props: `value: { id: string; name: string } | null`, `onChange: (v) => void`

**`PhotoPicker`** (`photo-picker.tsx`)
- Dashed-border Pressable, 80px tall, camera emoji + "Add photo" text
- On press: `ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })`
- Thumbnail preview (80x80, borderRadius 8) with upload spinner overlay
- Presigned URL flow: POST `/api/v1/uploads` → fetch blob → PUT to R2
- Error display in destructive color on failure
- Props: `photoKey: string | null`, `onPhotoChange: (key: string | null) => void`

### Composer Screen

**`compose.tsx`** (`apps/mobile/app/(app)/(tabs)/compose.tsx`)
- `KeyboardAvoidingView` wrapping `ScrollView` with `keyboardShouldPersistTaps="handled"`
- Background: `colors.bg` (#FFF8F0), padding: xl (32px)
- Field order matches web composer (D-01): Title → MealTypeToggle → RestaurantSearch (hidden when homemade) → StarRating → note TextInput → PhotoPicker → TagInput → date TextInput → Submit
- Form state via useState for all fields (same pattern as web ReviewComposer)
- Validation: rating required ("Please add a rating." error shown)
- Submit: `POST ${API_BASE_URL}/api/v1/reviews` with `Authorization: Bearer ${await getToken()}` header
- Loading state: ActivityIndicator in submit button, button disabled with opacity: 0.5
- On success: `router.replace('/(app)/(tabs)/')` navigates back to home tab

---

## Deviations from Plan

None - plan executed exactly as written. All components were already built and committed in prior executions. This execution verified all acceptance criteria and created the SUMMARY.

---

## Known Stubs

- **PhotoPicker camera icon**: Uses emoji (📷) rather than a proper camera SVG icon. Works functionally but is not pixel-perfect per UI-SPEC. A future plan can replace with a proper icon library.
- **Date field**: Uses plain TextInput accepting `YYYY-MM-DD` string rather than a native date picker. This is the MVP approach specified in the plan. Acceptable for v1; a future plan can add `@react-native-community/datetimepicker` for a better UX.
- **Restaurant name in edit mode**: Mobile composer has no edit mode yet, so the restaurant name stub from Plan 04 does not affect this plan.

---

## Self-Check

**Files created/exist:**
- apps/mobile/components/meal-type-toggle.tsx — FOUND
- apps/mobile/components/star-rating.tsx — FOUND
- apps/mobile/components/tag-input.tsx — FOUND
- apps/mobile/components/restaurant-search.tsx — FOUND
- apps/mobile/components/photo-picker.tsx — FOUND
- apps/mobile/app/(app)/(tabs)/compose.tsx — FOUND

**Commits:**
- 8ca5255 — feat(02-06): install expo-image-picker and build mobile input components
- abbdc0c — feat(02-06): build mobile composer screen wiring all components

## Self-Check: PASSED
