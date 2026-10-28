// No inference unless the OWNER has confirmed credits and explicitly authorized use.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  actor,
  env,
  origin,
  publicFingerprint,
  assertPrivate,
} from "./lib/readiness.mjs";
const live = process.argv.includes("--credits-confirmed");
if (!live && !process.argv.includes("--preflight"))
  throw new Error(
    "Choose --preflight. Live mode requires owner credit confirmation and authorization.",
  );
assert.equal(
  env.META_API_ENABLED,
  live ? "true" : "false",
  "Local Meta configuration must match the explicitly selected mode",
);
const health = await (await fetch(origin + "/api/health")).json();
assert.equal(
  health.meta,
  live,
  "Server Meta configuration must match the explicitly selected mode",
);
const fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
assert.equal(fixture.synthetic, true);
assert.equal(fixture.origin, origin);
const admin = await actor(fixture.accounts.admin),
  coach = await actor(fixture.accounts.coach);
const baseline = await publicFingerprint();
assert.deepEqual(baseline, fixture.publicReference);
const before = await assertPrivate(admin, fixture.operations.league);
await assertPrivate(admin, fixture.preseason.league);
const requests = [
  [
    "placement",
    coach,
    "/api/placement",
    { league: fixture.preseason.league, team_id: fixture.preseason.team },
  ],
  [
    "scoresheet",
    admin,
    "/api/scoresheet",
    {
      league: fixture.operations.league,
      game_id: fixture.operations.game,
      path: fixture.operations.path,
      mode: "meta",
    },
  ],
  [
    "operations",
    admin,
    "/api/agent",
    {
      league: fixture.operations.league,
      objective:
        "Investigate Eastside Eagles using verified game history, inspect preseason readiness without youth identity data, save a supported competitive adjustment proposal and prepare one feasible next-round draft using CURRENT APPROVED divisions. Explain saved record IDs and next human approvals. Do not approve or publish anything.",
    },
  ],
];
const report = {
  at: new Date().toISOString(),
  mode: live ? "actual-provider" : "disabled-preflight",
  synthetic: true,
  checks: [],
  actualModelOutputs: live,
  publicReference: baseline,
  results: {},
};
const output = live
  ? ".local/meta-live-report.json"
  : ".local/meta-preflight-report.json";
const save = () => writeFileSync(output, JSON.stringify(report, null, 2));
try {
  for (const [feature, who, path, payload] of requests) {
    if (live) {
      const e = await admin.api(`/api/evidence?league=${payload.league}`);
      assert.ok(
        !e.evidence.some((r) => r.feature === feature),
        "Existing provider evidence found; inspect it rather than repeat paid work. Prepare a fresh fixture if a new run is authorized.",
      );
    }
    const result = await who.api(path, payload, "POST", live ? 200 : 503);
    if (!live) assert.match(result.error, /paused|disabled/i);
    if (live && feature === "placement") {
      assert.ok(result.evidence?.id);
      assert.ok(
        result.interpretation.inconsistencies.length ||
          result.interpretation.clarifyingQuestions.length,
        "Actual model must identify uncertainty",
      );
    }
    if (live && feature === "scoresheet") {
      assert.ok(result.evidence?.id);
      assert.equal(result.official, false);
      assert.equal(result.extraction.homeTeam, "Eastside Eagles");
      assert.equal(result.extraction.awayTeam, "Riverside Ravens");
      assert.equal(result.extraction.homeScore, 78);
      assert.equal(result.extraction.awayScore, 43);
      assert.deepEqual(
        result.extraction.players,
        [],
        "Unrecorded player stats must remain absent",
      );
    }
    if (live && feature === "operations") {
      for (const tool of [
        "inspect_league",
        "inspect_team_history",
        "inspect_preseason_readiness",
        "propose_balance",
        "draft_schedule",
      ])
        assert.ok(
          result.trace.some((t) => t.tool === tool && !t.outcome?.error),
          `A successful actual model-selected ${tool} call is required`,
        );
      assert.equal(result.requiresHumanApproval, true);
    }
    report.results[feature] = result;
    report.checks.push({ feature, passed: true });
    save();
    console.log(
      `PASS ${feature}: ${live ? "actual provider result and evidence" : "disabled without model call"}`,
    );
  }
  const after = await assertPrivate(admin, fixture.operations.league);
  assert.equal(
    after.league.revision,
    before.league.revision,
    "No automatic publication",
  );
  assert.deepEqual(
    after.teams.map((t) => [t.id, t.division_id, t.status]),
    before.teams.map((t) => [t.id, t.division_id, t.status]),
    "No automatic placements or moves",
  );
  assert.equal(
    after.games.find((g) => g.id === fixture.operations.game).status,
    "scheduled",
    "No automatic result confirmation",
  );
  report.receipts = [];
  for (const league of [fixture.preseason.league, fixture.operations.league]) {
    const e = await admin.api(`/api/evidence?league=${league}`);
    report.receipts.push(...e.evidence);
  }
  if (live) {
    for (const feature of ["placement", "scoresheet", "operations"])
      assert.ok(
        report.receipts.some(
          (r) =>
            r.feature === feature &&
            r.response_id &&
            r.model &&
            r.request_digest,
        ),
      );
    assert.ok(
      after.proposals.some(
        (p) =>
          p.status === "pending" &&
          !before.proposals.some((b) => b.id === p.id),
      ),
      "Agent must save a NEW pending proposal",
    );
    assert.ok(
      after.versions.some(
        (v) =>
          v.status === "draft" && !before.versions.some((b) => b.id === v.id),
      ),
      "Agent must save a NEW feasible draft",
    );
  } else
    assert.deepEqual(
      report.receipts,
      [],
      "Fixtures must never masquerade as model evidence",
    );
  assert.deepEqual(await publicFingerprint(), baseline);
  report.finishedAt = new Date().toISOString();
  report.humanApprovalsPerformed = false;
  report.publicReferenceUnchanged = true;
  save();
  console.log(
    live
      ? "All three actual model jobs verified. Review private activity and saved actions; human approvals remain required."
      : "All three integrations fail closed correctly. Actual model effectiveness remains unverified. Public reference data is unchanged.",
  );
} catch (e) {
  report.failed = true;
  report.error = e.message;
  save();
  throw e;
}
