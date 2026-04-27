# Phase 1: Auth & Foundation - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers: (1) a working Turborepo monorepo with Next.js web and Expo mobile apps scaffolded, (2) a full database schema for all entities laid down in Neon via Drizzle, and (3) complete user authentication — sign-up (email + password + username), Google OAuth sign-in, password reset, and persistent sessions — via Clerk on both platforms.

New capabilities (posting reviews, following users, feed) are NOT in scope here.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- **D-01:** Turborepo monorepo with `apps/web` (Next.js 16) and `apps/mobile` (Expo managed workflow) and `packages/shared`
- **D-02:** `packages/shared` contains: TypeScript types (User, Review, Restaurant, etc.), typed API client (fetch wrapper imported by both apps), Zod validation schemas (shared client/server), and UI constants (colors, spacing, design tokens)

### Sign-up Experience
- **D-03:** Sign-up collects email + password + username in a single step. Username is the user's public handle (e.g. @sydney) and is set at registration so their profile URL is available immediately.
- **D-04:** Single-step sign-up form — all fields on one screen, fastest path into the app.

### Database Schema
- **D-05:** Full schema laid down in Phase 1 — all tables defined upfront: `users`, `restaurants`, `reviews`, `review_tags`, `follows`, `friendships`, `feed_items`, `likes`, `notifications`, `user_stats`. Future phases write application code against existing tables — no phase-blocking migrations.
- **D-06:** Schema must follow research-mandated patterns: `place_id` nullable on restaurants (manual entries are first-class), separate `follows` and `friendships` tables, `feed_items` table for fan-out-on-write architecture, `deleted_at` soft-delete column on reviews.

### Post-Signup Landing
- **D-07:** After sign-up, show a minimal single-screen onboarding step: "Here's how Lunchboxd works" with two calls to action — log your first meal, or find friends to follow.
- **D-08:** Session expiry: silent redirect to login page with message "Your session expired, please sign in again." No in-app modal.

### Claude's Discretion
- Exact Turborepo workspace configuration and tooling (lint, format, TypeScript config sharing)
- Clerk webhook setup for syncing auth events to the local `users` table
- EAS development build configuration (required — do not use Expo Go; SecureStore needs a dev build)
- API route structure under `/api/v1/` (establish versioning prefix in Phase 1)
- Environment variable management across monorepo workspaces

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Project vision, constraints, and key decisions
- `.planning/REQUIREMENTS.md` — AUTH-01–04 are the v1 requirements for this phase
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria
- `.planning/STATE.md` — Stack decisions locked: Next.js 16, Expo managed, Clerk, Drizzle, Neon, Cloudflare R2

### Research Artifacts
- `.planning/research/STACK.md` — Full stack recommendations with versions and rationale
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data models, build order
- `.planning/research/PITFALLS.md` — Critical pitfalls: API key exposure, schema design traps

No external specs — requirements fully captured in decisions above and research files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None yet — Phase 1 establishes the patterns all future phases will follow.

### Integration Points
- Phase 1 creates the foundation everything else connects to:
  - `/api/v1/` route prefix must be established here — all future API routes follow this convention
  - Clerk auth middleware wraps all protected routes — future phases add protected routes
  - Drizzle schema file is the single source of truth — future phases reference, not modify, core tables
  - `packages/shared` types must be imported by all future feature code in both apps

</code_context>

<specifics>
## Specific Ideas

- Letterboxd-inspired feel referenced throughout — lean into the cinematic/editorial aesthetic for auth screens
- The onboarding screen after sign-up should have two CTAs: "Log your first meal" and "Find friends to follow"
- No specific references — open to standard Clerk + Next.js auth screen patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-auth-foundation*
*Context gathered: 2026-04-27*
