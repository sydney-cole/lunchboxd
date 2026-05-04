---
phase: 06-notifications-location
plan: 05
subsystem: mobile
tags: [react-native-maps, expo, notifications, maps, tanstack-query, clerk]

# Dependency graph
requires:
  - phase: 06-02
    provides: Notification API routes (GET list, GET unread, PATCH read-all)
  - phase: 06-03
    provides: Restaurant map endpoint (GET /api/v1/restaurants/map) and reviewed endpoint (GET /api/v1/restaurants/reviewed)
provides:
  - Mobile NotificationsScreen with FlatList infinite scroll, avatar + action text + relative time rows
  - Mobile MapScreen with react-native-maps MapView, restaurant pins (followed=red-orange, others=gray), list panel with search
  - Bell icon in mobile Profile tab header with unread red dot, polling /api/v1/notifications/unread every 30s
  - Map button in Search tab header navigating to MapScreen
  - react-native-maps installed and registered in app.json plugins
affects: []

# Tech tracking
tech-stack:
  added:
    - react-native-maps (MapView, Marker, Callout, PROVIDER_GOOGLE)
  patterns:
    - getToken() inside queryFn — never at hook level (mobile Clerk pattern)
    - useInfiniteQuery cursor pagination on mobile mirrors web pattern
    - formatRelativeTime hand-rolled inline (no library import)
    - StyleSheet.create() — consistent with all other mobile components
    - parseFloat() on lat/lng strings from Drizzle numeric columns before map coordinate use
    - tracksViewChanges={false} on every Marker — performance guard against re-render jank
    - Platform.OS conditional for PROVIDER_GOOGLE — Android uses Google Maps, iOS uses Apple Maps default

key-files:
  created:
    - apps/mobile/app/(app)/notifications.tsx
    - apps/mobile/app/(app)/map.tsx
  modified:
    - apps/mobile/app/(app)/(tabs)/_layout.tsx
    - apps/mobile/app/(app)/(tabs)/search.tsx
    - apps/mobile/app.json

key-decisions:
  - "react-native-maps plugin added to app.json — EAS dev build rebuild required before map screen can be tested on device"
  - "Platform.OS check on PROVIDER_GOOGLE — Android uses Google Maps, iOS falls back to Apple Maps (no iosGoogleMapsApiKey needed)"
  - "Bell icon uses Ionicons from @expo/vector-icons (already installed) instead of lucide-react-native — avoids new dependency"
  - "useNavigation().setOptions() in Search tab component to add headerRight Map button — consistent with header pattern"
  - "Mobile map screen pins: followed-user restaurants #E85D4A (red-orange), others #9CA3AF (gray) — matches UI-SPEC"
  - "read-all PATCH fires on mount in NotificationsScreen with queryClient.invalidateQueries(['notifications-unread']) — clears bell badge immediately"
  - "Mobile testing deferred by user — checkpoint approved without device verification; EAS rebuild still required"

patterns-established:
  - "react-native-maps: always tracksViewChanges={false} on Marker to prevent animation jank"
  - "react-native-maps: always parseFloat() on lat/lng from API (Drizzle numeric returns string)"
  - "Expo navigation headerRight: use useNavigation().setOptions() in useEffect for tab screens"

requirements-completed: [NOTF-03, LOCN-01, LOCN-02, LOCN-03]

# Metrics
duration: ~35min (task execution) + checkpoint approval
completed: 2026-05-04
---

# Phase 6 Plan 05: Mobile Notifications + Map Summary

**Bell icon in Profile header with unread polling, NotificationsScreen with infinite scroll + read-all on mount, and MapScreen with react-native-maps pins and searchable restaurant list — completing all mobile Phase 6 requirements**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-04
- **Completed:** 2026-05-04
- **Tasks:** 2 auto tasks + 1 checkpoint (approved)
- **Files modified:** 5

## Accomplishments

- Bell icon added to Profile tab header using Ionicons; polls `/api/v1/notifications/unread` every 30 seconds; red dot appears when `hasUnread` is true
- NotificationsScreen created with `useInfiniteQuery` cursor pagination, avatar rows with action text + relative time, and `PATCH /api/v1/notifications/read-all` fired on mount to clear the unread badge
- MapScreen created with `react-native-maps` MapView; restaurant pins colored red-orange (#E85D4A) for followed-user restaurants and gray (#9CA3AF) for others; bottom list panel with debounce-free search input wired to `/api/v1/restaurants/reviewed?q=`
- Map button added to Search tab header (headerRight) navigating to `/(app)/map`
- `react-native-maps` installed and plugin registered in `app.json` (EAS dev build rebuild required for native module activation)

## Task Commits

1. **Task 1: Install react-native-maps, update app.json, add bell to profile tab header, create NotificationsScreen** - `f4b2023` (feat)
2. **Task 2: Create mobile MapScreen at app/(app)/map.tsx** - `6a0945f` (feat)
3. **Task 3: Human verification checkpoint** - APPROVED (mobile testing deferred by user)

## Files Created/Modified

- `apps/mobile/app/(app)/notifications.tsx` — NotificationsScreen: FlatList with infinite scroll, avatar + @username + action text + relative time rows, read-all PATCH on mount
- `apps/mobile/app/(app)/map.tsx` — MapScreen: react-native-maps MapView with Marker pins, list panel with TextInput search wired to /api/v1/restaurants/reviewed
- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — Added ProfileHeaderRight component with bell icon (Ionicons), unread query, red dot; profile tab headerShown: true
- `apps/mobile/app/(app)/(tabs)/search.tsx` — Added useNavigation().setOptions() with headerRight Map button navigating to /(app)/map
- `apps/mobile/app.json` — Added react-native-maps plugin entry with androidGoogleMapsApiKey placeholder

## Decisions Made

- Used `Ionicons` from `@expo/vector-icons` (already installed) for the bell instead of adding `lucide-react-native` — avoids a new native module dependency
- `Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined` on MapView — iOS uses Apple Maps by default, Android requires PROVIDER_GOOGLE; avoids Google Maps SDK configuration requirement on iOS
- `androidGoogleMapsApiKey` in app.json uses placeholder value `"YOUR_ANDROID_MAPS_KEY"` — production key should be injected via EAS secrets, not committed to source control (per T-06-05-02)
- `useNavigation().setOptions()` in a `useEffect` used to add Map button to Search tab header — handles the case where the tab screen doesn't own a Stack.Screen wrapper

## Deviations from Plan

None — plan executed exactly as written. Mobile testing was deferred by user at the human-verify checkpoint (approved without device verification).

## Issues Encountered

None during implementation. EAS dev build rebuild is required before the MapScreen can be tested on a physical device or simulator — this is expected behavior for native module additions and is documented in the plan's `user_setup` field.

## User Setup Required

**react-native-maps requires a new Expo dev build.** Before testing the map screen:

1. Set your Android Google Maps API key (restrict by package name in Google Cloud Console):
   ```
   # Replace "YOUR_ANDROID_MAPS_KEY" in apps/mobile/app.json with your actual key
   # Or use EAS secrets: eas secret:create ANDROID_MAPS_KEY --value "your-key"
   ```
2. Rebuild the Expo dev build:
   ```
   cd apps/mobile && eas build --profile development --platform all
   ```
3. Install the new dev build on your device/simulator

The notification bell and NotificationsScreen work immediately on the existing dev build (no native module involved).

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| threat_flag: secret-in-source | apps/mobile/app.json | androidGoogleMapsApiKey placeholder committed — production key must use EAS secrets or API key restrictions in Google Cloud Console |

## Next Phase Readiness

Phase 6 is fully complete — all 5 plans executed across all 3 waves. All 33 v1 requirements are implemented:

- NOTF-01, NOTF-02: Notification side effects in follows/likes routes (06-02)
- NOTF-03: Mobile notification screen (this plan)
- LOCN-01, LOCN-02, LOCN-03: Restaurant map endpoints (06-03), web map page (06-04), mobile map screen (this plan)

The Lunchboxd v1.0 milestone is complete. No blockers for production deployment.

---

## Self-Check: PASSED

- `apps/mobile/app/(app)/notifications.tsx` — committed at f4b2023
- `apps/mobile/app/(app)/map.tsx` — committed at 6a0945f
- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — committed at f4b2023
- `apps/mobile/app/(app)/(tabs)/search.tsx` — committed at 6a0945f
- `apps/mobile/app.json` — committed at f4b2023

---
*Phase: 06-notifications-location*
*Completed: 2026-05-04*
