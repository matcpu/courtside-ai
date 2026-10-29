// Explicit operator-only synthetic evaluation; no web endpoint or guardian-file input.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import { metaJSON } from "../src/lib/meta.ts";
import { metaBudgetRPC } from "../src/lib/meta-budget.ts";
import { extractionSchema } from "../src/lib/domain.ts";
import {
  placementInterpretation,
  recommendPlacement,
  preseasonQuestionnaire,
} from "../src/lib/preseason.ts";
import {
  scoresheetInstructions,
  placementInstructions,
} from "../src/lib/meta-prompts.ts";
import {
  syntheticDocumentAnalysis,
  syntheticDocumentInstructions,
} from "../src/lib/synthetic-document-analysis.ts";
if (!process.argv.includes("--authorized-promotional-evaluation"))
  throw Error(
    "Explicit promotional evaluation mode required; owner authorization must exist",
  );
const config = parse(fs.readFileSync(".env.local"));
assert.equal(config.META_API_ENABLED, "false");
Object.assign(process.env, config, { META_API_ENABLED: "true" });
const group = process.argv[process.argv.indexOf("--group") + 1];
assert.ok(["scoresheets", "questionnaires", "documents"].includes(group));
const version = process.argv.includes("--prompt-version")
  ? process.argv[process.argv.indexOf("--prompt-version") + 1]
  : "v1";
assert.ok(["v1", "v2"].includes(version));
const only = process.argv.includes("--case")
  ? process.argv[process.argv.indexOf("--case") + 1]
  : null;
const root = path.resolve(".local/meta-evaluations"),
  manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"))),
  { fixtureSetSha256, ...body } = manifest;
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(hash(Buffer.from(JSON.stringify(body))), fixtureSetSha256);
assert.equal(manifest.synthetic, true);
const demo = JSON.parse(fs.readFileSync(".local/demo-manifest.json"));
assert.equal(demo.synthetic, true);
const context = {
  actor: demo.accounts.admin.id,
  league: demo.operations.league,
};
const output = path.join(root, "actual-evaluation.json");
const report = fs.existsSync(output)
  ? JSON.parse(fs.readFileSync(output))
  : {
      fixtureSetSha256,
      synthetic: true,
      startedAt: new Date().toISOString(),
      results: {},
    };
assert.equal(report.fixtureSetSha256, fixtureSetSha256);
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
await metaBudgetRPC(
  "observe_credits",
  JSON.parse(fs.readFileSync(".local/meta-credit-observation.json")),
);
const canonical = (players) =>
  players
    .map((p) => ({
      jersey: p.jersey,
      team: p.team,
      points: p.points,
      rebounds: p.rebounds,
      assists: p.assists,
    }))
    .sort((a, b) => (a.team + a.jersey).localeCompare(b.team + b.jersey));
for (const fixture of manifest[group]) {
  if (only && fixture.id !== only) continue;
  const key = group + ":" + fixture.id + ":" + version;
  if (report.results[key]) {
    console.log("REUSE captured outcome " + key);
    continue;
  }
  if (fixture.reuseExistingEvidence) {
    report.results[key] = {
      reusedBaseline: true,
      source: "Existing genuine two-stage provider evidence; no repeat request",
      at: new Date().toISOString(),
    };
    save();
    console.log("REUSE verified baseline " + fixture.id);
    continue;
  }
  assert.equal(fixture.synthetic, true);
  let bytes;
  if (fixture.path) {
    const filename = fs.realpathSync(fixture.path);
    assert.ok(filename.startsWith(root + path.sep));
    bytes = fs.readFileSync(filename);
    assert.equal(hash(bytes), fixture.sha256);
  } else
    assert.equal(
      hash(Buffer.from(JSON.stringify(fixture.questionnaire))),
      fixture.sha256,
    );
  const feature =
    group === "scoresheets"
      ? "evaluation_scoresheet"
      : group === "questionnaires"
        ? "evaluation_placement"
        : "synthetic_document_screening";
  const c = await metaBudgetRPC("register_case", {
    ...context,
    feature,
    case_key: fixtureSetSha256 + ":" + group + ":" + fixture.id,
    input_digest: fixture.sha256,
    label: group + " · " + fixture.id,
    synthetic: true,
  });
  let receipt;
  try {
    let schema, instructions, input;
    if (group === "scoresheets") {
      schema = extractionSchema;
      instructions =
        scoresheetInstructions +
        (version === "v2"
          ? " Compare explicitly recorded period totals with final scores; preserve visible final values and warn about disagreements. Never reconstruct an illegible final score from other numbers; return null."
          : "");
      input = [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Read this visibly synthetic scoresheet. Extract its visible facts; no expected score or player-stat answers are supplied.",
            },
            {
              type: "input_image",
              image_url:
                "data:" + fixture.mime + ";base64," + bytes.toString("base64"),
              detail: "high",
            },
          ],
        },
      ];
    } else if (group === "questionnaires") {
      schema = placementInterpretation;
      instructions = placementInstructions;
      const q = preseasonQuestionnaire.parse(fixture.questionnaire);
      input = JSON.stringify({
        questionnaire: q,
        deterministic: recommendPlacement(q),
      });
    } else {
      schema = syntheticDocumentAnalysis;
      instructions = syntheticDocumentInstructions;
      input = [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                synthetic: true,
                fictionalRegistration: {
                  name: fixture.expected.registeredName,
                  birthDate: fixture.expected.registeredBirthDate,
                },
              }),
            },
            {
              type: "input_image",
              image_url:
                "data:" + fixture.mime + ";base64," + bytes.toString("base64"),
              detail: "high",
            },
          ],
        },
      ];
    }
    const result = await metaJSON(
      schema,
      instructions,
      input,
      (r) => {
        receipt = r;
      },
      feature,
      { ...context, caseId: c.id },
    );
    const checks = [];
    if (group === "scoresheets") {
      for (const field of ["homeTeam", "awayTeam", "homeScore", "awayScore"])
        checks.push({
          name: field,
          passed: result[field] === fixture.expected[field],
        });
      checks.push({
        name: "explicit-player-stats-and-null-preservation",
        passed:
          JSON.stringify(canonical(result.players)) ===
          JSON.stringify(canonical(fixture.expected.players)),
      });
      if (fixture.expected.warningPolicy === "required")
        checks.push({
          name: "specific-uncertainty-warning",
          passed:
            result.warnings.length > 0 &&
            (fixture.expected.periodSums
              ? /period|total|sum|inconsisten/i
              : /unclear|unread|obscur|illegib|not visible|ambigu/i
            ).test(result.warnings.join(" ")),
        });
    } else if (group === "questionnaires") {
      checks.push({
        name: "relevant-follow-up",
        passed:
          result.clarifyingQuestions.length >=
          fixture.expected.minimumClarifyingQuestions,
      });
      if (fixture.id === "missing-competition-evidence")
        checks.push({
          name: "missing-history-identified",
          passed: /history|previous|prior|evidence|record/i.test(
            JSON.stringify(result),
          ),
        });
      checks.push({
        name: "human-decision-not-fabricated",
        passed: !/(?:is|has been) independently verified|proven fraud/i.test(
          JSON.stringify(result),
        ),
      });
    } else {
      const target = fixture.expected.consistency;
      checks.push({
        name: "registered-field-consistency",
        passed:
          target === "consistent"
            ? result.nameMatch === "match" && result.birthDateMatch === "match"
            : target === "unable_to_assess"
              ? result.status === "unable_to_assess"
              : result.nameMatch === "mismatch" ||
                result.birthDateMatch === "mismatch",
      });
      checks.push({
        name: "authenticity-unverified-human-required",
        passed:
          result.authenticity === "unverified" &&
          result.requiresHumanReview === true,
      });
      if (fixture.expected.knownConstructedAlteration)
        checks.push({
          name: "observable-visual-anomaly-noticed",
          passed: result.observations.some(
            (o) => o.kind === "possible_visual_anomaly",
          ),
        });
      if (target === "consistent")
        checks.push({
          name: "no-false-suspicion-on-benign-case",
          passed:
            result.status === "no_specific_issue" &&
            !result.observations.some(
              (o) =>
                o.kind === "inconsistency" ||
                o.kind === "possible_visual_anomaly",
            ),
        });
    }
    report.results[key] = {
      at: new Date().toISOString(),
      feature,
      caseId: c.id,
      inputDigest: fixture.sha256,
      result,
      receipt,
      checks,
      passed: checks.every((c) => c.passed),
    };
    save();
    console.log(
      "CAPTURED " +
        key +
        " · " +
        checks.filter((c) => c.passed).length +
        "/" +
        checks.length +
        " checks",
    );
  } catch (error) {
    report.results[key] = {
      at: new Date().toISOString(),
      feature,
      caseId: c.id,
      error: String(error.message),
      receipt,
      executionStopped: true,
    };
    save();
    throw error;
  }
}
report.financialSummary = await metaBudgetRPC("summary", {});
report.updatedAt = new Date().toISOString();
save();
console.log(
  "Actual evaluation saved privately; no official result, eligibility decision or publication was performed.",
);
