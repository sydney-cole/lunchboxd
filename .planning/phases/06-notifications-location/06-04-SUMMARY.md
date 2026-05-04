---
phase: 06-notifications-location
plan: 04
subsystem: ui
tags: [notifications, maps, google-maps, react-google-maps, tanstack-query, notification-bell, infinite-scroll]

# Dependency graph
requires:
  - phase: 06-02
    provides: GET /api/v1/notifications, GET /api/v1/notifications/unread, PATCH /api/v1/notifications/read-all
  - phase: 06-03
    provides: GET /api/v1/restaurants/map, GET /api/v1/restaurants/reviewed
provides:
  - NotificationBell Client Component with 30s polling unread badge, dropdown panel, infinite scroll list
  - Nav bar with Lunchboxd wordmark, /map link, and NotificationBell in layout.tsx
  - Web map page at /map with Google Maps APIProvider + AdvancedMarker pins (social pin coloring)
  - Restaurant list panel with 300ms debounced search by neighborhood/city
affects: [06-05]

# Tech tracking
tech-stack:
  added:
    - "@vis.gl/react-google-maps — APIProvider, Map, AdvancedMarker, Pin, InfoWindow for web map"
  patterns:
    - "Bell icon with unread dot uses useQuery polling (refetchInterval: 30_000) + PATCH read-all on open"
    - "Notification panel uses useInfiniteQuery enabled only when isOpen — avoids fetching closed panel"
    - "Click-outside detection via useRef + mousedown document listener + panelRef check"
    - "Map pins use parseFloat(pin.lat/lng) — Drizzle numeric returns string, @vis.gl expects number"
    - "mapId passed to <Map> required for AdvancedMarker — falls back to DEMO_MAP_ID if env var absent"
    - "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is browser-exposed by Maps JS API design — must be restricted by HTTP referrer in Cloud Console"

key-files:
  created:
    - apps/web/components/notification-bell.tsx
    - apps/web/app/(app)/map/page.tsx
  modified:
    - apps/web/app/(app)/layout.tsx

key-decisions:
  - "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY separate from GOOGLE_PLACES_API_KEY (server-only) — browser exposure is Maps JS API design intent; key must be restricted by HTTP referrer"
  - "mapId on <Map> required for AdvancedMarker rendering — falls back to DEMO_MAP_ID for local dev if NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID not set"
  - "lat/lng parseFloat() conversion mandatory before passing to AdvancedMarker position — Drizzle numeric returns TypeScript string"
  - "Notification panel useInfiniteQuery enabled only when isOpen — avoids loading data before user opens panel"
  - "document.title set via useEffect in map page — metadata export not valid in 'use client' pages"

patterns-established:
  - "NotificationBell: polling badge query (30s) + panel infinite query (enabled: isOpen) + read-all PATCH on open"
  - "Map page: two independent queries — /restaurants/map for pins (no pagination), /restaurants/reviewed for list (with search)"

requirements-completed: [NOTF-03, LOCN-01, LOCN-02, LOCN-03]

# Metrics
duration: checkpoint-gated
completed: 2026-05-04
---

# Phase 6 Plan 04: Web Notification Bell and Map Page Summary

**NotificationBell Client Component with 30s polling + dropdown panel, and interactive /map page with Google Maps AdvancedMarker pins and socially-colored restaurant list**

## Performance

- **Duration:** checkpoint-gated (human visual verification required)
- **Started:** 2026-05-04
- **Completed:** 2026-05-04
- **Tasks:** 2 (+ 1 human checkpoint, approved)
- **Files modified:** 3

## Accomplishments

- NotificationBell component added to app layout nav bar — polls unread badge every 30s, shows red dot when unread, fires PATCH read-all on open, renders infinite-scroll notification list with avatar + action text + relative time
- Web map page at /map built with @vis.gl/react-google-maps — AdvancedMarker pins colored by social relationship (followed = #E85D4A, non-followed = #9CA3AF), InfoWindow on pin click
- Restaurant list panel on map page has 300ms debounced search filtering by neighborhood/city; null lat/lng restaurants appear in list only, not on map
- Human verified: bell icon visible in nav, red dot behavior correct, /map renders with New York default center, pins and list panel functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NotificationBell component and update layout.tsx** - `46f0181` (feat)
2. **Task 2: Create web map page at /map** - `2435867` (feat)

## Files Created/Modified

- `apps/web/components/notification-bell.tsx` — NotificationBell Client Component: bell icon, unread dot, dropdown panel, notification rows, infinite scroll sentinel
- `apps/web/app/(app)/map/page.tsx` — MapPage Client Component: APIProvider, Map, AdvancedMarker pins with social coloring, list panel with debounced search
- `apps/web/app/(app)/layout.tsx` — Server Component nav bar with Lunchboxd wordmark, /map link, NotificationBell import

## Decisions Made

- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is intentionally browser-exposed per Maps JS API design — separate from server-side GOOGLE_PLACES_API_KEY; must be restricted by HTTP referrer in Google Cloud Console
- mapId on Map component required for AdvancedMarker; falls back to 'DEMO_MAP_ID' string literal when NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID is absent (unblocks local dev)
- parseFloat() on lat/lng strings is mandatory before passing to position props — Drizzle numeric type contract returns string; @vis.gl/react-google-maps expects number
- Notification panel useInfiniteQuery is enabled only when isOpen to avoid loading list data before user opens the panel
- document.title set via useEffect in map page — 'use client' pages cannot export metadata

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — both tasks passed build and human visual verification on first attempt.

## User Setup Required

Two environment variables must be present in `.env.local` for the map page to render:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps JavaScript API key (same key value as GOOGLE_PLACES_API_KEY is acceptable; restrict to production domain HTTP referrer in Google Cloud Console)
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — Map ID from Google Cloud Console → Google Maps Platform → Map Management. Use `DEMO_MAP_ID` for local development to unblock AdvancedMarker rendering.

The map falls back to `DEMO_MAP_ID` in the `mapId` prop if the env var is not set, so local dev works without Map ID configuration.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: browser-key-exposure | apps/web/app/(app)/map/page.tsx | NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is intentionally browser-exposed — mitigate by restricting to production domain via HTTP referrer in Cloud Console (T-06-04-01, accepted) |

## Next Phase Readiness

- Wave 3 web UI is complete — 06-04 done
- 06-05 (Mobile NotificationsScreen + MapScreen) is the final plan needed to complete Phase 6
- No blockers; mobile plan can proceed immediately

---
*Phase: 06-notifications-location*
*Completed: 2026-05-04*
