# Features Research — Lunchboxd

**Domain:** Social food review app (Letterboxd-inspired)
**Researched:** 2026-04-27
**Overall confidence:** HIGH (domain patterns well-established; sourced from training knowledge of Letterboxd, Beli, Yelp, Vivino, and food social apps)

---

## Table Stakes (Must Have)

These are features users expect from a social review app. Missing any of them causes users to bounce or feel the product is unfinished.

### Authentication

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sign up / log in (email + password) | Every social app has it | Low | Also the entry gate to all other features |
| Password reset via email | Users forget passwords; no reset = lost account | Low | Standard email flow |
| OAuth login (Google, Apple) | Mobile users expect tap-to-login; Apple sign-in is required by App Store rules for apps offering third-party auth | Medium | Apple sign-in mandatory on iOS if any OAuth offered |
| Persistent sessions (stay logged in) | Users must not be forced to re-login on every open | Low | JWT refresh tokens or session cookies |

### Review Creation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Star rating (1–5 half-stars) | Core atomic unit of a review | Low | Half-stars (0.5 increments) match Letterboxd conventions users already know |
| Written note / text review | Users want to say more than a star | Low | Plain text; rich text is a differentiator |
| Photo attachment | Food is visual; photo is the primary hook for engagement | Medium | Upload, resize, store (S3 or equivalent), serve CDN |
| Meal type: restaurant vs homemade | Core product requirement; shapes the rest of the review form | Low | Branching form logic |
| Restaurant search / lookup | Users expect to find the place they ate without typing an address | Medium | Google Places or Yelp API integration |
| Manual restaurant entry fallback | Not every place is in Google/Yelp | Low | Free-text fields for name + location |
| Tags / mood | Users want to categorize and express context | Low | Predefined tag set + free tags; mood is optional metadata |
| Edit / delete own review | Users make mistakes | Low | Soft-delete preferred so social counts don't orphan |
| Date of meal | Logging after the fact is common; date picker needed | Low | Default to today, allow past dates |

### Profile

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Display name + avatar | Identity; users need to feel like themselves | Low | Avatar upload, crop to circle |
| Bio | Context for who this person is | Low | Short text, ~160 chars |
| Review list / grid view | Core profile content | Low | Paginated feed of user's reviews |
| Stats (total reviews, avg rating, etc.) | Letterboxd normalized this; users now expect it | Medium | Aggregate queries; cache-friendly |
| Favorites (pinned reviews or meals) | Users want to surface their best; profile would feel sparse without it | Low | Up to 4–6 pinned; Letterboxd pattern |
| Followers / following counts + lists | Social graph visibility | Low | Count + paginated user list |

### Social Graph

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Follow a user (asymmetric) | Core social primitive; without it there is no feed | Low | Unidirectional follow |
| Unfollow | Users must be able to exit relationships | Low | |
| Mutual friend recognition | When both follow each other, surface as "friends" | Low | Query intersection; UI label only |
| Friend feed (chronological) | The whole point of following people | Medium | Fan-out or pull-on-read; pagination; empty state |
| User search / discovery | Users can't follow people they can't find | Medium | Search by username or display name; basic fuzzy match |

### Notifications

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| New follower notification | Social apps train this expectation | Medium | Push (mobile) + in-app badge |
| Like / reaction on your review | Validation loop; users disengage without it | Medium | Push + in-app |
| In-app notification center | Single place to see all activity | Medium | Read/unread state, paginated |

### Core Engagement

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Like a review (heart / thumbs up) | The lightest possible engagement action; absence feels broken | Low | Counter + toggle; notify author |
| View a review detail page | Shareable, linkable review pages | Low | Essential for web; deep-link on mobile |
| View another user's profile | Social browsing | Low | Public by default |

---

## Differentiators (Competitive Advantage)

These are not expected by default but represent meaningful separation from Yelp, Google Maps, and generic food apps. They reinforce the Letterboxd-for-food identity.

### Review Quality + Expression

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mood tags (beyond cuisine tags) | Captures context competitors miss: "comfort food," "date night," "hangover cure" — makes search and memory more human | Low | Predefined vocabulary; 10–20 moods; surfaces in filters |
| Homemade meal logging | No major competitor supports this; broadens the app from "restaurant log" to "food life log" | Low | Separate form branch; no place lookup needed |
| Review visible immediately in feed | Core value prop per PROJECT.md; real-time social feedback loop | Medium | Depends on feed architecture (pull-on-read vs fan-out) |
| Half-star ratings | Finer-grained than most competitors (Yelp is whole-star) | Low | UX detail that signals taste |

### Profile as Identity

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stat breakdowns (top cuisines, most reviewed city, avg rating by tag) | Letterboxd-style identity building through data | Medium | Aggregate queries; compelling for power users |
| Favorites shelf | Users pin 4–6 meals as "my defining food moments" — strong identity signal and conversation starter | Low | Similar to Letterboxd's 4-film favorites |
| Review count milestone badges | Passive gamification (50 reviews, 100 reviews) without a points system | Low | Badge metadata on profile |

### Social Texture

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mutual friends elevated in feed | Reviews from mutual friends surfaced first or labeled — rewards reciprocal relationships | Low | Feed sort weight only; no new data model |
| "Also ate here" link | When a restaurant appears in multiple friends' reviews, surface the connection | Medium | Requires review-to-restaurant join + social graph query |
| Activity summary ("Your week in food") | Weekly digest of what you and your friends ate — shareable, builds habit | High | Scheduled jobs + templated renders; defer to v2 |

### Content Discoverability (Light, Not Algorithmic)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tags as browse surfaces | Clicking "ramen" on a review shows public reviews tagged ramen — lightweight discovery without an algorithm | Low | Standard tag index query |
| Restaurant review aggregation page | A restaurant's page showing all Lunchboxd reviews of it — builds SEO and gives non-social utility | Medium | Aggregate from review table; not a Yelp replacement |

---

## Anti-Features (Deliberately Avoid in v1)

These are features users might request or competitors have, but building them in v1 creates scope creep, maintenance burden, or product identity drift.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Algorithmic / discovery feed | PROJECT.md explicitly excludes this; adds ML complexity and shifts product identity from "social" to "discovery" | Chronological friend feed only; tag browsing as a light substitute |
| In-app messaging / DMs | Chat is a product unto itself; doesn't serve the review/sharing loop | Link to Instagram, let social happen off-platform |
| Restaurant reservations / booking | Integration with OpenTable etc. is complex, expensive, and off-mission | Keep focus on logging what you ate, not planning where to go |
| Monetization / ads | Premature optimization; ads require audience scale and harm early UX | Defer entirely; don't instrument ad slots |
| Elaborate point systems / leaderboards | Gamification can cheapen the product and attract gaming behavior | Milestone badges only (passive, non-competitive) |
| Recipe storage / instructions | "Homemade" means logging a meal you made, not storing a recipe | Free-text note covers "made grandma's lasagna" without a recipe database |
| Group / collaborative lists | Complex data model; social conflict surface; not core to the review loop | A user can mention friends in a review note |
| Price / value ratings | Adds subjectivity fields that fragment the star signal | Keep single star rating; mood/tag covers "worth it" sentiment |
| Menu item tagging | Forces a menu database dependency (expensive, stale data) | Tags cover "had the tonkotsu ramen" at the review level |
| Map / geospatial browse view | Discovery feature; out of scope per PROJECT.md | Restaurant lookup is for data attachment, not discovery |
| Verified / business accounts | Requires business onboarding flow, trust & safety overhead | Ignore until post-validation |
| Content moderation tools (reporting, flagging) | Necessary eventually but complex; small early user base is self-governing | Add before any public launch or marketing push |

---

## Feature Complexity Notes

| Feature | Complexity | Primary reason for complexity |
|---------|------------|-------------------------------|
| Auth (email + OAuth) | Low–Medium | Apple sign-in has specific SDK requirements on iOS |
| Photo upload + storage | Medium | Resize pipeline, CDN, storage costs, mobile upload UX |
| Restaurant search (Google Places / Yelp) | Medium | API key management, rate limits, result normalization, attribution requirements |
| Friend feed (chronological) | Medium | Fan-out vs pull-on-read trade-off; pagination; empty state for new users |
| User search | Medium | Fuzzy text search on username/display name; needs index |
| Push notifications | Medium | Requires APNs (iOS) and FCM (Android) integration; device token management |
| In-app notification center | Medium | Read/unread state; real-time vs polling; badge counts |
| Profile stats | Medium | Aggregate queries that need to stay fast as review counts grow |
| "Also ate here" cross-review link | Medium | Join across reviews + social graph; can be deferred to v1.5 |
| Star rating UI (half-stars) | Low | Standard UI component but custom if not using a library |
| Tag system | Low | Simple many-to-many with predefined set + free entry |
| Favorites / pinned meals | Low | Ordered list of review IDs on user record, max 6 |
| Follow / unfollow | Low | Simple edge in social graph table |
| Like / reaction | Low | Counter table + toggle; idempotent write |
| Review CRUD | Low | Standard database operations |
| Profile page | Low | Mostly read queries on user + reviews |
| Manual restaurant entry | Low | Free-text fallback; no external dependency |
| Mood tags | Low | Subset of tag system with predefined vocabulary |
| Homemade meal form | Low | Branching form logic only; no external API |
| Milestone badges | Low | Computed from review count; display only |

---

## Feature Dependencies

Reading left to right: the left feature must exist before the right feature is buildable.

```
Auth
  └── Everything else (no feature works without identity)

Review creation
  ├── Restaurant search → Manual entry fallback (parallel, not sequential)
  ├── Photo upload → CDN/storage setup
  └── Tags/mood → Tag index (simple, can be seeded at setup)

User profile
  ├── Review creation (profile needs reviews to show)
  ├── Stats → Review creation (aggregates reviews)
  └── Favorites → Review creation (pins reviews)

Social graph (follow/unfollow)
  └── Friend feed (feed requires follows to populate)
      └── "Also ate here" cross-link (requires feed + restaurant lookup)

Notifications (like, follow)
  ├── Like feature → Review creation
  ├── Follow feature → Social graph
  └── Push notifications → APNs/FCM device token registration → Auth

User search
  └── Follow (search is how users find each other to follow)

Restaurant aggregation page
  ├── Restaurant search (place IDs needed)
  └── Review creation (reviews needed to aggregate)

Tag browsing
  └── Tag system → Review creation
```

### Dependency order for phased delivery

1. Auth (nothing else works)
2. Review creation (core loop; needed by profile, feed, everything)
3. Restaurant search + manual fallback (part of review creation)
4. Photo upload (part of review creation)
5. Tag / mood system (part of review creation)
6. User profile (needs reviews to be meaningful)
7. Social graph: follow / unfollow (needs profiles to exist)
8. Friend feed (needs social graph)
9. User search (needed to bootstrap following)
10. Like / reaction (needs reviews)
11. Notifications (needs likes, follows, and push infrastructure)
12. Stats + favorites (profile enhancements; can layer in after core profile)
13. Milestone badges (cosmetic; add any time after review count accumulates)
14. "Also ate here" and tag browsing (enrichments; after core social loop ships)

---

## Sources and Confidence

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes features | HIGH | Established patterns from Letterboxd, Beli, Yelp, Vivino, and general social app conventions — well within training knowledge |
| Differentiators | HIGH | Grounded in product positioning; homemade logging and mood tags are clearly absent from dominant competitors |
| Anti-features | HIGH | Drawn directly from PROJECT.md explicit exclusions + standard v1 scoping discipline |
| Complexity estimates | MEDIUM | Based on general engineering patterns; actual complexity depends on chosen stack (not yet decided) |
| "Also ate here" and aggregation features | MEDIUM | Pattern exists (Letterboxd's "also watched" + Yelp aggregation) but implementation details are stack-dependent |

Note: WebSearch was unavailable during this research session. All findings are sourced from training knowledge of the social review app domain (Letterboxd, Beli, Yelp, Vivino, Google Maps reviews, Instagram food patterns). Core feature categorizations are high-confidence given how stable these patterns are; implementation complexity estimates should be revisited once the technology stack is decided.
