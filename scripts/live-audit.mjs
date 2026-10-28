import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const origin =
  process.env.E2E_BASE_URL || "https://courtside-ai-one.vercel.app";
if (
  !["https://courtside-ai-one.vercel.app", "http://127.0.0.1:3000"].includes(
    origin,
  )
)
  throw new Error("Unexpected audit origin");
const env = parse(readFileSync(".env.local"));
const state = JSON.parse(readFileSync(".local/live-audit.json", "utf8"));
const report = {
  origin,
  startedAt: new Date().toISOString(),
  mode: "real Supabase Auth + deployed API, synthetic data, Meta disabled",
  checks: [],
};
const clients = {},
  tokens = {};
async function step(name, run) {
  try {
    const detail = await run();
    report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) });
    console.log("PASS " + name);
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message });
    console.error("FAIL " + name + ": " + e.message);
    throw e;
  } finally {
    writeFileSync(
      ".local/live-audit-report.json",
      JSON.stringify(report, null, 2),
    );
  }
}
async function request(
  role,
  path,
  { method = "GET", data, status = 200 } = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: "Bearer " + tokens[role] } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const value = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path.split("?")[0]} returned ${response.status}: ${value.error ?? "unexpected response"}`,
  );
  return value;
}
const command = (role, action, payload = {}) =>
  request(role, "/api/league", {
    method: "POST",
    data: { league: state.league, action, payload },
  });
const snapshot = (role = "admin") =>
  request(role, `/api/league?id=${state.league}`);
await step("Meta remains disabled on live deployment", async () => {
  const h = await request(null, "/api/health");
  assert.equal(h.meta, false);
  assert.equal(h.metaEnabled, false);
  assert.equal(h.database, true);
});
for (const role of ["admin", "coach", "outsider"])
  await step(`Real ${role} password sign-in and issued token`, async () => {
    const c = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await c.auth.signInWithPassword(
      state.accounts[role],
    );
    assert.equal(error, null, "Supabase rejected the synthetic credentials");
    assert.ok(data.session?.access_token);
    tokens[role] = data.session.access_token;
    clients[role] = c;
  });
if (!state.league)
  await step(
    "Create isolated private reference season through deployed API",
    async () => {
      const d = await request("admin", "/api/demo", {
        method: "POST",
        data: {},
      });
      state.league = d.id;
      writeFileSync(".local/live-audit.json", JSON.stringify(state, null, 2));
      assert.equal((await snapshot()).teams.length, 12);
    },
  );
await step("Invite an existing account as a coach", () =>
  command("admin", "invite_member", {
    email: state.accounts.coach.email,
    role: "coach",
  }),
);
await step(
  "Coach registration and deterministic placement without AI",
  async () => {
    let s = await snapshot("coach");
    let team = s.teams.find((t) => t.name === "Audit Comets");
    if (!team) {
      const r = await request("coach", "/api/register", {
        method: "POST",
        data: {
          league: state.league,
          name: "Audit Comets",
          assessment: {
            experience: 3,
            yearsTogether: 2,
            practicesPerWeek: 2,
            notes: "Fictional audit team",
          },
          phone: "",
          sms_consent: false,
        },
      });
      assert.equal(r.ai, false);
      state.team = r.id;
    } else state.team = team.id;
    writeFileSync(".local/live-audit.json", JSON.stringify(state, null, 2));
    const registered = (await snapshot()).teams.find(
      (t) => t.id === state.team,
    );
    assert.equal(registered.initial_rating, 1105);
  },
);
await step("Coach cannot approve placement or publish", async () => {
  await request("coach", "/api/league", {
    method: "POST",
    data: {
      league: state.league,
      action: "approve_team",
      payload: { team_id: state.team },
    },
    status: 403,
  });
  await request("coach", "/api/schedule", {
    method: "POST",
    data: { league: state.league, round: 0 },
    status: 403,
  });
});
await step("Administrator approves actual registration", async () => {
  const s = await snapshot();
  if (s.teams.find((t) => t.id === state.team)?.status === "pending")
    await command("admin", "approve_team", { team_id: state.team });
  assert.equal(
    (await snapshot()).teams.find((t) => t.id === state.team).status,
    "approved",
  );
});
await step(
  "Coach adds private roster; administrator verifies declared age and consent",
  async () => {
    let s = await snapshot("coach");
    let player = s.players.find(
      (p) => p.jersey === "17" && p.team_id === state.team,
    );
    if (!player) {
      const r = await command("coach", "add_player", {
        team_id: state.team,
        display_name: "Fictional Comet Player",
        jersey: "17",
        birth_date: "2013-02-03",
        guardian_consent: true,
      });
      state.player = r.id;
    } else state.player = player.id;
    await command("admin", "verify_player", { player_id: state.player });
    assert.equal(
      (await snapshot()).players.find((p) => p.id === state.player)
        .eligibility_status,
      "verified",
    );
  },
);
await step("Tenant and roster privacy against real JWTs", async () => {
  await request("outsider", `/api/league?id=${state.league}`, { status: 403 });
  const { data, error } = await clients.outsider
    .from("teams")
    .select("id")
    .eq("league_id", state.league);
  assert.equal(error, null);
  assert.equal(data.length, 0);
  const s = await snapshot("coach");
  assert.ok(
    s.teams
      .filter((t) => t.coach_id !== state.accounts.coach.id)
      .every((t) => !t.coach_email),
  );
});
let s = await snapshot();
const home = s.teams.find((t) => t.name === "Eastside Eagles"),
  away = s.teams.find((t) => t.name === "Riverside Ravens");
const game = s.games.find(
  (g) =>
    g.home_team_id === home.id &&
    g.away_team_id === away.id &&
    g.status === "scheduled" &&
    s.fixtures.some(
      (f) => f.game_id === g.id && +new Date(f.starts_at) < Date.now(),
    ),
);
const existing = s.scoresheets.find(
  (sh) =>
    sh.sha256 ===
    createHash("sha256")
      .update(readFileSync("public/demo/scoresheet.png"))
      .digest("hex"),
);
let sheet = existing;
if (!sheet)
  await step(
    "Real private PNG upload, download and manual submission",
    async () => {
      assert.ok(game, "Past unconfirmed synthetic fixture is required");
      const bytes = readFileSync("public/demo/scoresheet.png"),
        hash = createHash("sha256").update(bytes).digest("hex"),
        path = `${state.league}/${state.accounts.admin.id}/${hash}.png`;
      const uploaded = await clients.admin.storage
        .from("scoresheets")
        .upload(path, bytes, { contentType: "image/png", upsert: false });
      assert.ok(
        !uploaded.error || /already exists/i.test(uploaded.error.message),
        "Private storage upload failed",
      );
      const extraction = {
        homeTeam: home.name,
        awayTeam: away.name,
        homeScore: 78,
        awayScore: 43,
        confidence: 1,
        warnings: ["Manual review; no AI used"],
        players: [],
      };
      const saved = await request("admin", "/api/scoresheet", {
        method: "POST",
        data: {
          league: state.league,
          game_id: game.id,
          path,
          mode: "manual",
          extraction,
        },
      });
      sheet = (await snapshot()).scoresheets.find((sh) => sh.id === saved.id);
      assert.equal(saved.official, false);
      state.sheet = sheet.id;
      state.game = game.id;
      writeFileSync(".local/live-audit.json", JSON.stringify(state, null, 2));
    },
  );
else {
  state.sheet = sheet.id;
  state.game = sheet.game_id;
}
await step(
  "Original photo is private and cannot be read by outsider",
  async () => {
    const { data, error } = await clients.outsider.storage
      .from("scoresheets")
      .download(sheet.storage_path);
    assert.ok(error && !data);
    const { data: signed, error: signError } = await clients.admin.storage
      .from("scoresheets")
      .createSignedUrl(sheet.storage_path, 60);
    assert.equal(signError, null);
    assert.ok((await fetch(signed.signedUrl)).ok);
  },
);
await step("Duplicate actual image rejected", () =>
  request("admin", "/api/scoresheet", {
    method: "POST",
    data: {
      league: state.league,
      game_id: sheet.game_id,
      path: sheet.storage_path,
      mode: "manual",
      extraction: sheet.extraction,
    },
    status: 409,
  }),
);
await step("Coach cannot confirm official results", () =>
  request("coach", "/api/scoresheet", {
    method: "PATCH",
    data: {
      league: state.league,
      sheet_id: sheet.id,
      reviewed: true,
      extraction: sheet.extraction,
    },
    status: 403,
  }),
);
await step("Human confirmation updates official score and rating", async () => {
  const before = await snapshot();
  if (sheet.status === "review")
    await request("admin", "/api/scoresheet", {
      method: "PATCH",
      data: {
        league: state.league,
        sheet_id: sheet.id,
        reviewed: true,
        extraction: sheet.extraction,
      },
    });
  const after = await snapshot(),
    g = after.games.find((g) => g.id === sheet.game_id);
  assert.equal(g.status, "confirmed");
  assert.equal(g.home_score, 78);
  assert.ok(
    after.teams.find((t) => t.id === home.id).rating >=
      before.teams.find((t) => t.id === home.id).rating,
  );
});
await step(
  "Evaluate verified mismatches and approve a one-tier adjustment",
  async () => {
    let current = await snapshot();
    if (
      current.divisions.find(
        (d) => d.id === current.teams.find((t) => t.id === home.id).division_id,
      ).tier > 1
    ) {
      await command("admin", "propose_balance");
      current = await snapshot();
      const proposal = current.proposals.find(
        (p) => p.team_id === home.id && p.status === "pending",
      );
      assert.ok(proposal, "Verified mismatch should yield a proposal");
      await command("admin", "decide_proposal", {
        proposal_id: proposal.id,
        approve: true,
      });
    }
    const after = await snapshot();
    assert.equal(
      after.divisions.find(
        (d) => d.id === after.teams.find((t) => t.id === home.id).division_id,
      ).tier,
      1,
    );
  },
);
await step(
  "Generate a real conflict-checked revised schedule and reject a draft",
  async () => {
    const before = await snapshot();
    const d = await request("admin", "/api/schedule", {
      method: "POST",
      data: { league: state.league, round: 1, useMeta: false },
    });
    assert.equal(d.ai, false);
    await command("admin", "reject_schedule", { version_id: d.id });
    assert.equal((await snapshot()).league.revision, before.league.revision);
  },
);
await step(
  "Approve and publish regenerated fixtures; preserve confirmed history",
  async () => {
    const before = await snapshot();
    const d = await request("admin", "/api/schedule", {
      method: "POST",
      data: { league: state.league, round: 1, useMeta: false },
    });
    await command("admin", "publish_schedule", { version_id: d.id });
    const after = await snapshot();
    assert.equal(after.league.revision, before.league.revision + 1);
    const published = after.fixtures.filter((f) => f.version_id === d.id);
    assert.ok(published.some((f) => f.game_id === sheet.game_id));
    for (const f of published) {
      const g = after.games.find((g) => g.id === f.game_id);
      if (g.status !== "confirmed")
        assert.equal(
          after.teams.find((t) => t.id === g.home_team_id).division_id,
          after.teams.find((t) => t.id === g.away_team_id).division_id,
        );
    }
    assert.ok(after.notifications.length > 0);
  },
);
await step(
  "Unconfigured external delivery reports blocked, never simulated success",
  () =>
    request("admin", "/api/notifications", {
      method: "POST",
      data: { league: state.league },
      status: 503,
    }),
);
await step(
  "Coach receives real private in-app publication updates",
  async () => {
    const coach = await snapshot("coach");
    assert.ok(coach.notifications.length > 0);
    assert.ok(
      coach.notifications.every(
        (n) =>
          n.channel === "in_app" &&
          n.recipient_id === state.accounts.coach.id &&
          n.team_id === state.team,
      ),
    );
    const unread = coach.notifications.find((n) => !n.read_at);
    assert.ok(unread);
    await command("coach", "mark_notification_read", {
      notification_id: unread.id,
    });
    assert.ok(
      (await snapshot("coach")).notifications.find((n) => n.id === unread.id)
        .read_at,
    );
    const other = (await snapshot()).notifications.find(
      (n) =>
        n.channel === "in_app" && n.recipient_id !== state.accounts.coach.id,
    );
    assert.ok(other);
    await request("coach", "/api/league", {
      method: "POST",
      data: {
        league: state.league,
        action: "mark_notification_read",
        payload: { notification_id: other.id },
      },
      status: 403,
    });
  },
);
await step("Disabled operations agent makes no model request", () =>
  request("admin", "/api/agent", {
    method: "POST",
    data: { league: state.league, objective: "Inspect the synthetic league" },
    status: 503,
  }),
);
await step(
  "Create an ordinary private season from an empty league",
  async () => {
    if (!state.emptyLeague) {
      const created = await request("admin", "/api/league", {
        method: "POST",
        data: {
          league: null,
          action: "create_league",
          payload: {
            name: "Synthetic Foundation League",
            season: "Fall 2026 Audit",
            cutoff: "2026-09-01",
          },
        },
      });
      state.emptyLeague = created.id;
      writeFileSync(".local/live-audit.json", JSON.stringify(state, null, 2));
    }
    const s = await request("admin", `/api/league?id=${state.emptyLeague}`);
    assert.equal(s.league.is_demo, false);
    assert.equal(s.league.season_name, "Fall 2026 Audit");
    assert.equal(s.divisions.length, 3);
  },
);
const foundationCommand = (action, payload = {}) =>
  request("admin", "/api/league", {
    method: "POST",
    data: { league: state.emptyLeague, action, payload },
  });
await step("Onboard and place teams in the ordinary season", async () => {
  await foundationCommand("invite_member", {
    email: state.accounts.coach.email,
    role: "coach",
  });
  for (const name of ["Fictional Foundation A", "Fictional Foundation B"]) {
    let current = await request("admin", `/api/league?id=${state.emptyLeague}`);
    let team = current.teams.find((t) => t.name === name);
    if (!team) {
      const saved = await request("coach", "/api/register", {
        method: "POST",
        data: {
          league: state.emptyLeague,
          name,
          assessment: {
            experience: 3,
            yearsTogether: 2,
            practicesPerWeek: 2,
            notes: "Synthetic test only",
          },
          phone: "",
          sms_consent: false,
        },
      });
      assert.equal(saved.ai, false);
      team = { id: saved.id, status: "pending" };
    }
    if (team.status === "pending")
      await foundationCommand("approve_team", { team_id: team.id });
  }
  const current = await request("coach", `/api/league?id=${state.emptyLeague}`);
  assert.equal(current.teams.filter((t) => t.status === "approved").length, 2);
});
await step(
  "Confirm a real court block and publish an ordinary season's first schedule",
  async () => {
    let current = await request("admin", `/api/league?id=${state.emptyLeague}`);
    if (!current.courts.length)
      await foundationCommand("add_court", {
        name: "Fictional Audit Court",
        venue: "Synthetic Gym",
      });
    current = await request("admin", `/api/league?id=${state.emptyLeague}`);
    if (!current.availability.some((a) => +new Date(a.ends_at) > Date.now())) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 1);
      start.setUTCHours(16, 0, 0, 0);
      await foundationCommand("add_availability", {
        court_id: current.courts[0].id,
        starts_at: start.toISOString(),
        ends_at: new Date(+start + 8 * 3600000).toISOString(),
      });
    }
    const draft = await request("admin", "/api/schedule", {
      method: "POST",
      data: { league: state.emptyLeague, round: 0, useMeta: false },
    });
    await foundationCommand("publish_schedule", { version_id: draft.id });
    const after = await request("coach", `/api/league?id=${state.emptyLeague}`);
    assert.equal(
      after.fixtures.filter((f) => f.version_id === draft.id).length,
      1,
    );
    assert.ok(
      after.notifications.filter((n) => n.channel === "in_app").length >= 2,
    );
  },
);
report.finishedAt = new Date().toISOString();
writeFileSync(".local/live-audit-report.json", JSON.stringify(report, null, 2));
console.log(
  `Live audit completed: ${report.checks.length} real checks passed.`,
);
