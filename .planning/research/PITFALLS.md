# Pitfalls Research — Lunchboxd

**Domain:** Social food review app (Letterboxd-style)
**Researched:** 2026-04-27
**Confidence:** HIGH — patterns drawn from well-documented engineering post-mortems in social, photo-sharing, and review app categories

---

## Critical Pitfalls (Will Sink the Project)

### 1. Feed Architecture Lock-In: Choosing Pull When You Need Push (or Vice Versa)

**What goes wrong:** The feed ("reviews from people I follow") is architecturally decided by default — usually by querying `WHERE user_id IN (following_ids) ORDER BY created_at` at read time. This works at zero scale, fails painfully at moderate scale, and cannot be changed without a full data model rewrite.

Two strategies exist and they have opposite failure modes:
- **Fanout-on-read (pull):** Feed is computed at request time. Simple to implement. Degrades linearly as follow counts and post volumes grow. Unacceptable latency at scale.
- **Fanout-on-write (push):** Feed rows are written to every follower's feed table at post time. Fast reads. Write amplification for users with many followers (a user with 10,000 followers triggers 10,000 feed inserts per post).

**Why it happens:** The naive SQL query works perfectly in development with 5 users. The problem only appears at real traffic.

**Consequences:** At a few thousand active users, feed queries become the primary source of database load. Retrofitting requires a new feed table, a backfill job on live data, and a coordinated cutover — all while the app is running.

**Warning signs:**
- Feed endpoint response time creeping above 200ms during load testing
- Database CPU spiking during feed requests even with indexed queries
- Follow counts of any single user exceeding ~500 in early cohorts

**Prevention:**
- Decide the strategy before writing feed code. For Lunchboxd v1 (small social graph, no celebrities), fanout-on-write is the right default — fast reads, manageable write load.
- Implement a feed table (`user_feed` rows keyed by recipient user + post id + timestamp) from day one, even if it feels overengineered.
- Cap fanout at a threshold (e.g., users with >5,000 followers fall back to pull at read time) — the "hybrid" pattern used by Twitter/Instagram.

**Phase:** Feed MVP phase. Decide and implement before any feed endpoint ships.

---

### 2. Uncontrolled Photo Storage Costs: No Upload Pipeline

**What goes wrong:** Photos are stored as-uploaded — full resolution JPEGs from phone cameras, typically 4–12 MB each. Storage costs and CDN egress costs scale with every review posted. With no compression or resizing, a moderately active app with 1,000 monthly reviews burns through storage budget quickly and serves slow images to clients.

**Why it happens:** "We'll optimize later" is applied to image handling. Later never comes before costs are already hurting.

**Consequences:**
- S3/GCS storage and egress bills are unpredictable and grow non-linearly
- Mobile clients download multi-MB images for thumbnail displays, destroying perceived performance
- Retroactive re-encoding of existing photos requires a batch job over all stored assets

**Warning signs:**
- Average uploaded file size above 3 MB
- No `srcset` or size-variant URLs in client code
- Image load time dominating feed performance profiles

**Prevention:**
- Build the upload pipeline on day one: client uploads to a staging bucket or directly to a processing endpoint, a worker resizes/compresses to at minimum three variants (thumbnail ~200px, card ~600px, full ~1200px), stores variants, then deletes the original.
- Use WebP output format — 25–35% smaller than JPEG at equivalent visual quality; supported on all current mobile and browser targets.
- Serve via CDN from the start (Cloudflare R2, AWS CloudFront, or Bunny CDN). Never serve images direct from the origin storage bucket.
- Store the variant URLs in the database, not just a base path.

**Phase:** Review posting phase (wherever photo uploads are first implemented). Do not defer.

---

### 3. Restaurant Data Model That Cannot Accommodate Manual Entries

**What goes wrong:** The restaurant data model is built around the Google Places or Yelp API response schema — the external ID is the primary key, required fields match API response fields, and the create-review flow assumes a place lookup succeeds. Manual fallback is added as an afterthought and breaks assumptions throughout (foreign keys, display logic, search indexing).

**Why it happens:** The happy path (restaurant found in API) is built first. Manual entry is treated as a special case rather than a first-class entity.

**Consequences:**
- Manual entries lack features (no map pin, no search discoverability, inconsistent display)
- Duplicate restaurants accumulate (same place entered manually 15 different ways by 15 users)
- Merging manual entries with API entries later requires a migration touching every review that references them

**Warning signs:**
- `place_id` field is NOT NULL in the database
- "Homemade" meals and restaurant meals share the same data model
- No deduplication or admin merge tool planned

**Prevention:**
- Model restaurants as a local entity from day one. An external API result is just one way to populate that entity.
- Schema: `restaurants` table with `external_source` (nullable), `external_id` (nullable), `name` (required), `address` (optional), `created_by_user` (for manual entries).
- Unique constraint on `(external_source, external_id)` where not null — prevents duplicate imports.
- Treat homemade meals as a distinct review type with no restaurant FK required.
- Plan an admin merge UI for phase 2 even if not built in phase 1.

**Phase:** Data model phase / review posting phase. Must be correct before any reviews are stored.

---

### 4. Social Graph Ambiguity: Conflating Follows and Friendships

**What goes wrong:** Lunchboxd defines two relationship types — asymmetric follow (Twitter-style) and mutual friendship (elevated visibility, potential future features). These are implemented as one relationship type with a flag or state field. The distinction bleeds into feed logic, privacy checks, notification logic, and future feature gating — all in inconsistent ways.

**Why it happens:** "Follow and friends are basically the same thing" feels true at design time. The edge cases (unfollowing vs. unfriending, one-sided friend requests, feed visibility differences) multiply once users exist.

**Consequences:**
- Feed visibility rules become a tangle of conditionals
- Privacy bugs: content intended for friends surfaces to followers
- Notification system sends wrong messages (follow notifications vs. friend request notifications)
- Schema changes to relationship model require touching every downstream consumer

**Warning signs:**
- A single `relationships` table row represents both "I follow you" and "we are friends"
- Feed query has more than one JOIN on the relationships table to resolve visibility
- "Friends" feature is not designed before "follow" feature ships

**Prevention:**
- Separate the concepts explicitly at the data model level, even if phase 1 only ships follows.
- Schema: `follows` table (follower_id, followee_id, created_at) for asymmetric follows. `friendships` table (user_a_id, user_b_id, status: pending/accepted, created_at) for mutual connections — separate table, separate queries.
- Feed v1 reads only from `follows`. Friend visibility is an additive layer, not a modification.
- Design the friendship request/accept flow on paper before implementing follows, so the schema has room for it.

**Phase:** Auth/social graph phase. Schema must be settled before feed is built.

---

## Common Mistakes (Cause Significant Pain)

### 5. Third-Party API Rate Limits Blocking the Review Post Flow

**What goes wrong:** Restaurant search (Google Places, Yelp) is called synchronously inside the review creation flow. The API returns a rate limit error or times out. The user's review post fails. Or the Places API response is fetched on every search keystroke without debouncing, exhausting per-minute quotas within minutes during a demo.

**Warning signs:**
- Restaurant search is a synchronous dependency for posting a review
- No local caching of previously fetched place details
- API call made on every keypress in the search field

**Prevention:**
- Debounce restaurant search on the client (300–500ms minimum).
- Cache Place API results locally in your `restaurants` table. Once a place is in your DB, never call the external API for it again.
- The review post flow must never fail because a third-party API is unavailable. Restaurant association is optional at post time; it can be added/corrected after.
- Store raw API responses (JSONB column) alongside the normalized fields. When the API adds data you didn't anticipate, it's already stored.
- Set a per-user and per-IP rate limit on your own restaurant search endpoint to prevent runaway clients from burning your quota.

**Phase:** Restaurant integration phase.

---

### 6. No Image State Machine: Posting Reviews Before Photos Are Processed

**What goes wrong:** A user posts a review, the photo upload is in flight or still being processed (resized, CDN-replicated). The review appears in followers' feeds with a broken image or missing thumbnail. The UX feels broken. Worse, if the review is served before the CDN URL is set, clients cache a 404 URL that is hard to invalidate.

**Warning signs:**
- Review and photo upload are a single API call with the file in the request body
- No `photo_status` field (pending/processing/ready/failed) on review records
- Feed query does not filter or handle reviews where photo is not yet available

**Prevention:**
- Decouple photo upload from review creation. Flow: (1) upload photo to get a `photo_id` with status `processing`, (2) submit review with `photo_id` reference, (3) background worker processes photo and updates status to `ready`.
- Feed clients should handle `photo_status: processing` gracefully (show a placeholder, not a broken image).
- Do not surface reviews in feeds until their photos are `ready`, or design the feed to handle the interim state explicitly.

**Phase:** Review posting phase, same phase as the upload pipeline.

---

### 7. Profile Stats That Are Expensive to Compute

**What goes wrong:** The profile page shows stats: total reviews, average rating, most-reviewed cuisine, review streak. These are computed by aggregating the reviews table on every profile page load. With a large reviews table and concurrent users, profile pages become slow and the database takes the hit.

**Warning signs:**
- Profile stats query includes `COUNT(*)`, `AVG()`, or `GROUP BY` over the full reviews table
- No caching layer on profile stat queries
- Profile page load time increases linearly with number of reviews

**Prevention:**
- Maintain a `user_stats` denormalized table (or Redis hash) that is updated incrementally when reviews are created, updated, or deleted — not computed on read.
- Fields: `review_count`, `avg_rating`, `reviews_this_week`, `top_tags` (JSONB). Update via DB trigger or application-level hook.
- For v1, a simple cache with a 5-minute TTL on the stats query is acceptable. Design the schema to support incremental updates when you're ready.

**Phase:** Profile phase.

---

### 8. Cross-Platform API Contract Drift

**What goes wrong:** The web app and mobile apps share a backend API, but over time the web frontend starts using internal endpoints, database queries, or workarounds that bypass the API contract. Mobile apps fall behind or receive breaking changes without versioning. API responses grow fields that web expects but mobile doesn't handle.

**Warning signs:**
- Any frontend code that calls an endpoint prefixed `/internal/` or `/admin/`
- No API versioning strategy documented before mobile ships
- Mobile app ships with no API version header

**Prevention:**
- Establish API versioning before mobile ships — even if v1 is the only version. Include an `Accept: application/vnd.lunchboxd.v1+json` or `/api/v1/` path prefix from day one.
- Never bypass the API from any client. Web and mobile must use identical endpoints.
- Add an integration test suite that exercises API contracts. Breaking the contract fails CI.
- Mobile app should send a `User-Agent` or `X-App-Version` header so the server can identify which client version is in use.

**Phase:** API design phase, before mobile development begins.

---

### 9. Notification Spam Killing Retention

**What goes wrong:** Every follow, like, and comment generates a push notification. Users who build a following quickly receive dozens of notifications per hour. They disable notifications. Notification opt-out rates climb. The engagement surface is permanently damaged.

**Warning signs:**
- No notification preferences UI planned
- All notification types are on by default with no batching
- No per-event rate limiting on notifications (e.g., max 1 "new followers" notification per hour)

**Prevention:**
- Design notification preferences as a first-class feature, not a settings afterthought.
- Implement notification batching from the start: "3 people liked your review" not three separate pushes.
- Default notification settings should be conservative: follows yes, likes batched daily, comments yes (they require a response).
- Track notification open rates and opt-out rates from day one. They are leading indicators of retention problems.

**Phase:** Social/notifications phase.

---

## Watch-Out-Fors (Minor But Frequent)

### 10. Timezone Handling for Review Timestamps

**What goes wrong:** Reviews are stored in UTC, but displayed as "3 hours ago" or with a date. In the feed, reviews from users in different timezones appear out of order or show wrong relative times. "Today's reviews" queries break across midnight.

**Warning signs:**
- Any timestamp comparison in SQL that doesn't account for timezone (e.g., `DATE(created_at) = TODAY()`)
- Client displaying server timestamps without local timezone conversion

**Prevention:**
- Store all timestamps as UTC in the database. Always.
- Convert to local time display only on the client, using the device/browser timezone.
- For "today's reviews" or streak calculations, use the user's stored timezone preference — not the server's timezone.

---

### 11. Tag Proliferation Without Normalization

**What goes wrong:** Users tag reviews with free-text mood/cuisine tags. "Italian", "italian", "ITALIAN", "Italian food", "italians" all become separate tags. Tag-based filtering and discovery becomes useless. Tag counts are meaningless.

**Warning signs:**
- Tags stored as raw strings without normalization
- No autocomplete on tag input (users type whatever comes to mind)
- Tag count query shows hundreds of near-duplicate tags

**Prevention:**
- Normalize tags on write: lowercase, trim whitespace, replace spaces with hyphens, strip special characters.
- Implement autocomplete that surfaces existing tags before users invent new variants.
- For v1, a curated starter tag list (top 30 cuisine types, common moods) with free entry as a fallback reduces fragmentation.

---

### 12. "Homemade" as an Afterthought in Feed Display

**What goes wrong:** Feed cards are designed around the restaurant review (restaurant name, address, cuisine). Homemade reviews have none of these fields. The feed card looks broken or empty for homemade meals, or the card template collapses into an unreadable state.

**Warning signs:**
- Feed card design only mocked with restaurant reviews
- `restaurant_id` is required or assumed to be present in feed serialization
- No design for how homemade meals display without location context

**Prevention:**
- Design feed cards with both review types from the first mockup.
- Homemade reviews should have a distinct visual treatment — not a stripped-down restaurant card.
- Review serializer must handle `restaurant: null` gracefully at every layer (API, client render).

---

### 13. Soft Delete Gaps in Feed and Profile Counts

**What goes wrong:** Reviews are soft-deleted (a `deleted_at` timestamp is set). But feed queries, profile review counts, and stats aggregations forget to filter `WHERE deleted_at IS NULL`. Deleted reviews still appear in feeds. Counts are wrong. If a user deletes their account, their reviews still appear attributed to them.

**Warning signs:**
- Any query on the reviews table that doesn't include `deleted_at IS NULL`
- No database-level row security or view that applies the soft delete filter automatically

**Prevention:**
- Use a database view or ORM scope that applies `deleted_at IS NULL` by default. Opt out explicitly when you need deleted records (admin tools only).
- Add a linting rule or code review checklist item: every new query against `reviews` must explicitly handle soft deletes.
- When a user deletes their account, decide: anonymize reviews (null out user_id) or cascade-delete. Pick one and implement it as an atomic operation.

---

### 14. Hardcoded Google Places API Key on Mobile Clients

**What goes wrong:** The Google Places API key is bundled into the mobile app binary or checked into source. It gets extracted, abused, and the project receives a large unexpected API bill.

**Warning signs:**
- API key referenced in any client-side source file
- No Google API key restrictions set (allowed referrers, allowed apps)
- No budget alert configured in Google Cloud Console

**Prevention:**
- All external API calls go through your own backend. The mobile/web client never calls Google Places or Yelp directly.
- Your backend holds the API key in an environment variable, applies your own rate limiting and caching, then proxies results.
- Set API key restrictions in Google Cloud Console (restrict to your backend server IP or service account).
- Set a billing budget alert at $10 and $50 to catch runaway usage early.

**Phase:** Restaurant integration phase, before any mobile release.

---

*Research confidence: HIGH — patterns sourced from engineering post-mortems and established architectural literature for social, photo-sharing, and review app categories.*
