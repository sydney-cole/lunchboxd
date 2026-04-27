# Phase 1: Auth & Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 01-auth-foundation
**Areas discussed:** Monorepo structure, Sign-up experience, Database schema scope, Post-signup landing

---

## Monorepo Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Turborepo monorepo | apps/web + apps/mobile + packages/shared. Shared TypeScript types, API client, constants across both apps. Industry standard for this stack. | ✓ |
| Simple two-folder | web/ and mobile/ at root, no shared package infrastructure. Simpler to start, harder to share code later. | |
| Separate repos | Web and mobile in different git repos, share nothing. Maximum isolation, maximum friction for shared types. | |

**User's choice:** Turborepo monorepo

**Shared package contents selected:** TypeScript types, API client (typed fetch wrapper), Zod validation schemas, UI constants (colors, spacing, design tokens)

---

## Sign-up Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password + username | Username is their public handle (@sydney). Collected at sign-up so their profile URL is set immediately. | ✓ |
| Email + password only | Simpler sign-up, but they need to pick a username later before their profile is usable. | |
| Email + password + display name | A display name (not a unique handle) — friendlier but no @username identity. | |

**User's choice:** Email + password + username

**Flow:**

| Option | Description | Selected |
|--------|-------------|----------|
| Single step | Email, password, and username all on one screen. Fastest path to the app. | ✓ |
| Two steps | Step 1: email + password. Step 2: pick username + optional avatar. Feels more like onboarding. | |

**User's choice:** Single step

---

## Database Schema Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront | Define ALL tables in Phase 1 — users, reviews, restaurants, follows, feed_items, notifications, etc. Future phases just write code, no schema migrations blocking them. | ✓ |
| Auth tables only | Just users + sessions in Phase 1. Each future phase adds its own tables. More iterative but migrations can block phase starts. | |
| Core entities only | Users, reviews, restaurants, follows in Phase 1 — skip feed_items and notifications tables until those phases. | |

**User's choice:** Full schema upfront

---

## Post-Signup Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Empty feed with a prompt | Land on the feed page, but show an empty-state card: "Find people to follow to see their reviews." Links to user search. | |
| Straight to their profile | Land on their own (empty) profile page. They can start from there. | |
| Minimal onboarding step | After sign-up, a single screen: "Here's how Lunchboxd works" with a call to action to log their first meal or find friends. | ✓ |

**User's choice:** Minimal onboarding step

**Session expiry:**

| Option | Description | Selected |
|--------|-------------|----------|
| Silent redirect to login | API returns 401, app redirects to login with a "Your session expired, please sign in" message. | ✓ |
| Modal prompt | Show an in-app modal asking them to re-authenticate without leaving the current screen. | |

**User's choice:** Silent redirect to login

---

## Claude's Discretion

- Turborepo workspace config and tooling (lint, format, TypeScript sharing)
- Clerk webhook sync setup
- EAS dev build configuration
- API versioning prefix structure
- Environment variable management

## Deferred Ideas

None.
