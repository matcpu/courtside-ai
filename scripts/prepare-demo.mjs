// Reproducible private fixture preparation. No model responses or human approvals are fabricated.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import {
  actor,
  client,
  env,
  origin,
  publicFingerprint,
  assertPrivate,
} from "./lib/readiness.mjs";
assert.equal(env.META_API_ENABLED, "false");
const health = await (await fetch(origin + "/api/health")).json();
assert.equal(health.meta, false);
mkdirSync(".local", { recursive: true });
const baseline = await publicFingerprint();
const manifestPath = ".local/demo-manifest.json";
if (existsSync(manifestPath) && !process.argv.includes("--fresh")) {
  const manifest = JSON.parse(readFileSync(manifestPath));
  const admin = await actor(manifest.accounts.admin);
  await assertPrivate(admin, manifest.operations.league);
  await assertPrivate(admin, manifest.preseason.league);
  assert.deepEqual(await publicFingerprint(), baseline);
  console.log(
    "Existing private demo preserved. Use --fresh for a new isolated rehearsal; credentials/invitations remain only in .local/demo-manifest.json.",
  );
  process.exit(0);
}
const run = randomBytes(5).toString("hex"),
  service = client(env.SUPABASE_SERVICE_ROLE_KEY),
  accounts = {};
for (const role of ["admin", "coach"]) {
  const account = {
    email: `rehearsal-${run}-${role}@courtside.example.invalid`,
    password: randomBytes(30).toString("base64url"),
  };
  const { data, error } = await service.auth.admin.createUser({
    ...account,
    email_confirm: true,
    user_metadata: { synthetic: true, purpose: "private-hackathon-rehearsal" },
  });
  if (error) throw new Error(`Could not prepare synthetic ${role} account`);
  accounts[role] = { ...account, id: data.user.id };
}
const admin = await actor(accounts.admin),
  coach = await actor(accounts.coach);
const operations = (await admin.api("/api/demo", {})).id;
let ops = await assertPrivate(admin, operations);
const core = (who, league, action, payload = {}) =>
  who.api("/api/league", { league, action, payload });
await core(admin, operations, "invite_member", {
  email: accounts.coach.email,
  role: "coach",
});
await core(admin, operations, "assign_coach", {
  team_id: ops.teams.find((t) => t.name === "Eastside Eagles").id,
  email: accounts.coach.email,
});
ops = await assertPrivate(admin, operations);
const home = ops.teams.find((t) => t.name === "Eastside Eagles"),
  away = ops.teams.find((t) => t.name === "Riverside Ravens");
const game = ops.games.find(
  (g) =>
    g.home_team_id === home.id &&
    g.away_team_id === away.id &&
    g.status === "scheduled" &&
    ops.fixtures.some(
      (f) => f.game_id === g.id && +new Date(f.starts_at) < Date.now(),
    ),
);
assert.ok(game);
const bytes = readFileSync("public/demo/scoresheet.png"),
  sha = createHash("sha256").update(bytes).digest("hex"),
  path = `${operations}/${admin.id}/${sha}.png`;
assert.equal(
  (
    await admin.client.storage
      .from("scoresheets")
      .upload(path, bytes, { contentType: "image/png", upsert: false })
  ).error,
  null,
);
const preseason = (
  await core(admin, null, "create_league", {
    name: `COURTSIDE Private Preseason ${run}`,
    season: "Upcoming synthetic season",
    cutoff: "2026-09-01",
  })
).id;
await assertPrivate(admin, preseason);
const pre = (who, action, payload) =>
  who.api("/api/preseason", { league: preseason, action, payload });
await pre(admin, "configure", {
  enabled: true,
  season_name: "Upcoming synthetic season",
  season_start: "2026-11-07",
  cutoff_date: "2026-09-01",
  registration_status: "open",
  questionnaire_deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
  roster_deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
  verification_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  min_roster: 1,
  max_roster: 12,
  document_retention_days: 14,
  allowed_document_types: ["birth_certificate", "passport"],
});
await core(admin, preseason, "invite_member", {
  email: accounts.coach.email,
  role: "coach",
});
const questionnaire = {
  ageCategory: "U14",
  previousLeague: "New synthetic community team",
  previousDivision: "No prior division",
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
    "Synthetic contradictory assessment: many returning competitive players, but a new team and no recorded previous games. Ask what evidence supports the preference.",
};
const submitted = await pre(coach, "save_questionnaire", {
  team_id: null,
  name: "Fictional Uncertain Comets",
  data: questionnaire,
  submit: false,
});
await pre(coach, "save_questionnaire", {
  team_id: submitted.team_id,
  name: "Fictional Uncertain Comets",
  data: questionnaire,
  submit: true,
});
const player = (
  await core(coach, preseason, "add_player", {
    team_id: submitted.team_id,
    display_name: "Fictional Demo Player",
    jersey: "7",
    birth_date: "2013-02-03",
    guardian_consent: false,
  })
).id;
await pre(coach, "submit_roster", { team_id: submitted.team_id });
const invitation = await pre(coach, "invite_guardian", {
  player_id: player,
  email: "guardian@example.invalid",
  send_email: false,
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 480 } });
  await page.setContent(
    '<body style="font:24px Arial;padding:35px;border:12px solid #a00"><h1>SYNTHETIC TEST RECORD</h1><p>NOT A REAL ID · NOT VALID PROOF</p><p>Fictional Demo Player</p><p>Declared DOB: 2013-02-03</p><p>Controlled hackathon demonstration only.</p></body>',
  );
  await page.screenshot({ path: ".local/demo-guardian-proof.png" });
} finally {
  await browser.close();
}
const ready = await admin.api(`/api/preseason?league=${preseason}`);
assert.equal(
  ready.readiness.find((r) => r.team_id === submitted.team_id)
    .eligible_for_scheduling,
  false,
);
const manifest = {
  schemaVersion: 1,
  run,
  origin,
  synthetic: true,
  createdAt: new Date().toISOString(),
  accounts,
  publicReference: baseline,
  operations: {
    league: operations,
    game: game.id,
    home: home.id,
    away: away.id,
    path,
    sha,
    legacySeed: true,
  },
  preseason: {
    league: preseason,
    team: submitted.team_id,
    player,
    questionnaire,
    invitationUrl: invitation.invitationUrl,
    expiresAt: invitation.expires_at,
    proof: ".local/demo-guardian-proof.png",
  },
  meta: { enabled: false, actualResponses: 0 },
  humanApprovalsPerformed: false,
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
assert.deepEqual(
  await publicFingerprint(),
  baseline,
  "Public reference data changed during rehearsal preparation",
);
console.log(
  "Prepared private upcoming-season and historical-operations fixtures. Questionnaire, private image and guardian invitation are ready. No approval/model output fabricated. Public reference fingerprint unchanged. Private manifest: .local/demo-manifest.json",
);
