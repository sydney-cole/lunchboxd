# Lunchboxd

## What This Is

Lunchboxd is a Letterboxd-inspired food review app where users log, rate, and share meals — whether eaten at a restaurant or made at home. Users build a profile, follow friends, and see a feed of what their network is eating.

## Core Value

A user should be able to post a meal review and immediately see it appear in their friends' feeds.

## Requirements

### Validated

- [x] User can create an account and log in — Validated in Phase 1: Auth Foundation

### Active
- [ ] User can post a meal review with star rating, written note, photo, and tags/mood
- [ ] Reviews can be tagged as restaurant meals (searched via database or entered manually) or homemade
- [ ] User has a profile page showing their reviews, stats, favorites, and followers/following
- [ ] User can follow anyone (asymmetric) or connect as mutual friends
- [ ] User sees a feed of reviews from people they follow
- [ ] App is available as both a web app and a mobile app (iOS/Android)

### Out of Scope

- Discovery feed (algorithmic or trending) — keep social graph simple for v1
- In-app messaging — not core to the review/sharing loop
- Restaurant reservations or external booking — out of scope for food logging focus
- Monetization / ads — defer until after validation

## Context

- Name "Lunchboxd" references Letterboxd, signaling a familiar social review pattern applied to food
- Two meal types: restaurant (with optional place lookup via Google Places / Yelp) and homemade
- Social model supports both asymmetric follows and mutual friend connections — close friends may get elevated feed visibility in the future
- Platform targets web + iOS/Android, so architecture should accommodate a shared API

## Constraints

- **Platform**: Web + mobile (iOS/Android) — requires a shared backend API
- **Restaurant data**: Google Places or Yelp API for restaurant search; manual fallback for unmapped places

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Shared API backend | Web and mobile both need the same data layer | — Pending |
| Restaurant lookup: search + manual fallback | Users shouldn't be blocked if restaurant isn't in a database | — Pending |
| Follow + mutual friends dual model | Gives flexibility: browse openly, share closely | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-29 — Phase 3 complete: social graph shipped (follow/unfollow, likes, user search, mutual friend detection on web + mobile)*
