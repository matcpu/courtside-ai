# Verification

The October 28 audit includes TypeScript, production build, 40 Vitest tests, 65 real PostgreSQL assertions and 14 public/authenticated desktop/mobile browser tests. Deployment-specific results are recorded in STATUS.md. Disabled Meta tests use mocked fetch functions and prove that saving a key does not enable API requests. Real Git index tests reject force-staged `.env.local` and `.local/` files.

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

`scripts/live-audit.mjs` tests the actual Vercel APIs with normal issued JWTs, genuine private PNG bytes, role denial, rebalancing/publication/inbox behavior and an ordinary empty season's onboarding/court/scheduling path. It asserts Meta is disabled before starting and checks the disabled agent response. Its private JSON report contains outcomes rather than credentials. The browser suite signs in through the visible forms; it does not inject a fake session or mock backend responses. Synthetic tenants are retained for reruns, and the public reference seed stays unchanged.

Live Meta image recognition, real Resend acceptance/delivery and actual account confirmation-email receipt remain unverified. Meta must stay disabled until the owner confirms credits. Do not substitute manual review, mocked contracts or queued messages for live provider evidence.

No load test of 500 simultaneous browser users, multi-season ratings materialization, or production disaster recovery has been performed.
