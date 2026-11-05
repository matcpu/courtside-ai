# Current design: hosted release candidate

This candidate preserves the current uncommitted organizer branch work: three redesigned website themes, HH demo identity, connected product entry/workspaces, improved setup validation/review and the explicitly development-only automatic synthetic session. It supersedes the old GitHub UI; PR #1 is not merged separately.

## Hosted blockers confirmed November 4, 2026

- Existing Supabase project `xdmkgoradmbnjofmbojs` ends at migration `20261029042847`. Read-only catalog checks confirm `public.organizer_command(text,jsonb)` and `public.public_launch_site(text)` do not exist.
- The reviewed migrations `20261104164024_organizer_launchpad.sql` and `20261104183226_preseason_document_policy.sql` remain unapplied. Hosted schema/data changes require specific owner approval and a verified recoverable manual backup first.
- No verified recoverable backup exists. The earlier roles export is empty. A fresh diagnostic confirms a working TLS connection as `cli_login_postgres`, which can explicitly assume `postgres`; the initial application-table probe without that role failed with SQLSTATE `42501`. The official pinned CLI dump templates explicitly use `--role postgres`. Backup export/restore verification remains incomplete; this is not evidence of missing credentials.
- Local automatic sessions are intentionally unavailable in production artifacts. They use the existing in-memory loopback adapter; its users, logos/configuration and Harbour Hoops records do not exist in hosted Supabase. Do not enable this local authentication path on Vercel or point a deployment at localhost.
- A hosted credential-free interactive demo needs a separately reviewed, bounded session-provisioning path and approved synthetic fixture provisioning. Merely enabling organizer flags or sharing an administrator password would not provide the required public isolation.

## Safe preview boundary

Deploy only to the existing Vercel project `courtside-ai` (`prj_JASWQ1rQPlbrEUHAEqX7l7R0b1p8`) as a preview. Both organizer flags and local preview must be false, as must Meta, notifications and SMS, at build and runtime. Preserve the existing Supabase connection and all production settings/aliases. Preview release verification is read-only; no login/signup, Auth provisioning, live model calls, retention execution, schedule publication or hosted fixture writes.

With those flags off, the connected homepage and existing redacted reference website/portal are available. The reference website uses the existing legacy renderer; the hosted configured Scoreboard, interactive guided setup and credential-free dashboard are **not** claimed functional. Normal secure sign-in remains required for management. Do not promote this incomplete candidate as the full requested interactive release.

Vercel Authentication protects existing preview deployment URLs. Use a deployment-scoped sharing link if available; do not weaken project-wide protection for older deployments. A sharing URL is temporary review access, not a permanent public submission URL.

## Verification record

The latest application source passes isolated TypeScript/production build and 160 unit tests. The changed local credential source was retested through the full desktop creation/customization/publication/return journey. Earlier desktop/mobile coverage and local SQL/permissions/RLS/upgrade results are recorded in `INTERACTIVE_DEMO_REVIEW.md`; those are not hosted acceptance.

Executed `tests/e2e/release-smoke.spec.ts` with explicit `RELEASE_SMOKE=true` against the actual HTTPS preview in fresh desktop/mobile contexts: **2 passed**. It checks entry/navigation, reference public redaction, disabled outbound services, production denial of local-cookie/client-flag authentication and unauthenticated command rejection. No authenticated hosted writes were performed. Remote results and screenshots are private local artifacts under `.local/release-candidate/`.

Deployed application SHA: `0cdac7af1b20eeae92228f78025b891651f0a768`. Preview: `https://courtside-4375zfmf2-matcpus-projects.vercel.app` / `dpl_EMsUxCKMNfqHSuX1iMczUJrTcaUn`. A deployment-scoped 23-hour sharing URL is held only in the private local access manifest. The ordinary URL retains Vercel Authentication; this is temporary review access, not a permanent submission URL. GitHub CI [run 41941598717](https://github.com/matcpu/courtside-ai/actions/runs/41941598717) passed all verification steps, including native PostgreSQL concurrency. Reachable-history credential audit passed (562 blobs), and the production dependency audit reported zero vulnerabilities. This documentation update does not change the deployed application source.

Production target and project protection were compared after deployment and are unchanged. No production promotion, hosted migration/data write, Auth provisioning, outbound message, inference or local backend restart occurred.

## Release sequence once unblocked

1. Obtain a working authorized database connection privately; export and verify roles/schema/data outside Git, preserve protected Auth/Storage recovery requirements and test restore with the documented official procedure. Do not treat SQL-query exports or a zero-byte dump as a backup.
2. Obtain specific approval for the two reviewed migration versions and isolated hosted synthetic fixtures. Apply only those versions, in order, retaining exact history; both organizer flags stay off.
3. Run the hosted acceptance/security matrix in `LAUNCHPAD_RELEASE.md`, protecting reference data, saved Meta receipts and real records. Provision only approved synthetic identities without email. Verify a bounded public demo session cannot mutate any other tenant.
4. Produce a new SHA-bound preview with reviewed flags; check the actual HTTPS app in fresh desktop/mobile sessions, including full setup, all themes, explicit local/synthetic website publication and return to the correct dashboard. No automatic paid retries or real notification tests.
5. Promote only the fully verified release if all requested features and security gates pass. Otherwise retain the current production deployment. Preserve the prior production deployment ID for Vercel rollback; a Vercel rollback does not reverse database migrations.

No merge, hosted migration/data write, production promotion or replacement infrastructure is authorized by this document itself.
