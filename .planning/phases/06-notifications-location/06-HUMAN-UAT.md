---
status: partial
phase: 06-notifications-location
source: [06-VERIFICATION.md]
started: "2026-05-04T19:07:29.793Z"
updated: "2026-05-04T19:07:29.793Z"
---

## Current Test

[deferred — mobile device testing skipped by user during phase execution]

## Tests

### 1. Mobile notification bell appears in Profile tab header
expected: Bell icon visible in top-right of Profile tab; red dot appears when unread notifications exist; tapping navigates to NotificationsScreen
result: [pending]

### 2. NotificationsScreen renders notification rows
expected: FlatList shows rows with avatar + "@username followed you / liked your review of..." + relative time; infinite scroll loads more; red dot clears on open
result: [pending]

### 3. Mobile MapScreen renders from Search tab
expected: Map icon in Search tab header opens MapScreen; MapView renders with restaurant pins (red-orange for followed, gray for others); list panel filters by city search
result: [pending]

### 4. react-native-maps EAS dev build rebuild
expected: After running `eas build --profile development`, the new build includes react-native-maps and the map renders natively (no "Map requires a dev build" fallback message)
result: [pending — requires EAS rebuild first]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 1

## Gaps

- **Mobile connection refused** — `ERR_CONNECTION_REFUSED` when mobile app tries to reach the API. Fix: ensure web dev server is running on port 3000; use machine's local IP (not `localhost`) in `EXPO_PUBLIC_API_URL` when testing on a physical device.
- **EAS dev build required** — `react-native-maps` is a native module. Must run `cd apps/mobile && eas build --profile development --platform all` and install the new build before testing the map screen.
- **Android Maps API key** — `app.json` has placeholder `YOUR_ANDROID_MAPS_KEY`; replace via EAS secret before testing on Android device.
