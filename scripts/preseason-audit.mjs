import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
if (
  !["http://127.0.0.1:3000", "https://courtside-ai-one.vercel.app"].includes(
    origin,
  )
)
  throw new Error("Unexpected audit origin");
const env = parse(readFileSync(".env.local")),
  state = JSON.parse(readFileSync(".local/live-audit.json", "utf8"));
assert.equal(env.META_API_ENABLED, "false");
mkdirSync(".local", { recursive: true });
const report = {
    origin,
    checks: [],
    startedAt: new Date().toISOString(),
    synthetic: true,
  },
  tokens = {},
  clients = {};
const reportPath = `.local/preseason-report-${origin.startsWith("https:") ? "production" : "local"}.json`;
async function step(name, fn) {
  try {
    await fn();
    report.checks.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message });
    throw e;
  } finally {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}
async function request(
  role,
  path,
  { method = "POST", data, status = 200, cookie, cron = false } = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(role ? { Authorization: "Bearer " + tokens[role] } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(cron ? { Authorization: "Bearer " + env.CRON_SECRET } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(55000),
  });
  const value = await response.json();
  assert.equal(
    response.status,
    status,
    `${path}: ${value.error ?? "unexpected status"}`,
  );
  return { value, response };
}
await step(
  "Meta inference remains off and the live database is available",
  async () => {
    const { value } = await request(null, "/api/health", { method: "GET" });
    assert.equal(value.meta, false);
    assert.equal(value.database, true);
  },
);
for (const role of ["admin", "coach", "outsider"]) {
  const c = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
    signed = await c.auth.signInWithPassword(state.accounts[role]);
  assert.equal(signed.error, null);
  tokens[role] = signed.data.session.access_token;
  clients[role] = c;
}
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const created = (
  await request("admin", "/api/league", {
    data: {
      league: null,
      action: "create_league",
      payload: {
        name: "Synthetic Preseason Journey " + Date.now(),
        season: "Preseason 2026",
        cutoff: "2026-09-01",
      },
    },
  })
).value;
const league = created.id;
const command = async (role, action, payload = {}) =>
  (await request(role, "/api/preseason", { data: { league, action, payload } }))
    .value;
const core = async (role, action, payload = {}) =>
  (await request(role, "/api/league", { data: { league, action, payload } }))
    .value;
const snapshot = async (role = "admin") =>
  (await request(role, `/api/preseason?league=${league}`, { method: "GET" }))
    .value;
const settings = {
  enabled: true,
  season_name: "Preseason 2026",
  season_start: "2026-11-07",
  cutoff_date: "2026-09-01",
  registration_status: "open",
  questionnaire_deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
  roster_deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
  verification_deadline: new Date(Date.now() + 4 * 86400000).toISOString(),
  min_roster: 1,
  max_roster: 12,
  document_retention_days: 14,
  allowed_document_types: ["birth_certificate", "passport"],
};
await step("Administrator configures rules and invites coach", async () => {
  await command("admin", "configure", settings);
  await core("admin", "invite_member", {
    email: state.accounts.coach.email,
    role: "coach",
  });
  assert.equal((await snapshot()).settings.min_roster, 1);
});
await step(
  "Coach and outsider cannot configure or read another league",
  async () => {
    await request("coach", "/api/preseason", {
      data: { league, action: "configure", payload: settings },
      status: 403,
    });
    await request("outsider", `/api/preseason?league=${league}`, {
      method: "GET",
      status: 403,
    });
  },
);
const answer = {
  ageCategory: "U14",
  previousLeague: "Synthetic Community League",
  previousDivision: "Competitive",
  wins: 8,
  losses: 4,
  draws: 0,
  winningMargin: 12,
  losingMargin: 8,
  returningPercent: 70,
  competitivePlayers: 5,
  experience: 3,
  yearsTogether: 2,
  practicesPerWeek: 2,
  preferredTier: 3,
  coachConfidence: 80,
  notes: "Fictional preseason assessment; no child identities.",
};
const teams = [];
for (const label of ["A", "B"])
  await step(
    `Coach saves, resumes and submits comprehensive assessment ${label}`,
    async () => {
      const draft = await command("coach", "save_questionnaire", {
        team_id: null,
        name: `Fictional Preseason ${label}`,
        data: { ageCategory: "U14", experience: 3 },
        submit: false,
      });
      const team = draft.team_id;
      assert.equal(
        (await snapshot("coach")).questionnaires.find((q) => q.team_id === team)
          .status,
        "draft",
      );
      const submitted = await command("coach", "save_questionnaire", {
        team_id: team,
        name: `Fictional Preseason ${label}`,
        data: answer,
        submit: true,
      });
      assert.equal(submitted.recommendation.tier, 1);
      assert.ok(submitted.recommendation.flags.length);
      await request("coach", "/api/league", {
        data: { league, action: "approve_team", payload: { team_id: team } },
        status: 403,
      });
      await request("admin", "/api/league", {
        data: {
          league,
          action: "approve_team",
          payload: { team_id: team, tier: 2 },
        },
        status: 400,
      });
      await core("admin", "approve_team", {
        team_id: team,
        tier: 2,
        override_reason:
          "Synthetic prior league context reviewed by administrator",
      });
      teams.push(team);
    },
  );
await step(
  "Disabled placement interpretation returns paused without model output",
  async () => {
    await request("coach", "/api/placement", {
      data: { league, team_id: teams[0] },
      status: 503,
    });
    assert.equal((await snapshot()).questionnaires[0].meta_analysis, null);
  },
);
const players = [];
for (let i = 0; i < 2; i++) {
  const player = await core("coach", "add_player", {
    team_id: teams[i],
    display_name: `Fictional ${i ? "B" : "A"} Player`,
    jersey: String(i + 1),
    birth_date: "2013-02-03",
    guardian_consent: true,
  });
  players.push(player.id);
  await command("coach", "submit_roster", { team_id: teams[i] });
}
await step(
  "Coach consent shortcut and unready scheduling are blocked",
  async () => {
    assert.ok((await snapshot()).players.every((p) => !p.guardian_consent));
    await request("admin", "/api/schedule", {
      data: { league, round: 0, useMeta: false },
      status: 400,
    });
    await request("admin", "/api/league", {
      data: {
        league,
        action: "verify_player",
        payload: { player_id: players[0] },
      },
      status: 400,
    });
  },
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const pngs = [];
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 480 } });
  for (const label of ["A", "B", "C"]) {
    await page.setContent(
      `<html><body style="font:24px Arial;padding:35px;border:12px solid #a00"><h1>SYNTHETIC TEST RECORD</h1><p>NOT A REAL ID · NOT VALID PROOF</p><p>Fictional ${label} Player</p><p>Declared DOB: ${label === "C" ? "2010-02-03" : "2013-02-03"}</p><p>Fixture for controlled software verification only.</p></body></html>`,
    );
    const bytes = await page.screenshot();
    pngs.push(bytes);
    writeFileSync(`.local/preseason-proof-${label.toLowerCase()}.png`, bytes);
  }
} finally {
  await browser.close();
}
async function guardian(player) {
  const invite = await command("coach", "invite_guardian", {
    player_id: player,
    email: "guardian@example.invalid",
    send_email: false,
  });
  assert.equal(invite.emailState, "not_requested");
  const token = new URLSearchParams(
    new URL(invite.invitationUrl).hash.slice(1),
  ).get("invite");
  const exchanged = await request(null, "/api/guardian", {
    data: { action: "exchange", payload: { token } },
  });
  return {
    invitation_id: exchanged.value.invitation_id,
    cookie: exchanged.response.headers.get("set-cookie").split(";")[0],
    token,
  };
}
async function submitProof(
  parent,
  bytes,
  { consent = true, expectedStatus = consent ? 200 : 400 } = {},
) {
  const reserved = (
    await request(null, "/api/guardian", {
      cookie: parent.cookie,
      data: {
        action: "reserve_upload",
        payload: {
          invitation_id: parent.invitation_id,
          document_type: "birth_certificate",
          mime: "image/png",
        },
      },
    })
  ).value;
  const uploaded = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
    .storage.from("youth-documents")
    .uploadToSignedUrl(reserved.path, reserved.uploadToken, bytes, {
      contentType: "image/png",
      cacheControl: "0",
    });
  assert.equal(uploaded.error, null, "Actual signed upload must succeed");
  const submitted = await request(null, "/api/guardian", {
    cookie: parent.cookie,
    data: {
      action: "submit",
      payload: {
        invitation_id: parent.invitation_id,
        document_id: reserved.document_id,
        guardian_name: "Fictional Guardian",
        relationship: "parent",
        confirmed_details: true,
        consent,
      },
    },
    status: expectedStatus,
  });
  return { ...reserved, result: submitted.value };
}
let parentA, parentB, docA, docB;
await step("Malformed image bytes never enter document review", async () => {
  parentA = await guardian(players[0]);
  await submitProof(parentA, Buffer.from("not an image"), {
    expectedStatus: 400,
  });
  assert.equal(
    (
      await request(null, "/api/guardian", {
        method: "GET",
        cookie: parentA.cookie,
      })
    ).value.status,
    "invited",
  );
});
await step("Cross-origin guardian mutations are rejected", async () => {
  const response = await fetch(origin + "/api/guardian", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://invalid.example",
      Cookie: parentA.cookie,
    },
    body: JSON.stringify({
      action: "withdraw_consent",
      payload: { invitation_id: parentA.invitation_id },
    }),
  });
  assert.equal(response.status, 403);
});
await step(
  "Guardian securely opens one-player invitation and uploads genuine bytes",
  async () => {
    docA = await submitProof(parentA, pngs[0]);
    const status = (
      await request(null, "/api/guardian", {
        method: "GET",
        cookie: parentA.cookie,
      })
    ).value;
    assert.equal(status.status, "pending");
    assert.equal(status.child.name, "Fictional A Player");
    assert.ok(!JSON.stringify(status).includes("storage_path"));
    const screening = (
      await request(
        "admin",
        `/api/document-screening?league=${league}&document=${docA.document_id}`,
        { method: "GET" },
      )
    ).value;
    assert.equal(screening.authenticity, "unverified");
    assert.equal(screening.humanReviewRequired, true);
    assert.equal(screening.ageEligible, true);
    assert.equal(screening.checks.name, "match");
    assert.equal(screening.checks.birthDate, "match");
    assert.ok(!JSON.stringify(screening).includes("perceptualHash"));
  },
);
await step(
  "Private proof is unreadable to coach, outsider and public",
  async () => {
    const coachSnapshot = await snapshot("coach");
    assert.deepEqual(coachSnapshot.documents, []);
    assert.ok(!JSON.stringify(coachSnapshot).includes("guardian_name"));
    for (const role of ["coach", "outsider", null])
      await request(
        role,
        `/api/document-screening?league=${league}&document=${docA.document_id}`,
        { method: "GET", status: role ? 403 : 401 },
      );
    const forged = await clients.coach.rpc("finalize_age_upload", {
      p_hash: "not-a-capability",
      p_document: docA.document_id,
      p_payload: { screening: { status: "no_specific_issue" } },
    });
    assert.ok(forged.error, "Browser clients cannot forge screening outputs");
    assert.equal(
      (await snapshot()).documents.find((d) => d.id === docA.document_id)
        .guardian_name,
      "Fictional Guardian",
    );
    for (const client of [clients.coach, clients.outsider]) {
      const r = await client.storage
        .from("youth-documents")
        .download(docA.path);
      assert.ok(r.error && !r.data);
    }
    const response = await fetch(
      env.NEXT_PUBLIC_SUPABASE_URL +
        "/storage/v1/object/public/youth-documents/" +
        docA.path,
    );
    assert.ok(!response.ok);
    await request("coach", "/api/preseason", {
      data: {
        league,
        action: "open_document",
        payload: { document_id: docA.document_id },
      },
      status: 403,
    });
  },
);
await step(
  "Reviewer inspects original and requests genuine resubmission",
  async () => {
    const opened = await command("admin", "open_document", {
      document_id: docA.document_id,
    });
    assert.ok((await fetch(opened.url)).ok);
    await command("admin", "review_document", {
      document_id: docA.document_id,
      decision: "resubmission",
      reason: "Synthetic proof needs a complete, uncropped copy",
      document_checked: false,
      duplicate_acknowledged: false,
    });
    assert.equal(
      (
        await request(null, "/api/guardian", {
          method: "GET",
          cookie: parentA.cookie,
        })
      ).value.status,
      "resubmission",
    );
  },
);
await step(
  "Guardian resubmission requires a new file and is approved by administrator",
  async () => {
    const previous = docA;
    docA = await submitProof(parentA, pngs[0]);
    assert.notEqual(docA.document_id, previous.document_id);
    await request("admin", "/api/preseason", {
      data: {
        league,
        action: "review_document",
        payload: {
          document_id: previous.document_id,
          decision: "approved",
          reason: "Attempt to approve stale superseded proof",
          document_checked: true,
          duplicate_acknowledged: true,
        },
      },
      status: 400,
    });
    await command("admin", "open_document", { document_id: docA.document_id });
    await command("admin", "review_document", {
      document_id: docA.document_id,
      decision: "approved",
      reason: "Synthetic name and date match inspected proof; consent recorded",
      document_checked: true,
      duplicate_acknowledged: false,
    });
  },
);
await step(
  "Duplicate proof is flagged and requires investigation",
  async () => {
    parentB = await guardian(players[1]);
    await request(null, "/api/guardian", {
      cookie: parentA.cookie,
      data: {
        action: "reserve_upload",
        payload: {
          invitation_id: parentB.invitation_id,
          document_type: "birth_certificate",
          mime: "image/png",
        },
      },
      status: 403,
    });
    docB = await submitProof(parentB, pngs[0]);
    const screening = (
      await request(
        "admin",
        `/api/document-screening?league=${league}&document=${docB.document_id}`,
        { method: "GET" },
      )
    ).value;
    assert.ok(screening.exactDuplicates >= 1);
    assert.equal(screening.status, "review_required");
    await request("admin", "/api/document-screening", {
      data: {
        league,
        document: docB.document_id,
        reason:
          "Exact reuse across fictional players requires another authorized human review",
      },
    });
    assert.equal(
      (await snapshot()).players.find((p) => p.id === players[1])
        .verification_status,
      "pending",
    );
    assert.ok(
      (await snapshot()).reviews.some(
        (r) => r.document_id === docB.document_id && r.decision === "escalated",
      ),
    );
    const s = await snapshot();
    assert.ok(
      s.documents.find((d) => d.id === docB.document_id).duplicate_document,
    );
    await command("admin", "open_document", { document_id: docB.document_id });
    await request("admin", "/api/preseason", {
      data: {
        league,
        action: "review_document",
        payload: {
          document_id: docB.document_id,
          decision: "approved",
          reason: "Duplicate must be investigated; no silent approval",
          document_checked: true,
          duplicate_acknowledged: false,
        },
      },
      status: 400,
    });
    await command("admin", "review_document", {
      document_id: docB.document_id,
      decision: "resubmission",
      reason:
        "Proof names another fictional player; upload matching synthetic proof",
      document_checked: true,
      duplicate_acknowledged: false,
    });
    docB = await submitProof(parentB, pngs[1]);
    await command("admin", "open_document", { document_id: docB.document_id });
    await command("admin", "review_document", {
      document_id: docB.document_id,
      decision: "approved",
      reason: "Correct synthetic proof inspected; name and date match",
      document_checked: true,
      duplicate_acknowledged: false,
    });
  },
);
await step(
  "Over-age child cannot be approved, even by an administrator",
  async () => {
    const p = await core("coach", "add_player", {
      team_id: teams[0],
      display_name: "Fictional C Player",
      jersey: "3",
      birth_date: "2010-02-03",
      guardian_consent: false,
    });
    const parent = await guardian(p.id),
      doc = await submitProof(parent, pngs[2]);
    await command("admin", "open_document", { document_id: doc.document_id });
    await request("admin", "/api/preseason", {
      data: {
        league,
        action: "review_document",
        payload: {
          document_id: doc.document_id,
          decision: "approved",
          reason: "An administrator cannot override a failed age rule",
          document_checked: true,
          duplicate_acknowledged: false,
        },
      },
      status: 400,
    });
    await command("coach", "withdraw_player", { player_id: p.id });
    await request(null, "/api/guardian", {
      method: "GET",
      cookie: parent.cookie,
      status: 403,
    });
    await command("coach", "submit_roster", { team_id: teams[0] });
  },
);
await step("Expired invitation and forged consent are rejected", async () => {
  const p = await core("coach", "add_player", {
    team_id: teams[1],
    display_name: "Fictional Expiry Player",
    jersey: "4",
    birth_date: "2013-02-03",
    guardian_consent: false,
  });
  const parent = await guardian(p.id);
  await submitProof(parent, pngs[1], { consent: false });
  const expired = await service
    .from("guardian_invitations")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", parent.invitation_id);
  assert.equal(expired.error, null);
  await request(null, "/api/guardian", {
    method: "GET",
    cookie: parent.cookie,
    status: 403,
  });
  await command("coach", "withdraw_player", { player_id: p.id });
  await command("coach", "submit_roster", { team_id: teams[1] });
});
let published;
await step(
  "Verified readiness connects to opening-weekend scheduling",
  async () => {
    assert.ok(
      (await snapshot()).readiness.every((r) => r.eligible_for_scheduling),
    );
    const court = await core("admin", "add_court", {
      name: "Fictional Opening Court",
      venue: "Synthetic Gym",
    });
    await core("admin", "add_availability", {
      court_id: court.id,
      starts_at: "2026-11-07T14:00:00Z",
      ends_at: "2026-11-07T22:00:00Z",
    });
    const draft = (
      await request("admin", "/api/schedule", {
        data: { league, round: 0, useMeta: false },
      })
    ).value;
    published = draft.id;
    await core("admin", "publish_schedule", { version_id: draft.id });
    const s = (
      await request("admin", `/api/league?id=${league}`, { method: "GET" })
    ).value;
    assert.ok(
      s.fixtures.every(
        (f) => +new Date(f.starts_at) >= +new Date("2026-11-07T05:00:00Z"),
      ),
    );
    assert.equal(
      s.versions.find((v) => v.id === published).status,
      "published",
    );
  },
);
await step(
  "Consent withdrawal invalidates readiness and unpublished drafts",
  async () => {
    const draft = (
      await request("admin", "/api/schedule", {
        data: { league, round: 1, useMeta: false },
      })
    ).value;
    await request(null, "/api/guardian", {
      cookie: parentA.cookie,
      data: {
        action: "withdraw_consent",
        payload: { invitation_id: parentA.invitation_id },
      },
    });
    assert.equal(
      (await snapshot()).readiness.find((r) => r.team_id === teams[0])
        .eligible_for_scheduling,
      false,
    );
    await request("admin", "/api/league", {
      data: {
        league,
        action: "publish_schedule",
        payload: { version_id: draft.id },
      },
      status: 400,
    });
  },
);
await step(
  "Manual deletion removes actual bytes and preserves review history",
  async () => {
    await command("admin", "delete_document", {
      document_id: docB.document_id,
    });
    const removed = await service.storage
      .from("youth-documents")
      .download(docB.path, { cacheNonce: String(Date.now()) });
    assert.ok(removed.error && !removed.data);
    const s = await snapshot();
    assert.equal(
      s.documents.find((d) => d.id === docB.document_id).status,
      "deleted",
    );
    assert.equal(
      s.documents.find((d) => d.id === docB.document_id).guardian_name,
      null,
    );
    const derived = await service
      .from("age_documents")
      .select("screening,visual_hash,sha256")
      .eq("id", docB.document_id)
      .single();
    assert.equal(derived.error, null);
    assert.deepEqual(derived.data, {
      screening: null,
      visual_hash: null,
      sha256: null,
    });
    await request(
      "admin",
      `/api/document-screening?league=${league}&document=${docB.document_id}`,
      { method: "GET", status: 403 },
    );
    assert.ok(
      s.reviews.some(
        (r) => r.document_id === docB.document_id && r.decision === "approved",
      ),
    );
  },
);
await step(
  "Retention worker deletes expired stored proofs with durable receipts",
  async () => {
    const changed = await service
      .from("age_documents")
      .update({ retain_until: new Date(Date.now() - 1000).toISOString() })
      .eq("id", docA.document_id);
    assert.equal(changed.error, null);
    await request(null, "/api/retention", { method: "GET", status: 401 });
    const swept = (
      await request(null, "/api/retention", { method: "GET", cron: true })
    ).value;
    assert.ok(swept.deleted >= 1);
    const removed = await service.storage
      .from("youth-documents")
      .download(docA.path, { cacheNonce: String(Date.now()) });
    assert.ok(removed.error && !removed.data);
  },
);
await step(
  "AI activity is honest, private and empty while disabled",
  async () => {
    const s = (
      await request("admin", `/api/evidence?league=${league}`, {
        method: "GET",
      })
    ).value;
    assert.equal(s.enabled, false);
    assert.deepEqual(s.evidence, []);
    await request("coach", `/api/evidence?league=${league}`, {
      method: "GET",
      status: 403,
    });
    await request("admin", "/api/agent", {
      data: {
        league,
        objective: "Inspect readiness and prepare an opening-weekend schedule",
      },
      status: 503,
    });
  },
);
report.finishedAt = new Date().toISOString();
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(
  `Preseason audit completed: ${report.checks.length} actual integration checks passed.`,
);
