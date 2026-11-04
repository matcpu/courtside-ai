# Preseason UX review candidate

November 4, 2026. Draft PR #2, `codex/organizer-setup`. **GO for local owner review; NO-GO for production enablement until approved migrations and hosted acceptance.** No merge, deployment, hosted migration/data mutation, message, inference, billing or video change is part of this work.

## What changed

- Three consistent sections: **Season rules & eligibility**, **Teams & players**, **Age verification**. The selected team controls assessment, roster and guardian links. An empty selection explains how to select or register a team. All-team readiness and completed assessments use progressive disclosure.
- Shared proof-policy controls in Launchpad and Preseason. New leagues/drafts select no document types implicitly. Required proof needs at least one accepted type; saved selections survive edits and upgrades. Validation is announced and focused. Labels, field heights, secondary actions, radio/checkbox alignment and mobile spacing use the existing visual identity.
- Guardians choose one permitted document type explicitly, then **Take a photo** or **Upload an existing photo**. Preview, capture, retake, confirmation, consent and explicit submission reuse the existing image component and private Storage path. Changing to another child's invitation in the same tab exchanges its capability, clears old state and ignores stale upload responses.
- Actual database values supply registered-team, awaiting-player, pending-document and ready-team counts. Legacy scheduling remains labeled separately, without implying document verification.
- **League configuration** is offered only to an authorized administrator with the expanded Launchpad flag enabled. Preseason remains usable when both organizer flags are off; no disabled-feature link is shown.

## Explicit no-document policy

`preseason_settings.proof_required` is separate from `enabled` (the established readiness-enforcement policy). Existing rows retain `proof_required=true` and their exact saved selections. New rows start with an empty accepted list until an administrator configures it.

With proof off, the guardian confirms the recorded details and consent through the same expiring, revocable capability. No document or guardian name is collected on that path; minimal consent timestamp/version evidence is retained. A league administrator must review age/category bounds, consent and duplicate flags and record approve/reject/resubmission with a reason. `declaration_approved` is explicitly distinct from document approval and never increments the verified-document count. Questionnaire, human placement, submitted roster, roster limits, consent, current age rules and a human eligibility decision still gate scheduling. The old basic verify endpoint remains blocked under enforced readiness.

Requiring proof later invalidates declaration-only eligibility. New uploads and finalization recheck the current policy under the league lock; an earlier upload reservation cannot bypass a policy change. Existing document decisions/history and retention controls remain. Pending approval cannot accept a document type removed from the current list. No screening claims authenticity, uses facial recognition or sends proof to Meta.

## Database and concurrency

Apply neither migration to hosted Supabase under this request. The reviewed order is:

1. `20261104164024_organizer_launchpad.sql` — unchanged from the verified concurrency repair.
2. `20261104183226_preseason_document_policy.sql` — generated with pinned CLI 2.122.0; canonical LF SHA-256 `8b267aff86594e0f76b20cec87c87283bdbac5c82e3f3fdc0f73f29dc0502c1a`.

The authoritative Launchpad snapshot already includes the entire Preseason row, so the new proof policy participates in its atomic stale-finish guard. Both writers hold the league lock. Sequential and real independent-session races cover roster bounds, cutoff, types, retention, age/category changes and the new proof policy. Stale finish returns 409 without partial record changes. Preseason also compares its expected rules version. There is one ordered application path, with restricted internal helpers and no new public table access.

## Verified evidence

| Check | Local result |
|---|---|
| TypeScript and production build | Passed with organizer flags on and off |
| Vitest | 128 tests, 18 files passed |
| PostgreSQL/WASM | 142 Launchpad/safety/schema + 30 proof-policy + 102 existing operations/preseason + 5 existing-policy upgrade + 16 repeat-clean assertions passed |
| Native PostgreSQL 17.11 | 106 safety/concurrency/schema + 30 proof-policy + 16 repeat-clean assertions passed; actual independent-session lock waits observed |
| Existing Launchpad browsers | 14 desktop/mobile Chromium cases passed |
| New preseason browsers | 4 desktop/mobile cases passed: full three-role journey and camera lifecycle/fallback |
| Flag-off browsers | 2 desktop/mobile cases passed: configure Preseason, no expanded-Launchpad link, disabled API returns 404 |
| Accessibility/layout | Keyboard Space selection, focused validation, named fields, native radio/checkbox controls, focus outlines, responsive overflow and reduced viewport/enlarged text checked; screenshots visually reviewed |
| Privacy and reference | Canonical local public snapshot unchanged; raw private object access denied; actual signed image bytes inspected; coach approval denied |
| Production read-only smoke | Home/health/public reference HTTP 200; Meta false; 12 reference teams, zero public player rows; no hosted writes |

Database counts overlap intentionally across engines. They are not a count of distinct product requirements. Browser Auth and Storage are a loopback synthetic contract adapter with real image bytes; they do not certify hosted Supabase Auth, Storage signing/CORS or current hosted RLS exposure. Camera tests use a synthetic canvas stream, not physical camera hardware. Real Safari/Android capture and a formal screen-reader audit remain unverified. No live Meta call or unrestricted email test was performed.

## Screenshots

The untracked `.local/preseason-review/` directory contains synthetic-only evidence:

- `desktop-before.png`, `mobile-before.png`: the prior mixed-page build.
- `desktop-rules-after.png`, `mobile-rules-after.png`: explicit policy selection and grouped settings.
- `desktop-team-after.png`, `mobile-team-after.png`: selected-team roster and guardian progress.
- `desktop-guardian-after.png`, `mobile-guardian-after.png`: permitted single-document selection and image preview.
- `desktop-verification-after.png`, `mobile-verification-after.png`: administrator verification workflow.

Before and after fixtures are fictional; the after journey is a dedicated synthetic season. Screenshots contain no real children's records, real credentials or raw invitation tokens and are not public repository artifacts.

## Reproduce locally

Run `npm run launchpad:review` in one terminal. It copies the workspace to an isolated temporary directory, supplies loopback-only synthetic credentials and disables Meta, SMS and notification sending. It never reads `.env.local` or contacts hosted Supabase. Use Chrome installed locally.

In PowerShell in a second terminal:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3301'
$env:LAUNCHPAD_LOCAL_PREVIEW='true'
npx --no-install playwright test launchpad.spec.ts preseason-local.spec.ts --workers=1
npm test
npm run test:database:local
# Native suite: provide only a loopback courtside_launchpad_test PostgreSQL service.
# LAUNCHPAD_TEST_DATABASE_URL must never point to hosted infrastructure.
npm run test:database:concurrency
```

For the flag-off check, stop only the local review harness, set `LAUNCHPAD_REVIEW_ORGANIZER_ENABLED=false`, rerun `npm run launchpad:review`, then set `PRESEASON_FLAG_OFF=true` in the test terminal and run `npx --no-install playwright test preseason-flag-off.spec.ts --workers=1`. Keep the loopback base URL. Tests refuse another base URL. All browser tests disable traces and video; only intentional synthetic screenshots are saved.

## Remaining release gates

No known local blocker remains in the tested journey. Hosted schema/runtime compatibility and real Auth/RLS/Storage/browser acceptance remain unverified release blockers. Obtain explicit owner approval for both exact migrations and isolated hosted synthetic fixtures, then execute the matrix in [LAUNCHPAD_RELEASE.md](LAUNCHPAD_RELEASE.md), including both proof policies and their transitions, invitation switching, upload-policy races, human review, private access, retention and opening-weekend scheduling. Obtain separate merge/deployment authorization afterward. PR #2 stays draft.
