# Verification

The verified baseline on October 28, 2026 includes TypeScript, production build, 35 Vitest assertions, 53 real PostgreSQL assertions and 12 browser/API checks on desktop/mobile. Browser checks passed locally and against the public production deployment. Final run counts and deployment evidence are recorded in STATUS.md.

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
| Browser | Real database public dashboard, published schedule, team search, viewport fit, no page errors, auth-protected API routes |

`tests/database.sql` inserts synthetic users and metadata **inside a rolled-back transaction** and executes application commands with PostgreSQL `authenticated`/`anon` roles and test JWT claims. It validates database authorization and behavior, not Supabase token issuance or an actual image upload. Execute it via authenticated project tooling or `psql` as project administrator; all assertions must pass before the final rollback. The script has been verified to leave zero test users and only the intended public demo league.

Live Meta image recognition, real Resend acceptance/delivery, actual account email confirmation and a complete signed-in browser mutation walkthrough require account credentials/owner participation. These must remain explicitly unverified until exercised. Do not substitute mocked responses for live integration evidence.

No load test of 500 simultaneous browser users, multi-season ratings materialization, or production disaster recovery has been performed.
