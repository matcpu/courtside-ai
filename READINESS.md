# Reproducible review readiness

Use the existing repository, Supabase project and Vercel application. All fixtures are synthetic. Restricted email testing is complete and unchanged.

The signed-out public reference works without an account. Temporary administrator and coach accounts each belong to exactly two private synthetic seasons. The upcoming season demonstrates questionnaires, guardian consent, proof review and readiness; the historical season supplies fictional verified mismatch history. Historical seed records are explicitly legacy inputs, not document-verified results. The private packet is `.local/judge-access.md`; never commit or publish it. See [JUDGE_GUIDE.md](JUDGE_GUIDE.md).

## Rehearse without inference

With Node 24, installed Chrome and private `.env.local`:

```sh
node scripts/prepare-demo.mjs
node scripts/verify-meta-live.mjs --preflight
node scripts/recording-preflight.mjs --check-evidence
node scripts/submission-check.mjs
node scripts/judge-packet.mjs
```

Preparation preserves the manifest. Do not create fresh leagues merely for retakes. Guardian invitations expire within 72 hours: refresh the pending fictional player's invitation before judging with `node scripts/refresh-judge-invitation.mjs`, then regenerate the packet. No email is sent. Preserve approved decisions and history.

## Actual evidence and spending controls

All three primary capabilities have genuine Muse Spark responses. The main sequence used seven requests: placement, vision and five operations responses. The owner confirmed the actual 78–43 result before agent execution, then approved both original synthetic division proposals. Revised schedule v3 uses those divisions and remains unpublished for owner review. Expanded evaluations and actual error recovery are in [EVALUATION_REPORT.md](EVALUATION_REPORT.md).

The former eight-request allowance is historical and superseded. The current budget serializes reservations across private scopes, conservatively charges usage, limits cumulative guarded spending to 120 units and preserves at least 30 observed promotional units. Unknown outcomes retain their full hold and pause inference. Credit observations must be recent and truthful. Production and saved local inference stay disabled. No automatic paid retries or recording-time inference is needed.

`scripts/evaluate-meta.mjs` verifies an immutable generated-input manifest and exact hashes, registers synthetic cases, saves actual outputs before quality checks and stops on execution errors. It requires explicit operator arguments, authorized scope and a fresh credit observation. Do not rerun the completed historical perception/operations scripts or delete attempt markers.

## Evidence and privacy

Meta activity retains actual provider IDs, outputs, tool outcomes and saved record links. Canonical action cards identify current human decisions and flag the observed Riverside/Parkdale narrative mistake without rewriting the answer. Standalone evaluations carry synthetic/experimental metadata; a provider response alone never proves execution.

Regular guardian documents use local OCR, image similarity and deterministic eligibility, with no Meta dispatch path. Only immutable generated fictional illustrations entered the separate model experiment. No real children's records or guardian documents were used.

Repository/history and deployed-client scans check configured private values and common credentials. Private environment, fixture and Vercel paths are ignored and staging-blocked; deployment uploads exclude them. These checks complement provenance review and do not certify arbitrary prose against every possible disclosure.

Final video publication, representative choices and entry submission remain owner decisions. See [RECORDING_RUNBOOK.md](RECORDING_RUNBOOK.md) and [SUBMISSION.md](SUBMISSION.md).
