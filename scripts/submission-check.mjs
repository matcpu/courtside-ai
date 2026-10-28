import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { env, origin, publicFingerprint } from "./lib/readiness.mjs";
assert.equal(env.META_API_ENABLED, "false");
const fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
const before = await publicFingerprint();
assert.deepEqual(before, fixture.publicReference);
const report = {
  startedAt: new Date().toISOString(),
  emailScope: "complete-unchanged-not-retested",
  metaInference: false,
  phases: [],
  publicReference: before,
};
const phases = [
  ["Disabled Meta preflight", ["scripts/verify-meta-live.mjs", "--preflight"]],
  [
    "Recording plan and real-evidence gate",
    ["scripts/recording-preflight.mjs", "--check-evidence"],
  ],
  [
    "Signed-out and exact temporary-role walkthrough",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "public.spec.ts",
      "judge.spec.ts",
      "judge-access.spec.ts",
    ],
  ],
  ["Reachable repository history scan", ["scripts/audit-repository.mjs"]],
  [
    "Deployed client credential scan",
    ["scripts/check-client-secrets.mjs", "--live-origin"],
  ],
];
try {
  for (const [name, args] of phases) {
    console.log("Submission check: " + name);
    const code = await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, args, {
        stdio: "inherit",
        env: { ...process.env, E2E_BASE_URL: origin },
      });
      p.on("error", reject);
      p.on("exit", resolve);
    });
    const expectedGate =
      name === "Recording plan and real-evidence gate" && code === 2;
    report.phases.push({
      name,
      status: expectedGate
        ? "blocked-awaiting-real-model-evidence"
        : code === 0
          ? "passed"
          : "failed",
    });
    writeFileSync(
      ".local/submission-readiness.json",
      JSON.stringify(report, null, 2),
    );
    assert.ok(code === 0 || expectedGate, `${name} failed`);
  }
  report.demonstrationAndPrivateAccessVerified = true;
  report.recording = JSON.parse(
    readFileSync(".local/recording-readiness.json"),
  );
  report.submissionReady = false; // Final video/access and representative choices still require inspection.
  report.finishedAt = new Date().toISOString();
} finally {
  report.publicReferenceUnchanged =
    JSON.stringify(await publicFingerprint()) === JSON.stringify(before);
  writeFileSync(
    ".local/submission-readiness.json",
    JSON.stringify(report, null, 2),
  );
  assert.equal(report.publicReferenceUnchanged, true);
}
console.log(
  "Public/temporary-role demonstration verified without email signup. Public reference unchanged. Final submission still needs actual Meta evidence, video and representative decisions.",
);
