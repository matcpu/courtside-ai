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
  origin,
  synthetic: true,
  metaInference: false,
  phases: [],
  publicReference: before,
};
const phases = [
  ["Disabled Meta preflight", ["scripts/verify-meta-live.mjs", "--preflight"]],
  ["Preseason real file and role API checks", ["scripts/preseason-audit.mjs"]],
  [
    "League operations and notification restriction checks",
    ["scripts/live-audit.mjs"],
  ],
  [
    "Signed-out, signup-screen, coach, guardian and admin browser journeys",
    ["node_modules/@playwright/test/cli.js", "test"],
  ],
  [
    "Full reachable Git-history credential scan",
    ["scripts/audit-repository.mjs"],
  ],
  [
    "Deployed browser asset credential scan",
    ["scripts/check-client-secrets.mjs", "--live-origin"],
  ],
];
try {
  for (const [name, args] of phases) {
    console.log(`Readiness phase: ${name}`);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        stdio: "inherit",
        env: { ...process.env, E2E_BASE_URL: origin },
      });
      child.on("error", reject);
      child.on("exit", resolve);
    });
    report.phases.push({ name, passed: code === 0 });
    writeFileSync(
      ".local/rehearsal-report.json",
      JSON.stringify(report, null, 2),
    );
    assert.equal(code, 0, `${name} failed`);
  }
  report.finishedAt = new Date().toISOString();
} finally {
  report.publicReferenceUnchanged =
    JSON.stringify(await publicFingerprint()) === JSON.stringify(before);
  writeFileSync(
    ".local/rehearsal-report.json",
    JSON.stringify(report, null, 2),
  );
  assert.equal(
    report.publicReferenceUnchanged,
    true,
    "Public reference data changed",
  );
}
console.log(
  "Complete private rehearsal passed. Public reference data unchanged. No Meta inference performed.",
);
