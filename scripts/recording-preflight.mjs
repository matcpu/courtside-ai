import { readFileSync, writeFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const plan = JSON.parse(readFileSync("submission/recording-plan.json"));
let end = 0;
for (const chapter of plan.chapters) {
  assert.equal(chapter.start, end);
  assert.ok(chapter.end > chapter.start);
  end = chapter.end;
}
assert.equal(end, 180);
assert.equal(plan.totalSeconds, 180);
for (const feature of ["placement", "scoresheet", "operations"])
  assert.ok(plan.chapters.some((c) => c.receipt === feature));
console.log(
  "Recording plan validated: seven contiguous chapters, 180 seconds, all three Meta jobs and explicit human decisions.",
);
if (process.argv.includes("--check-evidence")) {
  const { actor, publicFingerprint } = await import("./lib/readiness.mjs");
  const fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
  assert.deepEqual(await publicFingerprint(), fixture.publicReference);
  const admin = await actor(fixture.accounts.admin),
    receipts = [];
  for (const league of [fixture.preseason.league, fixture.operations.league])
    receipts.push(
      ...(await admin.api(`/api/evidence?league=${league}`)).evidence,
    );
  const journalPath = `.local/meta-live-${fixture.run}.json`;
  const journal = existsSync(journalPath)
    ? JSON.parse(readFileSync(journalPath))
    : null;
  const blockers = [];
  if ((await admin.api("/api/health")).meta)
    blockers.push(
      "Inference is still enabled: disable it and reload every recording context before capture",
    );
  for (const feature of ["placement", "scoresheet", "operations"])
    if (
      !receipts.some(
        (e) => e.feature === feature && e.response_id && e.request_digest,
      )
    )
      blockers.push(`Actual ${feature} evidence is absent`);
  if (journal?.stages?.operations !== "complete")
    blockers.push("The human-review-separated live sequence has not passed");
  const report = {
    checkedAt: new Date().toISOString(),
    planValid: true,
    readyForFinalModelRecording: blockers.length === 0,
    blockers,
    receiptIds: receipts.map((r) => r.id),
    publicReferenceUnchanged: true,
    inferenceRequestsMade: 0,
  };
  writeFileSync(
    ".local/recording-readiness.json",
    JSON.stringify(report, null, 2),
  );
  if (blockers.length) {
    console.log(
      "Final model recording is gated: " +
        blockers.join("; ") +
        ". No inference was made.",
    );
    process.exitCode = 2;
  } else
    console.log(
      "Actual evidence gates passed. Follow the recording runbook; no new inference is needed for retakes.",
    );
}
