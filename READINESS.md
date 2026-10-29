# Reproducible hackathon readiness

Core feature scope is frozen. Restricted email testing is complete for this hackathon and must not be expanded or rerun for footage. This pass is limited to judge access, bounded Meta verification, recording and submission materials.

## Prepare and rehearse

Use Node 24, installed Chrome, the existing Supabase project and privately configured `.env.local`. Never copy private configuration, credentials or proof files into the public repository.

```sh
npm ci
node scripts/prepare-demo.mjs
node scripts/verify-meta-live.mjs --preflight
node scripts/submission-check.mjs
node scripts/judge-packet.mjs
```

Preparation uses supported Auth Admin setup only for fictional rehearsal accounts, then ordinary issued sessions and authorized application APIs. It creates two separate private seasons: an upcoming season with a contradictory submitted questionnaire, submitted roster and expiring guardian invitation; and a historical operations fixture with verified fictional mismatch history, confirmed courts and an actual private scoresheet image. The historical fixture is explicitly legacy mode, never presented as document-verified. Preparation does **not** invent model responses or perform a fake human approval.

The default preparation command preserves an existing manifest. `--fresh` creates a new independent rehearsal rather than deleting or resetting an existing tenant. Private files live in ignored, commit-blocked `.local/`; their actual secrets/capabilities must never be copied into a submission or recording. Invitations expire under league policy and require a fresh link before later judge access. Reissue/revoke through the normal coach flow and regenerate the private judge packet after replacing an invitation.

The submission check runs the disabled Meta preflight, recording/evidence gate, 16 signed-out/signup-screen/exact-temporary-role desktop/mobile checks, reachable Git-history scan and deployed-client scan. It sends no email, invokes no model and compares every public reference snapshot before/after. Missing actual model evidence is reported as a submission gate, not a fabricated success. Earlier core validation remains recorded separately: 21 preseason API/file checks, 23 operations checks and the full 18-test workflow suite passed before scope freeze. Those email/operations tests need not be repeated to prepare a recording.

The signed-out public page remains available without credentials. Fresh administrator/coach accounts have roles in exactly two purely synthetic seasons, separate from controlled-email test tenants, and were verified through normal login. The private packet is `.local/judge-access.md`; the guardian uses a one-player invitation. Share only through an organizer-approved private channel. No unrestricted signup or sending domain is needed for judge access. See [JUDGE_GUIDE.md](JUDGE_GUIDE.md) for access, invitation refresh and manual account-retirement details.

## Controlled real Meta sequence — perception complete, protected human pause

The owner has confirmed credits and authorized one bounded sequence. Retain saved `META_API_ENABLED=false` locally and in Vercel; enable only the scoped loopback process during the actual run. The preflight checks real authorization, input fixtures, disabled responses and unchanged official/public state. Before the first real run its evidence is empty; afterward it preserves the existing genuine receipts without requiring another paid call. It does not validate model credentials or quality.

The original allowance remains eight requests, not eight more. Current evidence and remaining steps:

1. Confirm the configured model is eligible, agree the controlled run/budget and deliberately enable only the intended environment. Rebuild/redeploy as needed; do not add billing details or redeem credits automatically.
2. Run `node scripts/verify-meta-live.mjs --credits-confirmed --stage perception` once: one placement request and one vision request. The script saves genuine responses before evaluating quality and stops for administrator scoresheet review. Each job is durably marked BEFORE dispatch; a crash or uncertain timeout cannot trigger a repeat paid attempt.
3. Require an actual provider receipt for each capability. Check exact visible image names/scores, absent unrecorded stats, useful assessment uncertainty, successful actual investigation/readiness/proposal/draft calls and newly saved pending records. The script fails if a named tool merely returned an error or an old draft was reused.
4. Inspect Meta AI activity in **both** private seasons: questionnaire receipts in the upcoming season; vision/operations receipts in the historical season. Check provider IDs, models, structured outputs, chosen arguments/outcomes and resulting record IDs. Browser clients cannot forge these records.
5. In the normal UI, inspect the actual scoresheet and explicitly confirm its result as administrator. Then run `node scripts/verify-meta-live.mjs --credits-confirmed --stage operations`. It refuses unreviewed/manual-substitute results and allows at most six agent turns. Across both stages the ceiling is eight requests and 23,000 output tokens, with zero transport retries; input/image usage is additional; reasoning is included in provider output, so this is not a dollar ceiling. No move or publication is automatically approved. A later result change would invalidate the agent's proposals/draft, so capture the result review before the agent stage. Approve a move separately, then regenerate and publish deterministically. Disable inference again before recording retakes.
6. If the model fails, preserve its actual evidence and report the failure. A further paid run requires the owner's separate explicit authorization and an explicit fresh fixture; never hide failure behind a canned success.

There are currently two actual Meta responses. Perception passed; the agent remains unrun until explicit human result confirmation. Do not repeat the perception stage. See [META_VERIFICATION.md](META_VERIFICATION.md) for the remaining local-only sequence and usage. [META_HACKATHON.md](META_HACKATHON.md) maps the jobs to judging; [RECORDING_RUNBOOK.md](RECORDING_RUNBOOK.md), [DEMO.md](DEMO.md) and [DEMO_NARRATION.md](DEMO_NARRATION.md) cover every screen/action in the validated 180-second plan. No final video is claimed yet.

## Repository and disclosure checks

`scripts/audit-repository.mjs` scans all reachable Git history for private paths, configured confidential values and common credential formats, reporting only paths/object IDs on failure. CI repeats the tracked-file scan. The Git staging guard blocks private environment/configuration/fixture paths. `.vercelignore` explicitly excludes private files from deployment uploads. The client scanner checks known private values in local artifacts or both deployed entry pages and their linked script/style assets.

These checks do not certify arbitrary prose as free of every possible personal detail. Fixture provenance is separately reviewed: records/proofs are visibly fictional; the only real mailbox used is the explicitly authorized adult test inbox and its address stays in private configuration. Guardian documents never enter Meta input. The initial synthetic invitation exposed in mailbox tool output was revoked; no active capability from that preview should be used.

The final public materials are [SUBMISSION.md](SUBMISSION.md), [FEATURE_AUDIT.md](FEATURE_AUDIT.md), architecture, setup and test documentation. No final video, organizer communication, social post, legal acceptance or final form submission has occurred.
