# Roadmap: Lunchboxd

**Milestone:** v1 — Core Review & Social Loop
**Granularity:** Standard (5-8 phases)
**Coverage:** 33/33 v1 requirements mapped

---

## Phases

- [x] **Phase 1: Auth & Foundation** — Users can create accounts and sign in securely; project infrastructure is ready for all subsequent phases (completed 2026-04-28)
- [ ] **Phase 2: Reviews & Meals** — Users can post a complete meal review with rating, note, photo, tags, and restaurant association
- [ ] **Phase 3: Social Graph** — Users can follow others, detect mutual friends, like reviews, and search for users
- [ ] **Phase 4: Feed** — Users see a real-time, paginated feed of reviews from people they follow
- [ ] **Phase 5: Profiles** — Users have complete public profiles with avatar, bio, review history, and follower/following display
- [ ] **Phase 6: Notifications & Location** — Users receive in-app notifications on social activity and can browse reviewed restaurants on a map

---

## Phase Details

### Phase 1: Auth & Foundation

**Goal**: Users can create accounts and sign in securely, and the project infrastructure supports web and mobile from day one.
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**UI hint**: yes

**Success Criteria** (what must be TRUE):
1. A new user can sign up with email and password and land in the app on both web and mobile
2. A returning user can log in and remain logged in across sessions without re-authenticating
3. A user can sign in using their Google account via OAuth
4. A user who forgot their password receives a reset link by email and can set a new password

**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold Turborepo monorepo, shared package, Drizzle schema, design tokens
- [x] 01-02-PLAN.md — Wire Clerk auth on web: middleware, webhook, auth screens, onboarding
- [x] 01-03-PLAN.md — Wire Clerk auth on mobile: ClerkProvider, auth screens, EAS build config

---

### Phase 2: Reviews & Meals

**Goal**: Users can post a complete meal review — with rating, written note, photo, restaurant lookup or manual entry, and mood tags — and edit or delete it afterward.
**Depends on**: Phase 1
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, MEAL-01, MEAL-02, MEAL-03
**UI hint**: yes

**Success Criteria** (what must be TRUE):
1. A user can submit a review with a half-star rating, written note, attached photo, mood tags, and a custom meal date
2. A user can search for a restaurant by name via Google Places autocomplete and attach it to a review
3. A user can manually type a restaurant name when it is not found in search, and that entry is saved as first-class data
4. A user can tag a review as a homemade meal without any restaurant field required
5. A user can edit or delete any review they have posted and see the changes reflected immediately

**Plans:** 6 plans

Plans:
- [ ] 02-01-PLAN.md — Schema migration (meal_date), Zod schemas (reviewSchema), Wave 0 test stubs
- [ ] 02-02-PLAN.md — R2 presigned upload endpoint, Google Places restaurant search proxy
- [ ] 02-03-PLAN.md — Review CRUD API routes (POST/GET/PATCH/DELETE) with fan-out-on-write
- [ ] 02-04-PLAN.md — Web UI input components (StarRating, TagInput, RestaurantSearch, PhotoPicker, MealTypeToggle) and review composer page
- [ ] 02-05-PLAN.md — Web review list page, ReviewCard, edit page, delete dialog, FAB
- [ ] 02-06-PLAN.md — Mobile (Expo) review composer with native components

---

### Phase 3: Social Graph

**Goal**: Users can follow and unfollow others, mutual follows are surfaced as friendships, users can like reviews, and users can search for other users by name.
**Depends on**: Phase 2
**Requirements**: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05

**Success Criteria** (what must be TRUE):
1. A user can follow another user and the follow relationship is immediately reflected in both users' counts
2. A user can unfollow someone they currently follow
3. When two users follow each other, the app displays the relationship as a mutual friendship
4. A user can tap a like button on any review and see the like count increment in real time
5. A user can search by username or display name and find other users on the platform

**Plans**: TBD

---

### Phase 4: Feed

**Goal**: Users see a chronological, paginated feed of reviews from everyone they follow, powered by fan-out-on-write.
**Depends on**: Phase 3
**Requirements**: FEED-01, FEED-02

**Success Criteria** (what must be TRUE):
1. After following someone, their new reviews appear in the current user's feed immediately upon posting
2. The feed is displayed in reverse chronological order with no missed entries from followed accounts
3. A user can scroll to the bottom of the visible feed and load additional older reviews without navigating away

**Plans**: TBD

---

### Phase 5: Profiles

**Goal**: Users have a complete public profile displaying their avatar, bio, full review history in reverse chronological order, and follower/following counts and lists.
**Depends on**: Phase 3
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06
**UI hint**: yes

**Success Criteria** (what must be TRUE):
1. A user can upload a profile avatar and write a bio that appear on their public profile page
2. A user's profile shows all their reviews in reverse chronological order
3. Any user can view another user's public profile page without needing to follow them
4. A user can see their follower count and following count on their profile and tap each to browse the full list

**Plans**: TBD

---

### Phase 6: Notifications & Location

**Goal**: Users receive in-app notifications when followed or liked, and can browse an interactive map of reviewed restaurants filtered by their social graph.
**Depends on**: Phase 4, Phase 5
**Requirements**: NOTF-01, NOTF-02, NOTF-03, LOCN-01, LOCN-02, LOCN-03
**UI hint**: yes

**Success Criteria** (what must be TRUE):
1. A user receives an in-app notification when someone follows them or likes one of their reviews
2. A user can open a notification center and see all recent notification activity
3. A user can view an interactive map showing the locations of restaurants that have been reviewed on the platform
4. A user can search for reviewed restaurants by neighborhood or city and see a list of results, prioritizing reviews from people they follow

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth & Foundation | 3/3 | Complete   | 2026-04-28 |
| 2. Reviews & Meals | 0/6 | Planned | - |
| 3. Social Graph | 0/? | Not started | - |
| 4. Feed | 0/? | Not started | - |
| 5. Profiles | 0/? | Not started | - |
| 6. Notifications & Location | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| REVW-01 | Phase 2 |
| REVW-02 | Phase 2 |
| REVW-03 | Phase 2 |
| REVW-04 | Phase 2 |
| REVW-05 | Phase 2 |
| REVW-06 | Phase 2 |
| REVW-07 | Phase 2 |
| MEAL-01 | Phase 2 |
| MEAL-02 | Phase 2 |
| MEAL-03 | Phase 2 |
| SOCL-01 | Phase 3 |
| SOCL-02 | Phase 3 |
| SOCL-03 | Phase 3 |
| SOCL-04 | Phase 3 |
| SOCL-05 | Phase 3 |
| FEED-01 | Phase 4 |
| FEED-02 | Phase 4 |
| PROF-01 | Phase 5 |
| PROF-02 | Phase 5 |
| PROF-03 | Phase 5 |
| PROF-04 | Phase 5 |
| PROF-05 | Phase 5 |
| PROF-06 | Phase 5 |
| NOTF-01 | Phase 6 |
| NOTF-02 | Phase 6 |
| NOTF-03 | Phase 6 |
| LOCN-01 | Phase 6 |
| LOCN-02 | Phase 6 |
| LOCN-03 | Phase 6 |

**Total:** 33/33 v1 requirements mapped

---
*Roadmap created: 2026-04-27*
*Last updated: 2026-04-29 after Phase 2 planning — 6 plans created*
