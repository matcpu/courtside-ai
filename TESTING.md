# Preseason UX candidate verification

The current local verification and exact reproduction commands are in [PRESEASON_UX_REVIEW.md](PRESEASON_UX_REVIEW.md). New suites: `scripts/test-preseason-policy.mjs`, `tests/e2e/preseason-local.spec.ts`, `tests/e2e/preseason-flag-off.spec.ts`. SQL covers policy upgrades, explicit human declaration review, consent/age/readiness gates and the prior stale-finish repair. Browsers exercise actual Next routes against loopback-only synthetic Auth/Storage adapters. These are not hosted Supabase acceptance results. No recording/video or paid inference is used.

---

# Launchpad blocker repair — local verification

The repaired Launchpad branch uses one ordered migration (`20261104164024_organizer_launchpad.sql`) and no proposal loader. `npm run test:database:local` passes 254 SQL/schema assertions across the repaired workflows, existing operations/preseason and a second clean bootstrap. `npm run test:database:concurrency` uses native PostgreSQL 17.11 and passes 113 assertions across separate sessions and a second clean bootstrap. It observes actual lock waits; it does not infer concurrency from the single-connection WASM queue. CI runs both suites using an ephemeral loopback PostgreSQL service. Hosted database URLs are rejected by the native harness.

Cases cover all requested safety fields, immutable trusted snapshots, ABA, both writer orderings, capture after a lock wait, HTTP 409 and no partial changes across the affected record graph. Browser testing remains a local Auth/PostgREST contract plus real SQL; hosted Supabase acceptance is a separate approval gate. See LAUNCHPAD_RELEASE.md for final commit/test evidence and remaining blockers.

---

# Verification

The current camera runtime passes TypeScript, production build and **115 unit tests**. Its November 3 pass rechecked **102 transactional SQL assertions** and **22 production browser cases**, plus the blurred-document API regression and coach camera filming check; see STATUS.md for scope. The earlier release pass separately checked 106 SQL assertions and 21 real API/file cases. The following 170-assertion total is the earlier broader baseline. **170 transactional PostgreSQL assertions** passed and rolled back: 65 operations, 37 preseason, four independent-proposal reviews and 64 budget/evidence authorization checks, including explicit timestamp freshness.

These are separate from genuine provider evaluations: six scoresheets (one reused baseline), three questionnaires (one reused baseline), eight generated document illustrations and multistep operations/error recovery. See [EVALUATION_REPORT.md](EVALUATION_REPORT.md). Mocked responses remain contract tests, never model-quality evidence.

## Run checks

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev
npm run test:e2e
```

Playwright uses installed Chrome, desktop and iPhone-sized Chromium, with two workers. Physical Safari/camera support is not certified by emulation. Authenticated fixtures and traces stay private; normal visible login is exercised rather than injecting mocked sessions.

Run SQL files through authenticated tooling against only Supabase xdmkgoradmbnjofmbojs. They create synthetic users/state inside a transaction and roll back. Finance tests dispatch no provider request; global exhaustion is tested sequentially with row-lock structure verification, not represented as concurrent stress certification.

## Integration coverage

- `scripts/preseason-audit.mjs`: 21 grouped checks with actual signed image uploads, server-local OCR, malformed-byte rejection, guardian capability/Origin restrictions, admin-only proofs, exact and JPEG-recompressed reuse, human resubmission, age restrictions, readiness/opening-weekend scheduling and actual deletion/retention.
- `tests/e2e/preseason.spec.ts`: administrator setup, coach draft/resume/submission, guardian upload/resubmission, reviewer inspection/approval and scheduling on desktop/mobile.
- `tests/e2e/authenticated.spec.ts`: registration, approval, original scoresheet review, manual result, standings, rebalancing, revised publication and coach in-app receipt.
- `tests/e2e/judge-access.spec.ts`: exact temporary synthetic accounts, only their two memberships, denied privileged public-reference reads, coach/admin boundaries, saved Meta evidence and canonical Riverside warning, separate guardian context.
- Public/signup checks show honest restricted email behavior without sending messages. Restricted actual email receipt/signup/retry tests were completed earlier and are not repeated.
- Unit coverage includes deterministic ratings/constraints, OCR worker timeout and nested-worker cleanup, pHash recompression/orientation, finance reservation/settlement, no automatic retries, schema failure, identifier-preserving privacy filtering and canonical action presentation.

## Build and scans

A fresh isolated build outside OneDrive copies tracked source and installed dependencies, excluding private environment files. It avoids deleting the workspace's cloud-placeholder cache. `scripts/check-ocr-bundle.mjs --isolated` verifies deployed tracing includes the dynamic worker, WASM, language data and transitive packages.

`scripts/audit-repository.mjs` scans reachable Git history and tracked source for private paths/configured values/common secrets. `scripts/check-client-secrets.mjs --live-origin` inspects both deployed entry pages and linked client assets. CI repeats the source checks, typecheck, tests, build and OCR trace validation.

No simultaneous 500-browser load test, issuer-authentication benchmark, disaster-recovery certification or legal compliance certification is claimed. STATUS.md contains exact final deployed results.

## Safe release rehearsals

Set `E2E_AUDIT_FILE` to an ignored synthetic account file to avoid mutating another rehearsal's fixtures. `E2E_NO_PUBLISH=true` exercises draft generation and approval controls while withholding schedule publication. The authenticated browser test intentionally stops at that boundary; SQL transactions still cover publication, outbox and read receipts and then roll back. Read-only judge/evidence tests keep the canonical private fixture intact. Never treat a UI health stub in the deterministic-scheduling regression as a model response or dispatch authorization.

## Camera regression opt-in

`tests/e2e/camera.spec.ts` requires ignored `.local/camera-audit.json` and an absolute `E2E_CAMERA_FEED` path to a visibly synthetic Y4M fixture. Chrome uses the real media/canvas path with a virtual device; native OS pickers and physical optics are not simulated as certified hardware. The tests explicitly distinguish actual Chrome permission denial from injected no-device/storage faults. Preseason tests can use the same opt-in feed for actual camera JPEG upload, while ordinary runs retain gallery/native-file paths. Keep feeds, Auth accounts, screenshots and recordings private. No model dispatch is part of these tests.
