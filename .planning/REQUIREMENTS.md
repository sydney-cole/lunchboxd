# Requirements: Lunchboxd

**Defined:** 2026-04-27
**Core Value:** A user should be able to post a meal review and immediately see it appear in their friends' feeds.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User can log in with email and password and stay logged in across sessions
- [x] **AUTH-03**: User can sign in with Google OAuth
- [x] **AUTH-04**: User can reset password via email link

### Reviews

- [x] **REVW-01**: User can post a meal review with a half-star rating (0.5–5 stars)
- [x] **REVW-02**: User can add a written note to a review
- [x] **REVW-03**: User can attach a photo to a review
- [x] **REVW-04**: User can add mood/tags to a review (e.g. comfort food, date night, quick lunch)
- [x] **REVW-05**: User can set the date the meal was eaten (not just the review date)
- [x] **REVW-06**: User can edit their own review after posting
- [x] **REVW-07**: User can delete their own review

### Restaurants & Meals

- [x] **MEAL-01**: User can search for a restaurant by name using Google Places autocomplete
- [x] **MEAL-02**: User can manually enter a restaurant name if it is not found in search
- [x] **MEAL-03**: User can tag a review as a homemade meal (no restaurant required)

### Profile

- [x] **PROF-01**: User can set a profile avatar (photo)
- [x] **PROF-02**: User can write a profile bio
- [x] **PROF-03**: User's profile displays their reviews in reverse chronological order
- [x] **PROF-04**: User can view another user's public profile
- [x] **PROF-05**: User can see their follower count and following count on their profile
- [ ] **PROF-06**: User can browse their followers list and following list

### Social

- [x] **SOCL-01**: User can follow another user (asymmetric)
- [x] **SOCL-02**: User can unfollow a user
- [x] **SOCL-03**: Mutual follows are detected and displayed as friends
- [x] **SOCL-04**: User can like a review
- [x] **SOCL-05**: User can search for other users by username or display name

### Feed

- [x] **FEED-01**: User sees a chronological feed of reviews from people they follow
- [x] **FEED-02**: Feed is paginated and loads more on scroll

### Notifications

- [ ] **NOTF-01**: User receives an in-app notification when someone follows them
- [ ] **NOTF-02**: User receives an in-app notification when someone likes their review
- [ ] **NOTF-03**: User can view all notifications in a notification center

### Location

- [ ] **LOCN-01**: User can browse an interactive map showing restaurants that have been reviewed on the platform
- [ ] **LOCN-02**: User can search for reviewed restaurants by neighborhood or city and see a list view
- [ ] **LOCN-03**: Location browse prioritizes reviews from people the user follows, falling back to all public reviews when sparse

## v2 Requirements

### Authentication

- **AUTH-V2-01**: User can sign in with Apple OAuth (required before iOS App Store submission)

### Profile

- **PROF-V2-01**: User profile displays stats (total reviews, average rating, top cuisines)
- **PROF-V2-02**: User can curate a favorites shelf of up to 6 pinned top meals

### Social

- **SOCL-V2-01**: User can comment on reviews
- **SOCL-V2-02**: User can share a review via link

### Notifications

- **NOTF-V2-01**: User receives push notifications (requires Apple OAuth / APNs)
- **NOTF-V2-02**: User can configure notification preferences

### Discovery

- **DISC-V2-01**: Restaurant aggregation pages showing all reviews for a specific restaurant
- **DISC-V2-02**: Tag-based browse (see all reviews tagged "date night" etc.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Algorithmic / trending feed | Keeps social graph simple; chronological is sufficient for v1 |
| Direct messaging | Not core to the review/sharing loop |
| Restaurant reservations / booking | Out of scope for food logging focus |
| Content moderation tools | Must be added before any public marketing push, but not in initial build |
| Monetization / ads | Defer until after validation |
| Recipe storage | Different product direction |
| Group lists / collaborative lists | Adds complexity; defer until social graph is established |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| REVW-01 | Phase 2 | Complete |
| REVW-02 | Phase 2 | Complete |
| REVW-03 | Phase 2 | Complete |
| REVW-04 | Phase 2 | Complete |
| REVW-05 | Phase 2 | Complete |
| REVW-06 | Phase 2 | Complete |
| REVW-07 | Phase 2 | Complete |
| MEAL-01 | Phase 2 | Complete |
| MEAL-02 | Phase 2 | Complete |
| MEAL-03 | Phase 2 | Complete |
| PROF-01 | Phase 5 | Complete |
| PROF-02 | Phase 5 | Complete |
| PROF-03 | Phase 5 | Complete |
| PROF-04 | Phase 5 | Complete |
| PROF-05 | Phase 5 | Complete |
| PROF-06 | Phase 5 | Pending |
| SOCL-01 | Phase 3 | Complete |
| SOCL-02 | Phase 3 | Complete |
| SOCL-03 | Phase 3 | Complete |
| SOCL-04 | Phase 3 | Complete |
| SOCL-05 | Phase 3 | Complete |
| FEED-01 | Phase 4 | Complete |
| FEED-02 | Phase 4 | Complete |
| NOTF-01 | Phase 6 | Pending |
| NOTF-02 | Phase 6 | Pending |
| NOTF-03 | Phase 6 | Pending |
| LOCN-01 | Phase 6 | Pending |
| LOCN-02 | Phase 6 | Pending |
| LOCN-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after roadmap creation — all 33 v1 requirements mapped*
