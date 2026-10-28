# Verification

The expanded October 28 audit includes TypeScript, production build, 58 Vitest tests, 97 real PostgreSQL assertions (65 league + 32 preseason) and 16 public/authenticated desktop/mobile browser tests. Deployment-specific results are in STATUS.md. Meta contracts are explicitly mocked and cannot establish live provider effectiveness. Real Git index tests reject force-staged `.env.local` and `.local/` files.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev
# In a second terminal:
npm run test:e2e
```

Playwright uses installed Chrome (`channel: chrome`) and two workers. On machines without Chrome, install the official browser or adjust the channel to an installed Playwright Chromium. `E2E_BASE_URL` selects an explicitly authorized test deployment. Avoid modifying the public reference seed during tests.

## Coverage and evidence

| Area | Evidence |
|---|---|
| Scheduling | Court/team collisions, rest boundaries, unconfirmed slots, infeasibility, byes, division separation, locked historical games, 500-team/250-game round |
| Eligibility | Exact cutoff, leap day, malformed/future dates, over-age player and guardian consent |
| Results | Confirmed-only standings, Elo, corrections/replay, duplicate sheet hash, missing scores/stats, wrong AI team names, explicit human review |
| Approvals | Pending placements, rejected division changes/drafts, one-time publication, schedule revisions and stale proposals |
| Notifications | Atomic multi-team outbox, no duplicate leases, failed attempts retained; mocked Resend contract checks for idempotency and provider failure |
| Security | Authenticated tenant isolation, direct writes denied, anonymous mutations denied, public contact/roster/sheet exclusion, private storage visibility |
| Meta | Mocked strict Responses schema, configured model, `store:false`, missing key, malformed/incomplete responses; **not a live Meta test** |
| Browser | Public dashboard/privacy plus actual password login, coach registration, admin approval, private photo upload/review/confirmation, schedule publication and coach inbox/read receipts on desktop/mobile emulation |

`tests/database.sql` inserts synthetic users and metadata **inside a rolled-back transaction** and executes application commands with PostgreSQL `authenticated`/`anon` roles and test JWT claims. It validates database authorization and behavior, not Supabase token issuance or an actual image upload. Execute it via authenticated project tooling or `psql` as project administrator; all assertions must pass before the final rollback. The script has been verified to leave zero test users and only the intended public demo league.

## Reproduce the authenticated live audit

```sh
# Requires the owner's authenticated Supabase CLI and private .env.local.
node scripts/prepare-live-audit.mjs
node scripts/live-audit.mjs
# PowerShell, for the public production deployment:
$env:E2E_BASE_URL='https://courtside-ai-one.vercel.app'
npm run test:e2e
```

Preparation creates only fictional `.invalid` accounts using the supported Auth Admin API. Its administrative key is read into memory through the authenticated CLI and never persisted or used by runtime APIs. Random synthetic passwords and isolated tenant IDs stay in ignored, commit-blocked `.local/`. Separate desktop/mobile accounts avoid cross-device global sign-out races. Authenticated tests skip when private fixture credentials are absent, so CI does not need an administrator key. Traces/video are disabled for those tests; request transport errors are sanitized to keep JWTs out of logs.

`scripts/live-audit.mjs` passed 23 checks against the actual Vercel APIs with normal issued JWTs, genuine private PNG bytes, role denial, rebalancing/publication/inbox behavior and an ordinary empty season's onboarding/court/scheduling path. It asserts Meta is disabled before starting and checks the disabled agent response. Its private JSON report contains outcomes rather than credentials. The browser suite signs in through the visible forms; it does not inject a fake session or mock backend responses. Separate production fixture files force a fresh actual upload through Vercel rather than reusing a local photo. The final 14-test production pass included UI division-adjustment approval and revised publication on both desktop/mobile. Synthetic tenants are retained for reruns, and the public reference seed stays unchanged.

Live Meta image recognition, real Resend acceptance/delivery and actual account confirmation-email receipt remain unverified. Meta must stay disabled until the owner confirms credits. Do not substitute manual review, mocked contracts or queued messages for live provider evidence.

No load test of 500 simultaneous browser users, multi-season ratings materialization, or production disaster recovery has been performed.

## Preseason and meaningful Meta preparation

`tests/preseason-database.sql` adds 32 rolled-back assertions for drafts/submissions/overrides, guardian capabilities, blocked shortcuts, latest-document review, real reviewer decisions, age-policy changes, withdrawal, revocation and unforgeable browser-side provider receipts. Its Storage rows are synthetic metadata only.

`node scripts/preseason-audit.mjs` runs 21 checks using the real local app or `E2E_BASE_URL=https://courtside-ai-one.vercel.app`, real Supabase sessions and actual signed PNG uploads. It checks malformed bytes, cross-origin rejection, one-player capability scope, private document access, consent validation, resubmission, duplicates, over-age rejection, expiry/revocation, readiness/opening-weekend connection, stale publication, origin deletion and retention receipts. Reports and synthetic images are kept only under `.local/`. It creates ordinary isolated seasons, not document-verified fake seed rows.

`tests/e2e/preseason.spec.ts` signs in through the visible administrator/coach forms, configures the season, saves/reloads a draft, submits an assessment/roster, opens a guardian invitation in a separate browser context, uploads/resubmits an actual proof, performs explicit reviewer approval, verifies readiness and publishes opening weekend. It runs on desktop and iPhone-sized Chromium alongside the previous 14 tests. Traces/video are disabled to avoid recording capabilities or passwords. Physical iOS/Safari capture is not certified by emulation.

`tests/operations-agent.test.ts` verifies the tool boundary and execution semantics with mocked model context: successful inspection before action, verified-history investigation, deterministic draft invocation, exactly-once mutations, argument rejection, and exclusion of youth identity/guardian data. Meta receipt contract tests exclude hidden reasoning and raw images and require a provider response ID.

The guarded `scripts/verify-meta-live.mjs` is prepared but **must not run until owner-confirmed credits and explicit model-call authorization**. Both an operator flag and enabled local/production configuration are required. No live response or actual tool-selection quality has been claimed from the current tests. See [META_HACKATHON.md](META_HACKATHON.md).
