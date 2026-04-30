---
status: partial
phase: 04-feed
source: [04-VERIFICATION.md]
started: 2026-04-30T10:20:00Z
updated: 2026-04-30T10:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Infinite Scroll Trigger (Web)
expected: Open the feed at `/` in a browser. Scroll to the bottom of the first page. Next page of reviews loads automatically without any button click; spinner appears briefly below the list.
result: [pending]

### 2. Pull-to-Refresh (Mobile)
expected: Open the mobile app on the Feed tab. Pull down at the top of the list. RefreshControl indicator appears; feed reloads from the first page.
result: [pending]

### 3. Author Attribution Formatting (Web + Mobile)
expected: Log in as User A, have User B follow User A, User A posts a review. Log in as User B and view the feed. Review card shows User A's avatar (or initial), `@username`, and relative time (e.g., "2h").
result: [pending]

### 4. End-of-Feed "You're all caught up." (Web)
expected: Scroll through all pages of the feed until exhausted. "You're all caught up." text appears at the bottom when `hasNextPage` becomes false.
result: [pending]

### 5. onEdit/onDelete Empty Handlers on Own Feed Cards (Warning)
expected: Log in, view own review in the feed. Click the kebab menu on own review card. Menu opens showing Edit and Delete options, but neither does anything (Phase 4 intentional scope). Verify the UX impact is acceptable.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
