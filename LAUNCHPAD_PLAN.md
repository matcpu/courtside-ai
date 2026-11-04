# Organizer setup and COURTSIDE Launchpad — isolated proposal

This branch is for owner review after the November 4 submission. Production, public reference data, judge accounts, Meta evidence and video files must remain untouched. No hosted migration or deployment is authorized.

## Audit and implementation boundary

The current Create League dialog asks for three fields and creates default U14 tiers. Configuration, venue setup, access and publication are then scattered across Settings and Preseason. League Access requires an existing account, followed by another coach assignment form. Connected services occupy the first Settings card.

A `leagues` row is a season workspace, not a reusable multi-season organization. Existing divisions support multiple age categories and three tiers per category; earlier foundation constraints were extended by preseason migrations. Teams, memberships, courts, availability, private documents and versioned schedules are already tenant scoped. Keep them. A copied season will be a **new private league** with fresh identifiers, registration and schedules. Copy approved configuration and court identities only; never copy participants, contacts, proofs, invitations, results or dated availability.

1. Add an additive, unapplied SQL proposal for owner drafts, setup metadata, hashed member invitations, versioned public website drafts/publications and domain lookup receipts. Existing commands remain authoritative. New operations run atomically with database actor/tenant checks and audit events. No direct browser writes.
2. Offer guided setup, copy previous season and direct configuration. Reuse five steps for basics, season/divisions, facilities, safety and review. Autosave to owner-scoped database drafts with revision conflicts. Distinguish Save Draft, Finish Setup and Open Registration. Saving never publishes or sends a message.
3. Extend PR #1’s Launchpad and existing `/league/[slug]/website` route: real readiness, invitations, three responsive website themes, public copy/colours/logo, desktop/mobile preview and separate explicit publication controls. Keep `/league/[slug]` as the private/public portal; website output is an explicit projection of approved data. Draft content and private admin contact are never public. No public video changes.
4. Add clearly labeled rules-based identity/domain ideas and social starter copy. Domain lookup uses a bounded official RDAP endpoint, records the observed result and never interprets 404 as purchase availability. No purchases/DNS/social publishing or account creation. Name/trademark and handle checks remain explicit manual tasks.
5. Document bounded future agent tools and approval boundaries. Do not enable inference or invent model-selected actions. Current Meta tools and receipts stay intact.
6. Run TypeScript, Vitest, production build, real PostgreSQL-in-WASM assertions, API/browser integration and desktop/mobile visual checks in a local synthetic preview. Local Auth/Storage service contracts are test adapters, not a claim of hosted Supabase integration. Hosted migration, RLS advisors and hosted acceptance remain release gates after owner approval.

## Deliberate limits

No payments, automatic cropping, domain purchases, social account creation, new provider accounts, SMS, unrestricted email, production publication or billable Meta calls. Existing deterministic scheduler still owns 60-minute games/30-minute rest and eligibility; planning targets do not change those rules. Capacity is an upper bound from merged confirmed intervals, not a promise of feasible matchups. Advanced tournament/playoff/travel constraints remain deferred. Existing seasons are edited without deleting teams, divisions or history; additional age categories use existing preseason tools.

PR #1 was inspected at `43414f9` before further Launchpad work after the owner’s explicit steering. Its helpers, route, starter and tests are reused rather than replaced. Feature flags keep the larger proposal off by default. Owner review must precede generating/applying the production migration and enabling the flags. Details and verified scope will be recorded in STATUS.md.
