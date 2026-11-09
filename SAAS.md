# Self-service SaaS foundations — review candidate

This is a separate stacked change on PR #3 head `23b2e9572239b8b385bcd3efe5e3ccfaaa2ff5cd`, on `codex/saas-foundations`. PR #2 and PR #3 are unchanged. Nothing in this candidate has been applied to hosted Supabase or deployed. Stripe remains disabled by default and supports test credentials only.

## What is implemented

- `/organizations`: existing Supabase authentication, organization creation/selection/rename, multiple leagues and seasons, organization membership, owner transfer, invitation links, usage and plan controls. Setup reuses the existing five-step Launchpad and basketball/hockey policies.
- Owner/admin/member roles. Owners manage administrators, transfer ownership and access billing. Administrators can manage the organization and invite/remove members, but cannot appoint administrators or use billing. Members see the league/season catalog. All decisions are rechecked in PostgreSQL.
- Explicit league-role delegation requires both organization management and an existing league administrator role. Organization membership alone never grants private league, scoresheet or guardian-document access. Revoking an organization member removes its delegated league grants, restoring any prior explicit league role. Independently granted league permissions survive.
- `/platform`: organization/league catalog, plan, limits, aggregate usage, unclaimed organizations, over-limit state and billing synchronization issues. Only users explicitly bound in `platform_administrators` can access it. User metadata, organization ownership and league administration cannot grant this permission. The view provides no youth/document access or tenant impersonation.
- Free, Starter and Pro plans, configured in PostgreSQL. Seed capacities are examples: Free 3 leagues / 3 season workspaces / 3 members; Starter 20 / 20 / 15; Pro 100 / 100 / 100. There are no prices or currency assumptions. Pending invitations reserve member capacity. Database locks prevent concurrent requests from exceeding capacities.
- Test-only Checkout, Customer Portal, signed webhook ingestion, event receipts, fencing leases and owner-triggered reconciliation. No new email delivery, payments, Meta inference or external provider calls were used during implementation/testing.

## Data model and compatibility

`organizations` is the business tenant; `league_programs` groups its leagues. Existing `leagues` rows remain season workspaces because results, schedules, teams, settings, website versions and audit records already reference those IDs. A program can have multiple season workspaces. Composite foreign keys prevent a season from belonging to a different organization's program. Organization/program assignment is immutable through ordinary commands.

All new tenant mutations use authenticated, transactional database commands. Org row locks serialize quota checks, invitations, role changes and billing applications. Renames compare revisions. League creation routes through a trigger that reauthorizes the selected organization; session settings are routing hints, never authorization. Existing Launchpad stale-draft checks and approval/publication commands remain intact.

New tables have RLS, restricted grants and fixed-search-path functions. Ordinary clients cannot write memberships, entitlements, billing receipts or platform roles directly. The billing service role has a narrow RPC entry, no direct billing-table privileges. Secrets and raw webhook bodies are not persisted. Organization audit and existing league audit events record delegation changes.

Existing `private.member_role`, league RLS and private Storage object policies are preserved. There is no new organization-wide document bucket or Storage permission inheritance. Public snapshots do not gain organization metadata, invitations, contacts or youth records. Organization managers see only a league/season catalog until separately authorized for that league.

### Legacy-owner migration

The ordered migration groups existing workspaces under a personal organization **only when `leagues.owner_id` still has an explicit league-admin membership**. It does not trust an old owner ID after revocation. Each old workspace gets a separate program; it does not guess that similarly named seasons belong to one business league. Group consolidation/tenant transfers require a future reviewed workflow.

Ownerless and revoked-owner workspaces receive unclaimed organizations with no invented organization membership. All previous league permissions and operations remain. New seasons in those organizations are blocked until an operator resolves ownership through a reviewed, audited procedure. There is no automatic claim endpoint. Platform administration highlights these cases.

Capacity floors preserve the number of existing programs and seasons, including owners already beyond Free capacity. No existing records, IDs, results, memberships or version/audit history are removed or rewritten. New first-time legacy creation automatically uses the actor's personal organization; callers selecting an organization must be its manager.

## Billing contract

`STRIPE_TEST_ENABLED=false` is the default. API handlers fail closed before provider requests when disabled. Only `sk_test_`/`rk_test_` keys, non-live prices/configuration/events and a fixed server-configured origin are supported. There is no live-mode switch. See `.env.example`; never put secrets in public variables or Git.

The organization owner requests a tier code, not a price/customer/redirect. The server resolves the configured price and stored customer. A database reservation plus stable Stripe idempotency keys prevents parallel Checkout duplication; a stored request hash prevents changing parameters after an ambiguous timeout. Test customers carry no copied account email/name. Ready sessions are resumed only after their customer, mode and status are checked. A current provider subscription prevents a second Checkout before its webhook arrives.

Checkout completion/return URLs do **not** grant access. Webhooks verify the exact raw body with the Stripe SDK and five-minute signature tolerance, reject live/Connect events, and store only an envelope/hash. Event IDs are unique; duplicate applied events are no-ops. A per-organization two-minute fenced lease is acquired **before** fetching all current subscriptions. Reconciliation derives entitlements from current provider state rather than webhook snapshots or event timestamps, so delayed, equal-timestamp and out-of-order events cannot restore an older tier. Expired workers cannot apply after a newer lease. Provider failures leave prior entitlements intact and return a retryable failure. SDK automatic network retries are disabled.

Only a single recognized subscription item, quantity one, active/trialing, grants Starter/Pro. Unknown prices, multiple nonterminal subscriptions, past-due/unpaid/incomplete/paused/canceled states fall back to Free with an issue code. Period-end cancellation retains access while the canonical subscription is still active. Downgrades preserve data and league operations; additions above capacity are rejected atomically. Risk events latch a review flag; they do not manufacture cancellation/refund decisions.

Customer Portal requires a dedicated, active test configuration. Its return URL selects the same organization. Owner-triggered reconciliation and webhook reconciliation share the same locking/state machine. Customers cannot directly set `effective_plan` or write receipts.

## Local verification and reproduction

Requirements: Node 24, pinned `npm ci`, Chrome for Playwright, optional loopback PostgreSQL 17.11 for true multi-connection tests. These tests use synthetic data and disposable databases, never the configured hosted project.

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run test:database:local
npm run test:database:sports
npm run test:database:sports-upgrade
npm run test:database:saas
npm run test:database:saas-upgrade
# Point only to a disposable loopback server; the native harness rejects hosted URLs.
$env:LAUNCHPAD_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55440/courtside_launchpad_test'
npm run test:database:concurrency
npm run test:database:sports-concurrency
npm run test:database:saas-concurrency
node scripts/check-env-staging.mjs --tracked
node scripts/audit-repository.mjs --tracked-only
```

For an independent browser runtime (never restart the recording backend on 3302):

```powershell
$env:LAUNCHPAD_REVIEW_FRONTEND_PORT='3501'
$env:LAUNCHPAD_REVIEW_BACKEND_PORT='3502'
$env:LAUNCHPAD_REVIEW_SAAS='true'
$env:LAUNCHPAD_LOCAL_PREVIEW='false'
node scripts/review-launchpad.mjs
# In another terminal:
$env:SAAS_LOCAL_REVIEW='true'
$env:E2E_BASE_URL='http://127.0.0.1:3501'
npx playwright test tests/e2e/saas.spec.ts --workers=1
```

The loopback-only `/__preview` fixture manifest supplies synthetic admin/coach/outsider accounts and its test password; these accounts do not exist in production. The local admin is bound as platform admin only in this disposable fixture. Invitations are manually opened in a second browser context, without email. Screenshots are written to ignored `.local/saas-review/`, masking invitation capability links. The adapter is a test double, not a deployable authentication service.

Verified locally on November 9, 2026:

| Check | Evidence |
| --- | --- |
| TypeScript / production compilation | Pass, isolated production artifact with outbound services disabled |
| Vitest | 194 tests / 26 files, including 14 Stripe policy/signature/handler tests |
| SaaS database | 56 assertions: RLS, tenant denial, document Storage authorization, roles, invitations, quotas, leases, replay and downgrade |
| SaaS upgrade | All 29 pre-existing public-table digests unchanged; active/revoked/ownerless owners and grandfathered capacity tested |
| Prior sport upgrade | All 28 original public-table digests unchanged |
| Native SaaS concurrency | Six real lock-wait cases: season capacity, revocation, invitation capacity, Checkout reservation, reconciliation lease and replay |
| Browser | Eight desktop/mobile cases: multiple hockey seasons, plan controls disabled, invite acceptance/delegation/revocation, platform denial, account-switch isolation; no horizontal overflow |

Existing Launchpad/proof-policy and basketball/hockey SQL suites are also run with all ordered migrations. The pre-existing multi-session suites remain required in CI. Auth/Storage/PostgREST behavior here is exercised through synthetic adapters and PostgreSQL fixtures; it is not hosted acceptance.

## Explicit remaining work / release blockers

- Hosted upgrade/backup rehearsal and real Supabase Auth, PostgREST and private Storage acceptance require approval. Read-only schema inspection confirms PR #3's sport migration is not hosted; both this candidate's migrations are also unapplied.
- The connected Stripe account requires reauthentication. No Stripe Sandbox API requests or actual Checkout/Portal/webhook deliveries were performed. The signature verifier is real; provider responses in tests are simulated. Real test-mode acceptance requires an authorized account, approved catalog and secrets. This is not proof of a working commercial payment service.
- Test capacities are configuration examples, not a commercial offer. No seat/usage metering, invoices UI, taxes, dunning, refunds UI, paid feature matrix or live billing is implemented. Tax registration/collection requirements must be reviewed before any future live rollout; Stripe Tax is not enabled.
- One active recurring test price per paid tier is supported. Use separate Products for Starter and Pro and configure the Portal to allow only those products/prices, quantity one. Annual/multi-currency prices and historical price aliases are not implemented; price changes need coordinated configuration/reconciliation.
- A reserved Checkout with no saved Session after an ambiguous timeout stays reserved. Do not mint another Session blindly. Recover with the same key/parameters while valid; after expiry/idempotency retention requires operator inspection of Stripe and reviewed reservation recovery. Configuration drift fails closed. There is no automatic recovery UI.
- Reconciliation is webhook-driven plus manual owner action; a periodic reconciliation scheduler, webhook-age alerts and operational recovery runbooks need hosted acceptance before commercial launch. Risk flags require operator investigation and currently have no customer-clear action.
- Platform overview is aggregate/read-only, unpaginated and intended for initial operations. It is not a support impersonation tool. Invite delivery remains manual links through existing confirmed accounts; unrestricted signup/notification delivery is not added.

This candidate is ready for code review and controlled acceptance, **not production-ready**. Deployment and rollback are separate in [SAAS_DEPLOYMENT.md](SAAS_DEPLOYMENT.md).
