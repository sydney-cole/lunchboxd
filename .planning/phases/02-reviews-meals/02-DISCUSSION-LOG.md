# Phase 2: Reviews & Meals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 02-reviews-meals
**Areas discussed:** Composer flow, Restaurant search UX, Mood tags, Post-submit landing

---

## Composer Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single full-page form | All fields on one scrollable screen | ✓ |
| Multi-step wizard | Step-by-step guided flow | |
| Bottom sheet / modal | Slides up over current screen | |

**Entry point:**

| Option | Description | Selected |
|--------|-------------|----------|
| FAB | Floating `+` button, bottom-right, always visible | ✓ |
| Nav bar button | Dedicated tab or top-right icon | |
| Profile only | "Add review" from user's profile page | |

**User's choice:** Single full-page form with FAB entry point
**Notes:** No multi-step wizard — keep it simple and fast.

---

## Restaurant Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline autocomplete | Search field on form, results drop below | ✓ |
| Dedicated search screen | Full page push on tap | |
| Modal / bottom sheet | Dismissible search overlay | |

**Manual entry timing:**

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Always shown alongside results | |
| After no results | Only appears when search returns nothing | ✓ |
| Field toggle | Explicit toggle at top of section | |

**User's choice:** Inline autocomplete; manual entry appears after no results
**Notes:** User also specified a meal type toggle (homemade / restaurant) shown upfront before the search field — this was added as D-03.

---

## Mood Tags

| Option | Description | Selected |
|--------|-------------|----------|
| Predefined list, multi-select chips | Fixed set of tags, tap to select | |
| Free-text input | User types their own tags | ✓ |
| Predefined + custom | Chips plus "add your own" | |

**Quantity limit:**

| Option | Selected |
|--------|----------|
| Unlimited | ✓ |
| Cap at 3 | |
| Cap at 5 | |

**User's choice:** Free-text, unlimited
**Notes:** No predefined tags — full flexibility.

---

## Post-Submit Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Review list (own profile) | Minimal reverse-chron list of their reviews | ✓ |
| Review detail page | Navigate to the newly created review | |
| Home / empty feed | Return to home screen | |

**User's choice:** Land on their own review list
**Notes:** This becomes the base for the Phase 5 full profile page.

---

## Claude's Discretion

- Half-star rating UI component
- Photo upload timing and R2 presigned URL flow
- Form validation and error display
- Review list card design
- Empty state for new users
- Edit flow (inline vs. navigate)

## Deferred Ideas

None.
