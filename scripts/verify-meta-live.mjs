// NEVER run this until the human owner confirms credits and authorizes model use.
// Both an explicit operator flag and enabled server configuration are required.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
if (!process.argv.includes("--credits-confirmed"))
  throw new Error(
    "Owner confirmation of credits is required. No model call was made.",
  );
const env = parse(readFileSync(".env.local"));
if (env.META_API_ENABLED !== "true")
  throw new Error("Meta remains disabled locally. No model call was made.");
const origin = "https://courtside-ai-one.vercel.app";
const health = await (await fetch(origin + "/api/health")).json();
if (!health.meta || !health.metaEnabled)
  throw new Error("Production Meta is disabled. No model call was made.");
const state = JSON.parse(readFileSync(".local/live-audit.json", "utf8")),
  client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const signed = await client.auth.signInWithPassword(state.accounts.outsider);
assert.equal(signed.error, null);
const token = signed.data.session.access_token;
async function api(path, data) {
  const r = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw new Error(`${path}: ${value.error ?? r.status}`);
  return value;
}
const league = (await api("/api/demo", {})).id;
let s = await api(`/api/league?id=${league}`);
const home = s.teams.find((t) => t.name === "Eastside Eagles"),
  away = s.teams.find((t) => t.name === "Riverside Ravens"),
  game = s.games.find(
    (g) =>
      g.home_team_id === home.id &&
      g.away_team_id === away.id &&
      g.status === "scheduled" &&
      s.fixtures.some(
        (f) => f.game_id === g.id && +new Date(f.starts_at) < Date.now(),
      ),
  );
assert.ok(game, "Synthetic reference fixture is required");
const bytes = readFileSync("public/demo/scoresheet.png"),
  sha = createHash("sha256").update(bytes).digest("hex"),
  path = `${league}/${signed.data.user.id}/${sha}.png`;
const upload = await client.storage
  .from("scoresheets")
  .upload(path, bytes, { contentType: "image/png", upsert: false });
assert.equal(upload.error, null);
const recognition = await api("/api/scoresheet", {
  league,
  game_id: game.id,
  path,
  mode: "meta",
});
assert.ok(recognition.evidence?.id, "Actual recognition receipt is required");
assert.equal(recognition.official, false);
const q = {
  ageCategory: "U14",
  previousLeague: "New synthetic team",
  previousDivision: "Unknown",
  wins: 0,
  losses: 0,
  draws: 0,
  winningMargin: 25,
  losingMargin: 10,
  returningPercent: 90,
  competitivePlayers: 8,
  experience: 1,
  yearsTogether: 0,
  practicesPerWeek: 1,
  preferredTier: 1,
  coachConfidence: 100,
  notes:
    "Synthetic contradictory questionnaire for the controlled Meta evaluation.",
};
const team = await api("/api/preseason", {
  league,
  action: "save_questionnaire",
  payload: {
    team_id: null,
    name: "Synthetic Uncertain Placement",
    data: q,
    submit: true,
  },
});
const placement = await api("/api/placement", {
  league,
  team_id: team.team_id,
});
assert.ok(placement.evidence?.id);
assert.ok(
  placement.interpretation.inconsistencies.length ||
    placement.interpretation.clarifyingQuestions.length,
  "The model must surface assessment uncertainty",
);
const before = await api(`/api/league?id=${league}`);
const agent = await api("/api/agent", {
  league,
  objective:
    "Investigate Eastside Eagles using verified game history, inspect preseason readiness without any youth identity data, save a supported competitive adjustment proposal and prepare one feasible next-round draft using CURRENT APPROVED divisions. Explain the saved actions and next human approvals. Do not approve or publish anything.",
});
const names = agent.trace.map((t) => t.tool);
for (const name of [
  "inspect_league",
  "inspect_team_history",
  "propose_balance",
  "draft_schedule",
])
  assert.ok(
    names.includes(name),
    `Actual model tool selection missing ${name}`,
  );
s = await api(`/api/league?id=${league}`);
assert.equal(s.league.revision, before.league.revision);
assert.equal(
  s.teams.find((t) => t.id === home.id).division_id,
  home.division_id,
);
assert.ok(s.proposals.some((p) => p.status === "pending"));
assert.ok(s.versions.some((v) => v.status === "draft"));
assert.equal(s.games.find((g) => g.id === game.id).status, "scheduled");
const evidence = await api(`/api/evidence?league=${league}`);
for (const feature of ["scoresheet", "placement", "operations"])
  assert.ok(
    evidence.evidence.some(
      (e) => e.feature === feature && e.response_id && e.model,
    ),
  );
const report = {
  createdAt: new Date().toISOString(),
  synthetic: true,
  league,
  recognition: {
    id: recognition.id,
    structured: recognition.extraction,
    official: false,
  },
  placement: placement.interpretation,
  agent: { run: agent.run, trace: agent.trace, message: agent.message },
  receipts: evidence.evidence,
  requiresHumanApproval: true,
};
writeFileSync(".local/meta-live-report.json", JSON.stringify(report, null, 2));
console.log(
  "Actual Meta responses, model-selected tools and saved pending actions verified. Private evidence is in the AI activity view and ignored report. No official approval was performed.",
);
