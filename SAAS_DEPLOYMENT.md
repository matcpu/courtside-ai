# SaaS deployment and rollback plan — NOT AUTHORIZED TO EXECUTE

Only existing repository `matcpu/courtside-ai`, Vercel project and Supabase `xdmkgoradmbnjofmbojs` may be used. This document is preparation. No hosted migrations, account provisioning, payments, deployments or notifications were executed for this change.

## Prerequisites and approvals

1. Review stacked PRs in order: PR #2 → PR #3 → SaaS PR. PR #2 supersedes PR #1; do not merge PR #1 separately. The SaaS branch starts at PR #3 `23b2e9572239b8b385bcd3efe5e3ccfaaa2ff5cd`. Freeze reviewed SHAs and inspect the final diff/CI before approval. Vercel Git deployment for the candidate branch is disabled; keep it disabled during review.
2. Obtain separate approval for hosted backup/upgrade/acceptance and deployment. A local pass or this plan is not that approval. Keep Stripe, Meta, notifications/SMS and local-preview bypass disabled.
3. Use the existing configured database connection and pinned Supabase CLI `2.122.0`. Make a fresh secure manual backup outside Git with roles, schema, data, Auth, Storage metadata and migration history. Verify restore/table digests, key recovery and object recovery procedures before any migration. Database dumps do not contain Storage object bytes; preserve the existing private object store and ensure recoverable object copies if restoration could affect them. Never print/upload keys, dumps or youth data. Stop if recovery cannot be verified.
4. Inspect hosted migration history and baseline schema, grants, RLS, Auth/Storage access and advisors read-only. Preserve historical timestamp differences already documented in `HOSTED_RELEASE_REVIEW.md`; do not repair/rewrite history or run unrestricted `db push` against unrelated pending files.

## Exact database order

PR #2's reviewed versions `20261104164024`, `20261104183226`, `20261105010200` are recorded as applied in the existing release notes. Verify history; do not reapply. Read-only inspection for this candidate found no hosted sport or organization columns.

Apply only missing, separately approved files, in order:

1. PR #3: `supabase/migrations/20261109132517_sport_rules.sql`
2. SaaS: `supabase/migrations/20261109174521_organization_saas_foundations.sql`
3. SaaS: `supabase/migrations/20261109174822_test_subscription_foundations.sql`

Use a reviewed exact-history mirror/pinned CLI procedure as established for the existing project, with no seeds or unrelated migrations. Record file hashes and resulting migration versions. Rehearse against a protected restored database first, including active legacy owner, revoked owner, ownerless workspace and owner over Free capacity. Verify all original rows/roles/results/history unchanged apart from new metadata and sport defaults. Review unclaimed orgs; do not grant ownership by guessing.

After migration, verify RLS on every new table, anon/direct-write denials, authenticated wrappers, service-only billing RPC, composite tenant FKs, immutable assignment, platform role isolation and existing Storage policies. Test old-client league creation/copy, ordinary league operations and the new organization creation/quota paths. Grant any hosted platform administrator only through a separately reviewed operator change to a specific confirmed user; never derive it from email, user metadata or a public signup.

## Preview and hosted acceptance

1. Build a reviewed HTTPS preview in the existing Vercel project with normal hosted Auth and `STRIPE_TEST_ENABLED=false`. No synthetic adapter, localhost URL, local service key or anonymous admin session may appear in the artifact. Keep other outbound services disabled.
2. With explicit fixture-write approval, use isolated synthetic organizations/accounts in the existing project. Test owner/admin/member/foreign/anonymous boundaries across API and direct PostgREST. Test private scoresheet/guardian upload, signed access, revocation and public redaction using synthetic documents only. Preserve all production records.
3. Run creation → program → basketball/hockey seasons → score review/standings → private website draft/publication approval. Test legacy admin without org role, cross-org program IDs, concurrent capacity/revocation/invitation/owner-transfer requests and stale Launchpad writes through actual PostgREST. Compare before/after production fingerprints excluding only approved additive metadata.
4. Test `/platform` forbidden for normal org/league admins and visible only to the reviewed dedicated platform binding. Confirm it exposes no children, contacts, tokens or document URLs. Test desktop/mobile and an account switch without stale tenant/form state.
5. Record actual hosted results separately. Local PGlite/native PostgreSQL plus the loopback adapter do not replace this gate.

## Stripe Sandbox acceptance — separate authorization required

Reauthenticate the existing Stripe connector/account first. Do not create replacement infrastructure, live keys or an unapproved Sandbox. No provider resources have been created by this candidate.

- Approve a test catalog and capacity policy. Configure separate Starter/Pro Products and active fixed recurring test Prices, quantity one. The owner chooses amounts/currency/cadence; none are assumed in code. Create a dedicated test Portal configuration limited to these products/prices, plan updates and cancellation.
- Privately set `STRIPE_SECRET_KEY` (prefer a least-privilege restricted **test** key), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PORTAL_CONFIGURATION`, `BILLING_APP_ORIGIN` and the existing server-only Supabase bridge. The origin is the exact approved HTTPS preview origin. Never use `NEXT_PUBLIC_` for secrets. Keep `STRIPE_TEST_ENABLED=false` until the authorized test run begins.
- Configure the signed snapshot webhook endpoint `/api/billing/webhook` at API version `2026-10-28.endive`, with only the types in `src/lib/subscriptions.ts`. No Connect/live-mode events are supported. Validate raw-body forwarding/signature tolerance on the real host; do not use a parsed-body proxy.
- Approve a bounded test-mode run, then enable only the preview's test flag. Use only Stripe test payment methods. Run Checkout → delayed webhook → reconcile → Portal tier change/cancel → cancellation at period end → past-due/recovery. Confirm redirects retain the selected org and never grant a tier before canonical reconciliation.
- Replay signed events; deliver older events after newer changes; test concurrent deliveries, lease expiry/provider timeout, duplicates, unknown/multiple subscriptions and forged signatures. Compare database state with current Stripe test state. Verify existing data survives downgrades and over-limit additions fail. Check webhook operational visibility and recover a reserved/expired Checkout through an operator-reviewed process.
- Disable the test flag after the run unless continued sandbox operation is explicitly authorized. Do not rotate prices without reviewing outstanding Sessions and existing subscriptions. No live billing activation is supported by this code. Tax registrations/collection, customer terms, privacy/retention, support and refund processes require separate readiness work before any commercial release.

## Deployment decision

Promotion requires code review, passing CI, verified restore, completed hosted acceptance and explicit owner deployment approval. Record exact SHA, migration versions, backup reference and acceptance evidence. Keep payment inference/notification settings unchanged. No automatic migration or data seed runs at application startup/build.

Current recommendation: **GO for draft review / NO-GO for production SaaS or payments** until the above gates are satisfied.

## Rollback / recovery

Prefer a forward fix. These additive migrations create ownership and billing history that must not be dropped after use.

1. Disable Checkout/Portal by setting the test flag off in the affected runtime. Pause new organization/league writes during investigation; do not delete existing records. Capture affected event/attempt IDs privately without raw payloads or customer data.
2. If possible keep an independently verified webhook/reconciliation worker available while blocking new billing actions. This implementation has one flag for all billing handlers; with it off, Stripe deliveries will fail/retry. Restore verified handling and replay deliveries/manual reconciliation before considering billing state recovered.
3. Roll back the application to the prior verified release only after checking its schema compatibility and creation semantics. The database trigger still enforces org permissions/capacity. Old clients do not offer org selection and use personal organizations; copying an unclaimed season or creating over capacity may be blocked. Do not claim old-UI rollback is equivalent to removing tenant enforcement.
4. Do not drop organization columns/tables, restore stale entitlements or rehome newly created seasons blindly. Preserve audit history and inspect legacy/unclaimed ownership manually. Compare current Stripe **test** subscriptions with the ledger after recovery; event timestamps alone are insufficient.
5. A full database restore is a last resort requiring explicit approval, write freeze and the verified external backup/restore instructions. Reconcile all accepted writes since backup, Auth state, Storage metadata/object availability and billing receipts before reopening. Restoring a dump over newer data without that reconciliation risks loss and is not authorized here.

No destructive down migration is supplied. No rollback action in this plan has been executed.
