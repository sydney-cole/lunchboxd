# Architecture Research — Lunchboxd

**Domain:** Social food review app (Letterboxd model applied to meals)
**Researched:** 2026-04-27
**Confidence:** HIGH — social review / activity feed architecture is a well-established pattern with clear prior art (Letterboxd, Goodreads, Instagram, Yelp)

---

## System Components

### Component Map

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│   ┌─────────────┐   ┌───────────────────────────────┐  │
│   │  Web App    │   │    Mobile App (iOS / Android)  │  │
│   │  (React /   │   │    (React Native or native)    │  │
│   │  Next.js)   │   └───────────────────────────────┘  │
│   └─────────────┘                                       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / REST or GraphQL
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway / Server                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│   │   Auth   │  │  Reviews │  │  Social (follows,     │ │
│   │  Module  │  │  Module  │  │  feed, friends)       │ │
│   └──────────┘  └──────────┘  └──────────────────────┘ │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│   │  Users / │  │Restaurant│  │  Media (photo upload) │ │
│   │ Profiles │  │  Lookup  │  │                       │ │
│   └──────────┘  └──────────┘  └──────────────────────┘ │
└───────────────┬────────────────────┬────────────────────┘
                │                    │
    ┌───────────▼──────┐    ┌────────▼──────────┐
    │  Primary Database │    │  Object Storage   │
    │  (PostgreSQL)     │    │  (S3 / Cloudflare │
    │                   │    │   R2 for photos)  │
    └───────────────────┘    └───────────────────┘
                │
    ┌───────────▼──────────┐
    │  External APIs        │
    │  - Google Places API  │
    │  - Yelp Fusion API    │
    └──────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Does NOT Do |
|-----------|---------------|-------------------|-------------|
| **Web Client** | UI, routing, state management, form handling | API Server (REST/GraphQL) | Direct DB access, image resizing |
| **Mobile Client** | Native UX, camera/photo access, offline caching | API Server (same contract as web) | Direct DB access, business logic |
| **Auth Module** | Registration, login, JWT issuance, session management, password reset | Users/Profiles, all protected routes | Social graph logic |
| **Reviews Module** | CRUD for meal reviews, star ratings, tags, photo attachment, meal type (restaurant vs homemade) | Restaurant Lookup, Media, Social feed | Feed ranking, user graph |
| **Social Module** | Follow/unfollow, mutual friend detection, friend feed assembly, follower counts | Users/Profiles, Reviews | Review content storage |
| **Users/Profiles Module** | Profile read/write, stats aggregation (review count, avg rating, favorites), avatar | Auth, Social, Reviews | Feed assembly |
| **Restaurant Lookup Module** | Search via Google Places / Yelp, cache results, manual entry fallback, store local restaurant records | External APIs, Reviews | User or social data |
| **Media Module** | Receive photo upload from client, resize/optimize, store in object storage, return CDN URL | Object Storage (S3/R2), Reviews | Image moderation (defer) |
| **Primary Database** | Source of truth for all relational data | API Server modules | Serve clients directly |
| **Object Storage** | Durable photo storage, CDN delivery | Media Module, clients (read via CDN URL) | Business logic |

---

## Data Flow

### 1. User Posts a Meal Review

```
Client
  → POST /reviews (multipart: text, rating, tags, photo, restaurant_id or manual name)
  → Media Module: upload photo → Object Storage → returns CDN URL
  → Reviews Module: persist review row with photo_url, restaurant_id (or null), meal_type
  → Social Module: fan-out event — write to follower feed tables (or invalidate feed cache)
  → Response: 201 Created with full review object
```

### 2. User Loads Friend Feed

```
Client
  → GET /feed (paginated, cursor-based)
  → Social Module: fetch follow graph for requesting user → resolve follower list
  → Reviews Module: query reviews authored by followed users, ORDER BY created_at DESC
  → Enrich with author profile stub, restaurant name, photo URL
  → Response: paginated array of feed items
```

### 3. Restaurant Lookup

```
Client types restaurant name
  → GET /restaurants/search?q=...
  → Restaurant Lookup Module: check local cache/DB first
  → Cache miss → call Google Places API (or Yelp)
  → Store result in local restaurants table (normalize: name, address, place_id)
  → Response: list of restaurant candidates
  → User selects one → restaurant_id attached to review
  → Manual fallback: user submits free-text name → stored as unlinked restaurant record
```

### 4. Follow / Unfollow

```
Client
  → POST /follows { target_user_id }
  → Social Module: insert follow edge (follower_id, followee_id, created_at)
  → Check reverse edge → if both directions exist, mark as mutual friends
  → Response: updated follow state + counts
  (Feed queries pick up new follows immediately via social graph)
```

### 5. Auth Flow

```
Client
  → POST /auth/register or /auth/login
  → Auth Module: validate credentials, hash password (bcrypt), issue JWT (access + refresh tokens)
  → Access token: short-lived (15 min), stored in memory on client
  → Refresh token: longer-lived (30 days), stored in httpOnly cookie (web) or secure storage (mobile)
  → All subsequent requests: Authorization: Bearer <access_token>
```

---

## Suggested Build Order

Dependencies drive order. Each layer builds on the previous.

### Phase 1 — Foundation (nothing works without this)
1. **Database schema** — core tables (users, reviews, restaurants, follows, tags)
2. **Auth module** — register, login, JWT issue/verify, middleware
3. **Users/Profiles module** — basic read/write of profile data

Rationale: Every other module requires authenticated users. Auth and DB must exist first.

### Phase 2 — Core Review Loop (the product's primary value)
4. **Media module** — photo upload to object storage, CDN URL return
5. **Restaurant Lookup module** — Places/Yelp search + local cache + manual fallback
6. **Reviews module** — create, read, update, delete reviews; attach photo, restaurant, tags, rating

Rationale: The review posting loop is the core product action. It requires media and restaurant data but no social graph yet.

### Phase 3 — Social Layer (makes reviews visible to others)
7. **Social module** — follow/unfollow, mutual friend detection, follower/following lists
8. **Friend feed** — query reviews by followed users, paginated and reverse-chronological

Rationale: Social features depend on reviews existing to surface. Feed is the delivery mechanism for all prior work.

### Phase 4 — Profile Completeness
9. **Profile stats** — review count, average rating, favorites list, follower/following counts (aggregated or computed)
10. **Profile page data API** — assembles all profile sections into a single or composed endpoint

Rationale: Stats require review and social data to exist before they can be computed accurately.

### Phase 5 — Client Applications
11. **Web client** — consume the full API surface built above
12. **Mobile client** — consume same API; mobile-specific additions (camera, push notifications later)

Rationale: Build the API contract first, then clients conform to it. Mobile and web can be built in parallel once the API is stable.

---

## Key Architectural Decisions

### Decision 1: REST over GraphQL
**Recommendation:** REST with JSON.
**Rationale:** Simpler to implement, cache, and debug. Feed and profile pages have predictable, stable shapes — the primary use case for GraphQL (ad-hoc field selection) doesn't apply here. Add GraphQL later only if mobile clients show significant over-fetching problems.
**Confidence:** HIGH

### Decision 2: Fan-out on Write for the Friend Feed (at MVP scale)
**Recommendation:** When a review is posted, write feed entries to a feed table per follower (fan-out on write). This keeps feed reads O(1) — a simple SELECT by user_id.
**Rationale:** At MVP scale (hundreds to low thousands of users), fan-out on write is simpler and faster to read. Fan-out on read (assembling feed at query time from follow graph) is cheaper to write but expensive to read and harder to paginate consistently.
**When to revisit:** If a user has 100K+ followers, fan-out on write becomes expensive per post. Switch to hybrid (fan-out on read for high-follower accounts) when that becomes a real problem.
**Confidence:** HIGH — this is the standard Letterboxd/Instagram v1 approach

### Decision 3: Cursor-Based Pagination for Feed
**Recommendation:** Use cursor (created_at + review_id) not offset/page-number pagination for the feed and all list endpoints.
**Rationale:** Offset pagination breaks when new items are inserted — users see duplicates or skipped items mid-scroll. Cursor pagination is stable and mobile-friendly.
**Confidence:** HIGH

### Decision 4: Restaurants as a Local Cache Layer
**Recommendation:** Never pass Google Places / Yelp responses directly to the client. Proxy through a local `restaurants` table. Store place_id, name, address, and any enrichment.
**Rationale:** Insulates the app from external API changes, rate limits, and costs. Allows the app to accumulate its own restaurant graph over time. Required for foreign-key relationships on reviews.
**Confidence:** HIGH

### Decision 5: Dual Follow Model — Asymmetric Follows + Mutual Friends
**Recommendation:** Store follows as directed edges (follower_id → followee_id). Detect mutual friends by checking for the reverse edge at follow time. Add a `is_mutual` boolean or a separate `friendships` view. Do NOT build a separate friendship request flow for v1 — mutuality is automatic when both users follow each other.
**Rationale:** Keeps the data model simple. Matches Letterboxd's model and the project spec. Avoids the complexity of a friend request queue.
**Confidence:** HIGH

### Decision 6: Object Storage for Photos (not DB blobs)
**Recommendation:** S3 or Cloudflare R2 for photo storage. Store only the CDN URL in the database.
**Rationale:** Databases are not built for binary blob storage at scale. Object storage is cheap, durable, and CDN-friendly. Cloudflare R2 has no egress fees (cost advantage over S3 for a photo-heavy app).
**Confidence:** HIGH

### Decision 7: JWT Auth with Refresh Token Rotation
**Recommendation:** Short-lived access tokens (15 min) + long-lived refresh tokens (30 days). Refresh tokens stored in httpOnly cookies on web, secure keychain on mobile.
**Rationale:** Stateless access tokens work well for shared API serving multiple client types. httpOnly cookies on web prevent XSS token theft. Refresh rotation means stolen tokens expire quickly.
**Confidence:** HIGH

---

## Data Models (Core Entities)

### users
```
id              UUID        PK
username        TEXT        unique, not null
email           TEXT        unique, not null
password_hash   TEXT        not null
display_name    TEXT
bio             TEXT
avatar_url      TEXT        (CDN URL)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### reviews
```
id              UUID        PK
user_id         UUID        FK → users.id
restaurant_id   UUID        FK → restaurants.id (nullable — null when homemade)
meal_type       ENUM        'restaurant' | 'homemade'
title           TEXT        (optional short title)
body            TEXT        (written note)
rating          NUMERIC(2,1)  (0.5 to 5.0 in 0.5 increments, matching Letterboxd)
photo_url       TEXT        (CDN URL, nullable)
tags            TEXT[]      (array of free-form tags / mood descriptors)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### restaurants
```
id              UUID        PK
place_id        TEXT        (Google Places ID or Yelp ID, nullable for manual entries)
source          ENUM        'google_places' | 'yelp' | 'manual'
name            TEXT        not null
address         TEXT
city            TEXT
country         TEXT
lat             NUMERIC
lng             NUMERIC
created_at      TIMESTAMP
```

### follows
```
id              UUID        PK
follower_id     UUID        FK → users.id
followee_id     UUID        FK → users.id
created_at      TIMESTAMP
UNIQUE (follower_id, followee_id)
INDEX on followee_id   (for "followers of user X" queries)
INDEX on follower_id   (for "who does user X follow" queries)
```

### feed_items (fan-out table)
```
id              UUID        PK
owner_user_id   UUID        FK → users.id  (whose feed this item lives in)
review_id       UUID        FK → reviews.id
created_at      TIMESTAMP   (copy of review created_at for sort stability)
INDEX on (owner_user_id, created_at DESC)
```

### tags (optional normalization — alternative to text[] on reviews)
```
id              UUID        PK
review_id       UUID        FK → reviews.id
label           TEXT
INDEX on label  (for tag-based browse later)
```

---

## Component Dependency Graph (Build Sequencing)

```
Database Schema
      │
      ▼
Auth Module ──────────────────────────────────┐
      │                                        │
      ▼                                        ▼
Users/Profiles ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Social Module
      │                                        │
      ▼                                        ▼
  Media Module                            Friend Feed
      │
      ▼
Restaurant Lookup
      │
      ▼
Reviews Module ────────────────────────► Social Module
      │                                  (triggers fan-out)
      ▼
Profile Stats (aggregates Reviews + Social)
      │
      ▼
Web Client / Mobile Client (consumes full API)
```

---

## Scalability Notes (for Future Phases)

| Concern | At MVP (< 1K users) | At Growth (10K–100K users) | At Scale (1M+ users) |
|---------|--------------------|-----------------------------|----------------------|
| Feed assembly | Fan-out on write, full table | Add Redis cache for hot feeds | Hybrid fan-out (fan-out on read for high-follower accounts) |
| Restaurant lookup | Direct Google Places call + local cache | Increase cache TTL, add full-text search on local table | Self-hosted restaurant graph |
| Photo storage | S3 or R2 | Same + image optimization pipeline (resize on upload) | Multi-region CDN |
| Auth | Single-instance JWT | Token rotation + rate limiting | Dedicated auth service |
| Database | Single Postgres instance | Read replicas for feed queries | Sharding or CQRS for feed |

---

## Sources

- Architecture pattern: established prior art from Letterboxd, Goodreads, Instagram at early scale (HIGH confidence — well-documented public engineering)
- Fan-out on write for activity feeds: standard recommendation in Martin Kleppmann "Designing Data-Intensive Applications" ch. 11 (HIGH confidence)
- JWT refresh token rotation pattern: OAuth 2.0 RFC 6749 + security community consensus (HIGH confidence)
- Cursor pagination: Relay pagination spec, widely adopted in REST and GraphQL APIs (HIGH confidence)
- Cloudflare R2 zero-egress pricing: public pricing as of 2025 (MEDIUM confidence — verify current pricing before committing)
- Google Places API / Yelp Fusion: both offer restaurant search with place IDs; verify current quota and pricing tiers before finalizing choice (MEDIUM confidence)
