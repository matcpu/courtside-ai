# Reproducible hackathon readiness

Core feature scope is frozen. This pass adds rehearsal/evidence tooling and essential delivery/reliability fixes, not more league features.

## Prepare and rehearse

Use Node 24, installed Chrome, the existing Supabase project and privately configured `.env.local`. Never copy private configuration, credentials or proof files into the public repository.

```sh
npm ci
node scripts/prepare-demo.mjs
node scripts/verify-meta-live.mjs --preflight
node scripts/rehearse-demo.mjs
node scripts/judge-packet.mjs
```

Preparation uses supported Auth Admin setup only for fictional rehearsal accounts, then ordinary issued sessions and authorized application APIs. It creates two separate private seasons: an upcoming season with a contradictory submitted questionnaire, submitted roster and expiring guardian invitation; and a historical operations fixture with verified fictional mismatch history, confirmed courts and an actual private scoresheet image. The historical fixture is explicitly legacy mode, never presented as document-verified. Preparation does **not** invent model responses or perform a fake human approval.

The default preparation command preserves an existing manifest. `--fresh` creates a new independent rehearsal rather than deleting or resetting an existing tenant. Private files live in ignored, commit-blocked `.local/`; their actual secrets/capabilities must never be copied into a submission or recording. Invitations expire under league policy and require a fresh link before later judge access. Reissue/revoke through the normal coach flow and regenerate the private judge packet after replacing an invitation.

The rehearsal command runs the disabled Meta preflight, the 21-check real-file preseason audit, the 23-check operations audit, all 18 signed-out/signup-screen/admin/coach/guardian desktop/mobile browser tests, full reachable Git-history credential checks and deployed client-asset checks. It uses isolated private tenants and compares a canonical SHA-256 fingerprint of every public reference snapshot before and after. Failure stops the run and is recorded; it never substitutes canned provider output for a pass. Current results are in [STATUS.md](STATUS.md).

The signed-out public page remains available without credentials. Private administrator and coach access is prepared only in `.local/judge-access.md`; the guardian has a one-player capability rather than an administrator login. That packet must be shared securely under the organizer's access rules, never through the public repository. General self-service signup confirmation is currently restricted to the authorized email test inbox; [EMAIL_READINESS.md](EMAIL_READINESS.md) explains the dedicated-domain requirement.

## Controlled real Meta sequence — still blocked by owner instruction

Until the owner explicitly confirms credits and authorizes usage, retain `META_API_ENABLED=false` locally and in Vercel. The preflight checks real authorization, input fixtures, disabled responses, empty evidence and unchanged official/public state; it does not validate model credentials or quality.

After that separate authorization:

1. Confirm the configured model is eligible, agree the controlled run/budget and deliberately enable only the intended environment. Rebuild/redeploy as needed; do not add billing details or redeem credits automatically.
2. Run `node scripts/verify-meta-live.mjs --credits-confirmed` once. It uses the prepared manifest: questionnaire interpretation first, actual scoresheet recognition second and model-selected operations tools third. The adapters allow at most one placement request, one vision request and six bounded agent turns in this sequence; there are no automatic inference retries.
3. Require an actual provider receipt for each capability. Check exact visible image names/scores, absent unrecorded stats, useful assessment uncertainty, successful actual investigation/readiness/proposal/draft calls and newly saved pending records. The script fails if a named tool merely returned an error or an old draft was reused.
4. Inspect Meta AI activity in **both** private seasons: questionnaire receipts in the upcoming season; vision/operations receipts in the historical season. Check provider IDs, models, structured outputs, chosen arguments/outcomes and resulting record IDs. Browser clients cannot forge these records.
5. Confirm no result, placement, move or schedule was automatically approved and that public reference data remains unchanged. Review the pending actions as an administrator. Record actual latency, failures and next decisions. Only after separate human division approval should a new schedule be regenerated and published.
6. If the model fails, preserve its actual evidence and report the failure. A further paid run requires the owner's continuing authorization and an explicit fresh fixture; never hide failure behind a canned success.

There are currently zero actual Meta responses. [META_HACKATHON.md](META_HACKATHON.md) maps the jobs to the official rubric and agentic prize; [DEMO.md](DEMO.md) and [DEMO_NARRATION.md](DEMO_NARRATION.md) prepare the 180-second recording.

## Repository and disclosure checks

`scripts/audit-repository.mjs` scans all reachable Git history for private paths, configured confidential values and common credential formats, reporting only paths/object IDs on failure. CI repeats the tracked-file scan. The Git staging guard blocks private environment/configuration/fixture paths. `.vercelignore` explicitly excludes private files from deployment uploads. The client scanner checks known private values in local artifacts or both deployed entry pages and their linked script/style assets.

These checks do not certify arbitrary prose as free of every possible personal detail. Fixture provenance is separately reviewed: records/proofs are visibly fictional; the only real mailbox used is the explicitly authorized adult test inbox and its address stays in private configuration. Guardian documents never enter Meta input. The initial synthetic invitation exposed in mailbox tool output was revoked; no active capability from that preview should be used.

The final public materials are [SUBMISSION.md](SUBMISSION.md), [FEATURE_AUDIT.md](FEATURE_AUDIT.md), architecture, setup and test documentation. No final video, organizer communication, social post, legal acceptance or final form submission has occurred.
