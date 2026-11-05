# Hosted conflict response repair — approval required

**Approved and applied checkpoint:** the owner separately approved this exact migration, and version `20261105010200` is now hosted. The previously timing-out RPC returns HTTP 409 / `PT409` promptly. An independent-connection hosted test observed a real row-lock wait and confirmed the stale finish preserved minimum roster 7 with no partial record changes. GitHub CI passed on repair SHA `a0ea966c02647637157312aab7ddc66995ae9bcc`, including native concurrency. The statements below preserve the proposal/review history; no further migration is implied.

The two reviewed migrations `20261104164024` and `20261104183226` were applied after a verified encrypted backup. All 31 historical versions and existing values in 28 application tables were preserved. A protected PostgreSQL 17.11 restore matched all 66 backed-up table digests, including Auth/Storage metadata and migration history. Restore instructions are stored outside Git with the backup.

Hosted acceptance exposed a real compatibility defect: deterministic revision conflicts raised as SQLSTATE `40001` are retried indefinitely by the project's PostgREST, causing timeouts instead of HTTP 409. Two synthetic test requests were cancelled and confirmed inactive. Supabase documents this behaviour and recommends a non-retrying application error: [official troubleshooting guide](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).

## Exact proposed migration

`supabase/migrations/20261105010200_postgrest_conflict_response.sql`

Canonical LF SHA-256: `f0163c5c4689b8a581022181c81036d3a52811dff8386edc0bd4613f1b3c361b`.

Only the two public organizer/Preseason RPC wrappers change from SQL to PL/pgSQL. Each catches the private command's `40001` and raises PostgREST `PT409`, with a reload/review hint. The exception block rolls back the entire private call. Both wrappers remain SECURITY INVOKER with empty search paths, denied to anonymous/PUBLIC and executable by authenticated users. Private commands, row locks, trusted safety snapshots, existing records, policies, owners and publication approvals remain unchanged.

The Next.js handlers recognize both legacy `40001` and new `PT409`, preserving compatibility with the still-running local adapter. This migration does not enable public automatic administration, notifications or inference.

## Verification and gate

163 unit tests pass, including three API conflict regressions; TypeScript and isolated production build pass. Local SQL assertions, no-partial-write and upgrade checks pass with the new migration. Public conflict assertions now require `PT409`; private lock/check semantics remain intact. Native concurrency CI must also pass on the pushed repair head.

**Do not apply this third migration without specific owner approval.** The prior approval covered exactly two files. Keep both organizer flags off during database checks; do not promote production until actual hosted HTTP conflicts, ownership/privacy, setup and website workflows pass.

For a reviewed rollback of this wrapper-only repair, restore the prior two public SQL wrapper definitions from the existing migration files, preserving their owners/grants/search paths and all records. That reintroduces the PostgREST timeout defect, so keep Launchpad disabled if reverted. A production application rollback alone does not reverse schema/history. No blind database restore or migration-history repair is authorized.

Current hosted progress: isolated synthetic Auth users and a published redacted Scoreboard fixture exist (12 teams, 25 fixtures, 18 fictional confirmed results, configured U14 ages 12–13). No signup email, outbound notification or Meta request was made. Further conflict tests are paused until the repair is approved.
