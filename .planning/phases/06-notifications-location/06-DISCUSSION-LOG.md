# Phase 6: Notifications & Location - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 06-notifications-location
**Areas discussed:** Notification delivery, Notification center UI, Unread badge & freshness, Map library & scope

---

## Notification Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in route handlers | After follow/like INSERT, immediately INSERT notification row in same handler. Simple, synchronous. | ✓ |
| Shared helper function | Extract createNotification() utility called from routes. Same behavior but more structured. | |
| Background job / queue | Async event-driven. Adds infra complexity. | |

**User's choice:** Inline in route handlers

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, skip self-notifications | Guard: if actorId === userId, skip INSERT. | ✓ |
| No, allow self-notifications | Simpler code, no guard. | |
| You decide | Claude handles edge case. | |

**User's choice:** Skip self-notifications (actorId === userId guard)

---

## Notification Center UI

| Option | Description | Selected |
|--------|-------------|----------|
| Bell icon → dropdown panel | Bell in top nav bar, click opens slide-down panel. No page navigation. | ✓ |
| Dedicated /notifications page | Separate full-page route. Simpler but breaks flow. | |
| You decide | Claude picks based on existing nav structure. | |

**User's choice:** Bell icon → dropdown panel (web)

| Option | Description | Selected |
|--------|-------------|----------|
| Bell icon in Profile tab header | Bell in top-right of Profile screen, pushes NotificationsScreen. No tab bar change. | ✓ |
| Bell icon in Feed tab header | Bell in top-right of Feed (home) screen. More discoverable. | |
| 5th tab — break the lock | Add Notifications tab. Changes Phase 4 decision. | |

**User's choice:** Bell icon in Profile tab header (mobile)

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + text + relative time | [avatar] @sarah followed you · 2h ago. Reuses feed card pattern. | ✓ |
| Text only | sarah followed you · 2h ago. No avatar. | |
| You decide | Claude picks format. | |

**User's choice:** Avatar + text + relative time

---

## Unread Badge & Freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Badge count on bell icon | GET /api/v1/notifications/unread-count returns number. Red number badge. | |
| Red dot only — no count | Boolean has_unread. Less noisy, still signals activity. | ✓ |
| No badge — only visible on open | Zero extra requests. Less discoverable. | |

**User's choice:** Red dot only (boolean has_unread)

| Option | Description | Selected |
|--------|-------------|----------|
| On open — mark all read | PATCH /api/v1/notifications/read-all fires when panel opens. Single request. | ✓ |
| On tap — mark individual on click | PATCH per notification row. More granular, more API calls. | |
| You decide | Claude picks simplest implementation. | |

**User's choice:** Mark all read on panel open

---

## Map Library & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Google Maps JS API | @vis.gl/react-google-maps. Uses existing GOOGLE_PLACES_API_KEY. No new billing. | ✓ |
| Mapbox GL JS | react-map-gl. Requires separate Mapbox account and key. | |
| Leaflet (react-leaflet) | Open-source, free tiles. Most lightweight but more manual work. | |

**User's choice:** Google Maps JS API (@vis.gl/react-google-maps)

| Option | Description | Selected |
|--------|-------------|----------|
| react-native-maps | Most widely used. Google Maps/Apple Maps. Works with Expo dev builds. | ✓ |
| expo-maps (beta) | Expo first-party, still beta. Risky. | |
| Skip mobile map for v1 | Web map only. Mobile gets list search only. | |

**User's choice:** react-native-maps

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from map, show in list only | Map only shows restaurants with lat/lng. List shows all. | ✓ |
| Show a placeholder city pin | Geocode city name for manual entries. Adds complexity. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** Exclude from map, show in list only

| Option | Description | Selected |
|--------|-------------|----------|
| Followed-first toggle | Default = followed-user restaurants only. Toggle to show all. | |
| Always show all, highlight followed | All restaurants shown; followed-user pins visually distinct. No toggle. | ✓ |
| You decide | Claude picks best LOCN-03 implementation. | |

**User's choice:** Always show all, highlight followed-user restaurants with distinct pin

---

## Claude's Discretion

- Pin color/icon differentiation (followed vs. general public restaurants)
- Map clustering behavior for dense areas
- Notification panel max height and overflow scroll
- Relative time formatting (library or custom)
- Notifications list pagination (cursor-based, reuse Phase 4 pattern)

## Deferred Ideas

None — discussion stayed within phase scope.
