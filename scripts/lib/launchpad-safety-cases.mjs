import assert from "node:assert/strict";
import { newSetup } from "../../src/lib/launchpad.ts";
import { asUser, organizer } from "./local-database.mjs";
export const safetyActor = "ef000000-0000-4000-8000-000000000001";
export const safetyActor2 = "ef000000-0000-4000-8000-000000000002";
export const safetyCases = [
  ["minimum roster", { min_roster: 7 }],
  ["maximum roster", { max_roster: 24 }],
  ["cutoff date", { cutoff_date: "2099-02-01" }],
  ["accepted documents", { allowed_document_types: ["passport"] }],
  ["document retention", { document_retention_days: 7 }],
  ["proof requirement", { proof_required: false, allowed_document_types: [] }],
  ["verification requirement", { enabled: false }],
  [
    "division ages",
    {
      division: {
        age_category: "U14",
        tier: 2,
        min_age: 8,
        max_age: 12,
        name: "U14 · Updated",
      },
    },
  ],
  [
    "age category",
    {
      division: {
        age_category: "U12 Girls",
        tier: 1,
        min_age: 7,
        max_age: 11,
        name: "U12 Girls · Premier",
      },
    },
  ],
];
export async function prepareActors(db) {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'safety-admin@example.invalid',now()),($2,'safety-second-admin@example.invalid',now()) on conflict(id) do nothing",
    [safetyActor, safetyActor2],
  );
}
export const runSafety = (db, action, p, actor = safetyActor) =>
  asUser(db, actor, (tx) => organizer(tx, action, p));
export async function createSafetyFixture(db, suffix) {
  const setup = {
    ...newSetup(),
    allowedDocumentTypes: ["birth_certificate", "passport", "government_id"],
    name: `Synthetic Safety ${suffix}`,
    city: "Toronto",
    season: "Synthetic 2099",
    start: "2099-03-01",
    end: "2099-06-30",
    opening: "2099-03-07",
    cutoff: "2099-01-01",
    registrationDeadline: "2099-02-01",
    rosterDeadline: "2099-02-15",
    verificationDeadline: "2099-02-28",
  };
  const d = await runSafety(db, "save_draft", {
    id: null,
    league_id: null,
    data: setup,
  });
  const { league_id } = await runSafety(db, "finish", {
    id: d.id,
    revision: d.revision,
  });
  await asUser(db, safetyActor, (tx) =>
    tx.query(
      'select public.league_command($1,\'invite_member\',\'{"email":"safety-second-admin@example.invalid","role":"coach"}\'::jsonb)',
      [league_id],
    ),
  );
  // The existing public invitation command cannot grant admin. This synthetic
  // fixture grants a second reviewer using the local database-owner setup only.
  await db.query(
    "update public.memberships set role='admin' where league_id=$1 and user_id=$2",
    [league_id, safetyActor2],
  );
  const team = await asUser(
    db,
    safetyActor,
    async (tx) =>
      (
        await tx.query(
          "select public.preseason_command($1,'save_questionnaire',$2::jsonb) r",
          [
            league_id,
            JSON.stringify({
              team_id: null,
              name: "Fictional Safety Team",
              data: {},
              submit: false,
            }),
          ],
        )
      ).rows[0].r.team_id,
  );
  await asUser(db, safetyActor, (tx) =>
    tx.query("select public.league_command($1,'add_player',$2::jsonb)", [
      league_id,
      JSON.stringify({
        team_id: team,
        display_name: "Fictional Safety Player",
        jersey: "4",
        birth_date: "2087-02-03",
        guardian_consent: false,
      }),
    ]),
  );
  const draft = await runSafety(db, "begin_edit", { league_id });
  const changed = await runSafety(db, "save_draft", {
    id: draft.id,
    revision: draft.revision,
    league_id,
    data: {
      ...draft.data,
      name: "STALE NAME MUST NOT APPLY",
      courts: [
        { name: "STALE COURT MUST NOT EXIST", venue: "Synthetic stale venue" },
      ],
      divisions: draft.data.divisions.map((d) => ({
        ...d,
        name: d.name + " stale",
      })),
    },
  });
  const workspace = await runSafety(db, "workspace", { league_id });
  return { league_id, draft: changed, workspace, setup };
}
export function preseasonPayload(fixture, patch = {}) {
  const s = fixture.workspace.preseason.settings;
  return {
    ...s,
    season_name: fixture.setup.season,
    cutoff_date: fixture.setup.cutoff,
    ...patch,
  };
}
export async function writePreseason(tx, fixture, patch) {
  return tx.query("select public.preseason_command($1,$2,$3::jsonb)", [
    fixture.league_id,
    patch.division ? "configure_division" : "configure",
    JSON.stringify(patch.division ?? preseasonPayload(fixture, patch)),
  ]);
}
const stateTables = [
  "leagues",
  "memberships",
  "divisions",
  "teams",
  "players",
  "preseason_settings",
  "coach_questionnaires",
  "guardian_invitations",
  "age_documents",
  "eligibility_reviews",
  "games",
  "schedule_versions",
  "fixtures",
  "courts",
  "availability",
  "notifications",
  "audit_events",
  "organizer_drafts",
  "league_launch",
  "launch_site_versions",
  "member_invitations",
];
export async function safetyState(db, league) {
  const result = {};
  for (const table of stateTables) {
    const key = table === "leagues" ? "id" : "league_id";
    result[table] = (
      await db.query(
        `select to_jsonb(t) r from public.${table} t where ${key}=$1`,
        [league],
      )
    ).rows
      .map((x) => x.r)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}
export function assertConflict(error) {
  assert.equal(error.code, "PT409");
  assert.match(error.message, /Safety configuration changed/);
  return true;
}
export async function sequentialSafetyChecks(db) {
  await prepareActors(db);
  let checks = 0;
  for (const [name, patch] of safetyCases) {
    const f = await createSafetyFixture(db, name);
    const baseline = f.draft.base_safety;
    await asUser(db, safetyActor2, (tx) => writePreseason(tx, f, patch));
    const before = await safetyState(db, f.league_id);
    await assert.rejects(
      () =>
        runSafety(db, "finish", { id: f.draft.id, revision: f.draft.revision }),
      assertConflict,
    );
    checks++;
    assert.deepEqual(
      await safetyState(db, f.league_id),
      before,
      `${name}: rejected finish changes no league records, draft, audit or history`,
    );
    checks++;
    const saved = await runSafety(db, "save_draft", {
      id: f.draft.id,
      revision: f.draft.revision,
      league_id: f.league_id,
      data: f.draft.data,
      base_safety: { forged: true },
    });
    assert.deepEqual(
      saved.base_safety,
      baseline,
      `${name}: autosave cannot rebase the safety snapshot`,
    );
    checks++;
    await assert.rejects(
      () => runSafety(db, "finish", { id: saved.id, revision: saved.revision }),
      assertConflict,
    );
    checks++;
    const fresh = await runSafety(db, "begin_edit", { league_id: f.league_id });
    assert.notDeepEqual(fresh.base_safety, baseline);
    checks++;
    await runSafety(db, "finish", { id: fresh.id, revision: fresh.revision });
    const now = await runSafety(db, "workspace", { league_id: f.league_id });
    if (patch.division) {
      assert.ok(
        now.preseason.divisions.some(
          (d) =>
            d.age_category === patch.division.age_category &&
            d.tier === patch.division.tier &&
            d.min_age === patch.division.min_age &&
            d.max_age === patch.division.max_age,
        ),
      );
    } else {
      // A fresh review deliberately re-enables readiness per existing setup rules.
      for (const [key, value] of Object.entries(patch))
        if (key !== "enabled")
          assert.deepEqual(
            key === "cutoff_date"
              ? now.preseason.settings.cutoff_date
              : now.preseason.settings[key],
            value,
          );
    }
    checks++;
  }
  const aba = await createSafetyFixture(db, "ABA");
  await asUser(db, safetyActor2, (tx) =>
    writePreseason(tx, aba, { min_roster: 7 }),
  );
  await asUser(db, safetyActor2, (tx) =>
    writePreseason(tx, aba, { min_roster: 5 }),
  );
  await assert.rejects(
    () =>
      runSafety(db, "finish", {
        id: aba.draft.id,
        revision: aba.draft.revision,
      }),
    assertConflict,
  );
  checks++;
  await assert.rejects(
    () =>
      asUser(db, safetyActor, (tx) =>
        tx.query("select private.organizer_safety_snapshot($1)", [
          aba.league_id,
        ]),
      ),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    () =>
      asUser(db, safetyActor, (tx) =>
        tx.query(
          "update public.organizer_drafts set base_safety='{}' where id=$1",
          [aba.draft.id],
        ),
      ),
    (e) => e.code === "42501",
  );
  checks++;
  return checks;
}
