// No inference unless the OWNER has confirmed credits and explicitly authorized use.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  actor,
  env,
  origin,
  publicFingerprint,
  assertPrivate,
} from "./lib/readiness.mjs";
import {
  claimModelAttempt,
  assertHumanResultReview,
  META_VERIFY_LIMITS,
} from "./lib/meta-run-control.mjs";
const live = process.argv.includes("--credits-confirmed");
const stage = process.argv[process.argv.indexOf("--stage") + 1];
if (live && !["perception", "operations"].includes(stage))
  throw new Error(
    "Live mode requires --stage perception or --stage operations, with a human result-review pause between them.",
  );
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
assert.ok(
  fixture.origin === origin ||
    (process.env.META_VERIFICATION_LOCAL === "true" &&
      origin === "http://127.0.0.1:3000" &&
      fixture.origin === "https://courtside-ai-one.vercel.app"),
);
const admin = await actor(fixture.accounts.admin),
  coach = await actor(fixture.accounts.coach);
const baseline = await publicFingerprint();
assert.deepEqual(baseline, fixture.publicReference);
const before = await assertPrivate(admin, fixture.operations.league);
const preseasonBefore = await assertPrivate(admin, fixture.preseason.league);
const evidenceBefore = [];
if (!live)
  for (const league of [fixture.preseason.league, fixture.operations.league])
    evidenceBefore.push(
      ...(await admin.api(`/api/evidence?league=${league}`)).evidence,
    );
if (live)
  assert.ok(
    before.teams.length <= 12 &&
      before.games.length <= 30 &&
      before.availability.length <= 80,
    "Controlled fixture exceeded its planned input scope",
  );
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
const output = live
  ? `.local/meta-live-${fixture.run}.json`
  : ".local/meta-preflight-report.json";
const report =
  live && existsSync(output)
    ? JSON.parse(readFileSync(output))
    : {
        at: new Date().toISOString(),
        mode: live ? "actual-provider" : "disabled-preflight",
        synthetic: true,
        checks: [],
        actualModelOutputs: false,
        fixtureRun: fixture.run,
        limits: META_VERIFY_LIMITS,
        publicReference: baseline,
        results: {},
        stages: {},
      };
if (live && stage === "operations") {
  assert.equal(
    report.stages?.perception,
    "complete",
    "Complete the perception stage before operations",
  );
  assertHumanResultReview(
    before,
    report.results.scoresheet,
    fixture.operations.game,
  );
}
const save = () => writeFileSync(output, JSON.stringify(report, null, 2));
try {
  for (const [feature, who, path, payload] of requests) {
    if (
      live &&
      ((stage === "perception" && feature === "operations") ||
        (stage === "operations" && feature !== "operations"))
    )
      continue;
    if (live) {
      const e = await admin.api(`/api/evidence?league=${payload.league}`);
      assert.ok(
        !e.evidence.some((r) => r.feature === feature),
        "Existing provider evidence found; inspect it rather than repeat paid work. Prepare a fresh fixture if a new run is authorized.",
      );
      claimModelAttempt(".local", fixture.run, feature);
    }
    const result = await who.api(path, payload, "POST", live ? 200 : 503);
    // Save the actual response before evaluating its quality; failures must remain visible.
    report.results[feature] = result;
    if (live) report.actualModelOutputs = true;
    save();
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
      assert.equal(
        result.extraction.homeTeam?.trim().toLowerCase(),
        "eastside eagles",
      );
      assert.equal(
        result.extraction.awayTeam?.trim().toLowerCase(),
        "riverside ravens",
      );
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
    before.games.find((g) => g.id === fixture.operations.game).status,
    "No automatic result confirmation",
  );
  const preseasonAfter = await assertPrivate(admin, fixture.preseason.league);
  assert.deepEqual(
    preseasonAfter.teams.map((t) => [t.id, t.status, t.division_id]),
    preseasonBefore.teams.map((t) => [t.id, t.status, t.division_id]),
    "No automatic preseason approval",
  );
  report.receipts = [];
  for (const league of [fixture.preseason.league, fixture.operations.league]) {
    const e = await admin.api(`/api/evidence?league=${league}`);
    report.receipts.push(...e.evidence);
  }
  if (live) {
    for (const feature of stage === "perception"
      ? ["placement", "scoresheet"]
      : ["placement", "scoresheet", "operations"])
      assert.ok(
        report.receipts.some(
          (r) =>
            r.feature === feature &&
            r.response_id &&
            r.model &&
            r.request_digest,
        ),
      );
    if (stage === "operations") {
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
    }
  } else
    assert.deepEqual(
      report.receipts.map((r) => [r.id, r.request_digest]).sort(),
      evidenceBefore.map((r) => [r.id, r.request_digest]).sort(),
      "Paused preflight must preserve existing genuine evidence without creating any",
    );
  assert.deepEqual(await publicFingerprint(), baseline);
  report.finishedAt = new Date().toISOString();
  report.humanApprovalsPerformed = false;
  if (live) {
    report.stages[stage] = "complete";
    report.next =
      stage === "perception"
        ? "Stop. Administrator must inspect and confirm the actual scoresheet in the normal UI before the operations stage."
        : "Review saved proposal and draft. Do not confirm another result before the proposal decision; that would invalidate its evidence.";
  }
  report.publicReferenceUnchanged = true;
  save();
  console.log(
    live
      ? stage === "perception"
        ? "Perception responses captured. Stop for human scoresheet review/confirmation; no operations call has run."
        : "All three actual model jobs verified across two stages. Review private activity and pending actions; no move or publication was approved."
      : "All three integrations fail closed correctly. This preflight does not verify live model effectiveness. Public reference data is unchanged.",
  );
} catch (e) {
  report.failed = true;
  report.error = e.message;
  save();
  throw e;
}
