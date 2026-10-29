# Verification

The current runtime passes TypeScript and **104 unit tests**. **170 transactional PostgreSQL assertions** passed and rolled back: 65 operations, 37 preseason, four independent-proposal reviews and 64 budget/evidence authorization checks, including explicit timestamp freshness.

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
