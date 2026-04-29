# Phase 3: Social Graph - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 03-social-graph
**Areas discussed:** Follow entry points, Like count "real time", Backfill on follow, Mutual friendship display

---

## Follow Entry Points

### Where can a user tap Follow?

| Option | Description | Selected |
|--------|-------------|----------|
| Search results only | Follow button inline in search result cards. No profile page needed. | ✓ |
| Search results + review cards | Follow button also on ReviewCard author line. | |
| Minimal profile stub | Bare /users/[id] page with Follow + review list. | |

**User's choice:** Search results only
**Notes:** Keeps Phase 3 minimal; profiles are Phase 5.

---

### What does a search result card show?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + username + Follow button | Minimal, fast. | ✓ |
| Avatar + username + review count + Follow button | Adds social proof. | |
| Avatar + username + bio + Follow button | More context, bio often empty. | |

**User's choice:** Avatar + username + Follow button

---

### Where does user search live on web?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /search page | Nav link leads to /search with input + results below. | ✓ |
| Global nav search bar | Search always visible in top nav. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Dedicated /search page

---

## Like Count "Real Time"

### What does "real time" mean for like count?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic UI | Count increments instantly on click; server confirms async. | ✓ |
| Polling (5–10s) | Client polls for updated count. | |
| "Real time" just means fast | Standard fetch + re-fetch, no special handling. | |

**User's choice:** Optimistic UI
**Notes:** On error, roll back to previous state.

---

### Where does the like button appear?

| Option | Description | Selected |
|--------|-------------|----------|
| ReviewCard only (web + mobile) | Heart icon + count on every ReviewCard. | ✓ |
| ReviewCard + review detail page | Also on a full review detail view. | |

**User's choice:** ReviewCard only

---

## Backfill on Follow

### Do existing reviews backfill on follow?

| Option | Description | Selected |
|--------|-------------|----------|
| No backfill — only future reviews | Simpler; standard social app behavior. | ✓ |
| Backfill recent reviews (last 20) | Feed feels populated immediately. | |
| Full backfill | All historical reviews inserted. Expensive. | |

**User's choice:** No backfill — only future reviews

---

### On unfollow, what happens to existing feed_items?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them | Don't delete; simpler. | |
| Remove them | DELETE feed_items for that user from actor's feed. | ✓ |

**User's choice:** Remove them
**Notes:** Unfollow triggers deletion of that person's reviews from the actor's feed_items. Adds write complexity on unfollow but keeps feed clean.

---

## Mutual Friendship Display

### What does "displayed as mutual friendship" look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Button label change: "Friends" | Follow button changes to "Friends" when mutual. | ✓ |
| Badge or icon only | Small icon alongside "Following" label. | |
| Data flag only — Phase 5 displays it | friendships table populated, no UI in Phase 3. | |

**User's choice:** Button label change: "Friends"

---

### Write friendships row or derive at query time?

| Option | Description | Selected |
|--------|-------------|----------|
| Write a friendships row | On follow: check reverse, INSERT into friendships if mutual. | ✓ |
| Derive at query time | JOIN follows both directions on every check. | |
| You decide | Claude picks based on schema patterns. | |

**User's choice:** Write a friendships row

---

## Claude's Discretion

- Search debounce timing and minimum character threshold
- Like button visual design (filled vs outline heart, tap animation)
- Error rollback UX on failed like
- Mobile search tab placement
- `userStats` update strategy (same transaction vs. async increment)

## Deferred Ideas

None — discussion stayed within phase scope.
