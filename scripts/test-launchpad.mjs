import assert from "node:assert/strict";
import fs from "node:fs";
import { localDatabase, asUser, organizer } from "./lib/local-database.mjs";
import { newSetup } from "../src/lib/launchpad.ts";
import { sequentialSafetyChecks } from "./lib/launchpad-safety-cases.mjs";
import { assertTestSchema } from "./lib/assert-test-schema.mjs";
const db = await localDatabase();
let checks = 0;
const admin = "cc000000-0000-4000-8000-000000000001",
  other = "cc000000-0000-4000-8000-000000000002",
  coach = "cc000000-0000-4000-8000-000000000003";
const ok = (v, label) => {
  assert.ok(v, label);
  checks++;
};
const run = (actor, action, p) =>
  asUser(db, actor, (tx) => organizer(tx, action, p));
const denied = async (actor, action, p) => {
  await assert.rejects(() => run(actor, action, p));
  checks++;
};
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const command = (actor, league, action, payload) =>
  asUser(
    db,
    actor,
    async (tx) =>
      (
        await tx.query("select public.league_command($1,$2,$3::jsonb) r", [
          league,
          action,
          JSON.stringify(payload),
        ])
      ).rows[0].r,
  );
try {
  checks += await assertTestSchema(db);
  const baseCount = (await sql("select count(*)::int n from public.leagues"))[0]
    .n;
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'organizer@example.invalid',now()),($2,'outsider@example.invalid',now())",
    [admin, other],
  );
  const minimal = { ...newSetup(), name: "Synthetic Launch League" };
  let d = await run(admin, "save_draft", {
    id: null,
    league_id: null,
    data: minimal,
  });
  ok(
    d.data.name === minimal.name && d.status === "draft",
    "Minimal draft persisted",
  );
  ok((await run(admin, "list", {})).drafts[0].id === d.id, "Draft resumes");
  ok(
    (await run(other, "list", {})).drafts.length === 0,
    "Other owner cannot list draft",
  );
  await denied(other, "save_draft", {
    id: d.id,
    revision: d.revision,
    league_id: null,
    data: minimal,
  });
  await denied(admin, "finish", { id: d.id, revision: d.revision });
  ok(
    (await sql("select count(*)::int n from public.leagues"))[0].n ===
      baseCount,
    "Incomplete finish creates no partial league",
  );
  const complete = {
    ...minimal,
    city: "Toronto",
    adminContact: "private-admin@example.invalid",
    season: "Synthetic 2099",
    start: "2099-03-01",
    end: "2099-06-30",
    opening: "2099-03-07",
    cutoff: "2099-01-01",
    registrationDeadline: "2099-02-01",
    rosterDeadline: "2099-02-15",
    verificationDeadline: "2099-02-28",
    courts: [{ name: "Synthetic Court", venue: "Fictional Hall · Toronto" }],
  };
  const oldRev = d.revision;
  d = await run(admin, "save_draft", {
    id: d.id,
    revision: d.revision,
    league_id: null,
    data: complete,
  });
  await denied(admin, "save_draft", {
    id: d.id,
    revision: oldRev,
    league_id: null,
    data: minimal,
  });
  const { league_id: l } = await run(admin, "finish", {
    id: d.id,
    revision: d.revision,
  });
  ok(
    l &&
      (await run(admin, "finish", { id: d.id, revision: d.revision }))
        .league_id === l,
    "Finish is idempotent",
  );
  const workspace = await run(admin, "workspace", { league_id: l });
  ok(
    workspace.preseason.settings.registration_status === "draft" &&
      workspace.preseason.settings.enabled,
    "Private new season retains enforced verification",
  );
  ok(
    (await sql("select is_public from public.leagues where id=$1", [l]))[0]
      .is_public === false,
    "Finish does not publish",
  );
  ok(
    (
      await sql(
        "select count(*)::int n from public.divisions where league_id=$1",
        [l],
      )
    )[0].n === 3,
    "Configured divisions materialize",
  );
  await denied(other, "workspace", { league_id: l });
  await denied(other, "open_registration", { league_id: l });
  const unreadable = await asUser(
    db,
    other,
    async (tx) => (await tx.query("select * from public.league_launch")).rows,
  );
  ok(unreadable.length === 0, "RLS hides private setup");
  await assert.rejects(() =>
    asUser(db, admin, (tx) =>
      tx.query("update public.league_launch set preferred_domain='forged.com'"),
    ),
  );
  checks++;
  const court = (
    await sql("select id from public.courts where league_id=$1", [l])
  )[0].id;
  await command(admin, l, "add_availability", {
    court_id: court,
    starts_at: "2099-03-07T14:00:00Z",
    ends_at: "2099-03-07T18:00:00Z",
    confirmed: true,
  });
  ok(
    (
      await sql(
        "select count(*)::int n from public.availability where league_id=$1",
        [l],
      )
    )[0].n === 1,
    "Real availability saved through existing guarded command",
  );
  await run(admin, "open_registration", { league_id: l });
  ok(
    (await run(admin, "workspace", { league_id: l })).preseason.settings
      .registration_status === "open",
    "Registration is a separate explicit action",
  );
  const site = {
    theme: "courtside",
    colour: "#164d3b",
    accent: "#d5f58c",
    headline: "Public headline one",
    about: "Synthetic community league.",
    rules: "Human review required.",
    contactEmail: "public@example.invalid",
    logo: "",
  };
  await denied(other, "site_save", { league_id: l, revision: 0, site });
  await run(admin, "site_save", {
    league_id: l,
    revision: 0,
    site: { ...site, secret: "must-not-project" },
  });
  const slug = (
    await sql("select slug from public.leagues where id=$1", [l])
  )[0].slug;
  const publicSite = async () =>
    asUser(
      db,
      null,
      async (tx) =>
        (await tx.query("select public.public_launch_site($1) r", [slug]))
          .rows[0].r,
      "anon",
    );
  ok((await publicSite()) === null, "Unpublished website is private");
  await denied(admin, "site_publish", {
    league_id: l,
    revision: 1,
    approved_public: false,
  });
  await run(admin, "site_publish", {
    league_id: l,
    revision: 1,
    approved_public: true,
  });
  let published = await publicSite();
  ok(
    published.config.headline === site.headline &&
      published.venues.length === 1,
    "Public website uses approved saved records",
  );
  ok(
    !JSON.stringify(published).includes("private-admin") &&
      !JSON.stringify(published).includes("secret"),
    "Public projection excludes private contact and unknown fields",
  );
  await run(admin, "site_save", {
    league_id: l,
    revision: 1,
    site: { ...site, theme: "arena", headline: "Draft headline two" },
  });
  ok(
    (await publicSite()).config.headline === site.headline,
    "Draft edits do not change published version",
  );
  await denied(admin, "site_publish", {
    league_id: l,
    revision: 1,
    approved_public: true,
  });
  await run(admin, "site_unpublish", { league_id: l });
  ok((await publicSite()) === null, "Unpublish removes public website");
  ok(
    (await sql("select count(*)::int n from public.launch_site_versions"))[0]
      .n === 1,
    "Publication history retained",
  );
  await run(admin, "site_publish", {
    league_id: l,
    revision: 2,
    approved_public: true,
  });
  ok(
    (await publicSite()).config.headline === "Draft headline two",
    "Republish explicitly updates public copy",
  );
  const pendingTeam = await asUser(
    db,
    admin,
    async (tx) =>
      (
        await tx.query(
          "select public.preseason_command($1,'save_questionnaire',$2::jsonb) r",
          [
            l,
            JSON.stringify({
              team_id: null,
              name: "Fictional Launch Team",
              data: {},
              submit: false,
            }),
          ],
        )
      ).rows[0].r.team_id,
  );
  const inv = await run(admin, "invite", {
    league_id: l,
    email: "new-coach@example.invalid",
    role: "coach",
    team_id: pendingTeam,
    hash: "a".repeat(64),
  });
  ok(
    inv.id &&
      (
        await sql(
          "select count(*)::int n from auth.users where email='new-coach@example.invalid'",
        )
      )[0].n === 0,
    "Invite works before an account exists",
  );
  await denied(other, "accept_invite", { hash: "a".repeat(64) });
  await db.query(
    "insert into auth.users(id,email) values($1,'new-coach@example.invalid')",
    [coach],
  );
  await denied(coach, "accept_invite", { hash: "a".repeat(64) });
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    coach,
  ]);
  await run(coach, "accept_invite", { hash: "a".repeat(64) });
  ok(
    (
      await sql("select coach_id from public.teams where id=$1", [pendingTeam])
    )[0].coach_id === coach,
    "Membership and coach assignment accepted together",
  );
  ok(
    (
      await sql(
        "select role from public.memberships where league_id=$1 and user_id=$2",
        [l, coach],
      )
    )[0].role === "coach",
    "Confirmed invitee gets intended role",
  );
  await denied(coach, "accept_invite", { hash: "a".repeat(64) });
  await denied(coach, "workspace", { league_id: l });
  await denied(coach, "site_publish", {
    league_id: l,
    revision: 2,
    approved_public: true,
  });
  ok(
    (await publicSite()).teams.length === 0,
    "Pending team and private questionnaire do not appear publicly",
  );
  const inv2 = await run(admin, "invite", {
    league_id: l,
    email: "new-coach@example.invalid",
    role: "coach",
    hash: "b".repeat(64),
  });
  await run(admin, "revoke_invite", { league_id: l, id: inv2.id });
  await denied(coach, "accept_invite", { hash: "b".repeat(64) });
  await run(admin, "invite", {
    league_id: l,
    email: "new-coach@example.invalid",
    role: "coach",
    hash: "c".repeat(64),
  });
  await db.exec(
    "update public.member_invitations set expires_at=now()-interval '1 second' where token_hash=repeat('c',64)",
  );
  await denied(coach, "accept_invite", { hash: "c".repeat(64) });
  const copied = await run(admin, "copy", { league_id: l });
  ok(
    copied.data.courts.length === 1 &&
      copied.data.divisions.length === 3 &&
      copied.data.opening === "" &&
      copied.data.adminContact === "",
    "Copy includes configuration but clears dates and private contact",
  );
  const readyCopy = await run(admin, "save_draft", {
    id: copied.id,
    revision: copied.revision,
    league_id: null,
    data: { ...complete, name: "Fictional Second Season" },
  });
  const next = await run(admin, "finish", {
    id: readyCopy.id,
    revision: readyCopy.revision,
  });
  ok(next.league_id !== l, "Copy creates a fresh season workspace");
  for (const table of [
    "teams",
    "players",
    "age_documents",
    "guardian_invitations",
    "games",
    "schedule_versions",
    "availability",
    "member_invitations",
  ])
    ok(
      (
        await sql(
          `select count(*)::int n from public.${table} where league_id=$1`,
          [next.league_id],
        )
      )[0].n === 0,
      `Copy excludes ${table}`,
    );
  const originalDivisions = await sql(
    "select id from public.divisions where league_id=$1 order by id",
    [l],
  );
  let edit = await run(admin, "save_draft", {
    id: null,
    league_id: l,
    base_revision: 1,
    data: { ...complete, name: "Synthetic League Renamed" },
  });
  const staleEdit = await run(admin, "save_draft", {
    id: null,
    league_id: l,
    base_revision: 1,
    data: complete,
  });
  await run(admin, "finish", { id: edit.id, revision: edit.revision });
  await denied(admin, "finish", {
    id: staleEdit.id,
    revision: staleEdit.revision,
  });
  await denied(other, "copy", { league_id: l });
  await denied(admin, "invite", {
    league_id: next.league_id,
    email: "outside@example.invalid",
    role: "coach",
    team_id: pendingTeam,
    hash: "d".repeat(64),
  });
  ok(
    (await sql("select id from public.teams where league_id=$1", [l]))[0].id ===
      pendingTeam,
    "Editing keeps existing team",
  );
  assert.deepEqual(
    await sql(
      "select id from public.divisions where league_id=$1 order by id",
      [l],
    ),
    originalDivisions,
  );
  checks++;
  ok(
    (
      await sql(
        "select count(*)::int n from public.launch_site_versions where league_id=$1",
        [l],
      )
    )[0].n === 2,
    "Editing retains publication history",
  );
  await run(admin, "invite", {
    league_id: l,
    email: "outsider@example.invalid",
    role: "coach",
    team_id: pendingTeam,
    hash: "e".repeat(64),
  });
  await db.query("update public.teams set coach_id=$1 where id=$2", [
    admin,
    pendingTeam,
  ]);
  await denied(other, "accept_invite", { hash: "e".repeat(64) });
  ok(
    (
      await sql(
        "select count(*)::int n from public.memberships where league_id=$1 and user_id=$2",
        [l, other],
      )
    )[0].n === 0,
    "Stale team assignment creates no partial membership",
  );
  const snapshotText = JSON.stringify(await publicSite());
  for (const field of [
    "birth_date",
    "guardian",
    "coach_email",
    "token_hash",
    "new-coach",
    "private-admin",
  ])
    ok(!snapshotText.includes(field), `Public page excludes ${field}`);
  const legacyLeague = await asUser(
    db,
    admin,
    async (tx) =>
      (await tx.query("select public.create_demo() r")).rows[0].r.id,
  );
  const legacyTeams = await sql(
    "select id,status from public.teams where league_id=$1 order by id",
    [legacyLeague],
  );
  const legacyGames = await sql(
    "select id,status,home_score,away_score from public.games where league_id=$1 order by id",
    [legacyLeague],
  );
  const legacyDraft = await run(admin, "begin_edit", {
    league_id: legacyLeague,
  });
  ok(
    legacyDraft.league_id === legacyLeague &&
      legacyDraft.data.courts.length > 0,
    "Legacy setup starts from actual existing records, not a replacement league",
  );
  let legacySaved = await run(admin, "save_draft", {
    id: legacyDraft.id,
    revision: legacyDraft.revision,
    league_id: legacyLeague,
    data: {
      ...complete,
      name: legacyDraft.data.name,
      season: legacyDraft.data.season,
      cutoff: legacyDraft.data.cutoff,
      courts: legacyDraft.data.courts,
      divisions: legacyDraft.data.divisions,
    },
  });
  const legacyFinished = await run(admin, "finish", {
    id: legacySaved.id,
    revision: legacySaved.revision,
  });
  ok(
    legacyFinished.league_id === legacyLeague,
    "Legacy completion keeps season identity",
  );
  assert.deepEqual(
    await sql(
      "select id,status from public.teams where league_id=$1 order by id",
      [legacyLeague],
    ),
    legacyTeams,
  );
  checks++;
  assert.deepEqual(
    await sql(
      "select id,status,home_score,away_score from public.games where league_id=$1 order by id",
      [legacyLeague],
    ),
    legacyGames,
  );
  checks++;
  const revokedDraft = await run(admin, "begin_edit", {
    league_id: legacyLeague,
  });
  await db.query(
    "delete from public.memberships where league_id=$1 and user_id=$2",
    [legacyLeague, admin],
  );
  ok(
    !(await run(admin, "list", {})).drafts.some(
      (draft) => draft.id === revokedDraft.id,
    ),
    "Revoked administrator cannot list linked draft",
  );
  const revokedRows = await asUser(db, admin, (tx) =>
    tx.query("select id from public.organizer_drafts where id=$1", [
      revokedDraft.id,
    ]),
  );
  ok(
    revokedRows.rows.length === 0,
    "RLS revokes linked-draft access with membership",
  );
  await denied(admin, "finish", {
    id: revokedDraft.id,
    revision: revokedDraft.revision,
  });
  checks += await sequentialSafetyChecks(db);
  console.log(
    `Launchpad PostgreSQL assertions passed: ${checks}. In-memory database; no hosted changes.`,
  );
  for (const file of ["tests/database.sql", "tests/preseason-database.sql"]) {
    const r = await db.exec(fs.readFileSync(file, "utf8"));
    console.log(
      `${file}: existing assertions passed and rolled back (${r.length} SQL results).`,
    );
  }
} catch (e) {
  console.error("After check", checks, e.message, e.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
if (!process.exitCode) {
  const clean = await localDatabase();
  try {
    console.log(
      `Repeated clean setup: ${await assertTestSchema(clean)} migration/RLS/permission assertions passed.`,
    );
  } finally {
    await clean.close();
  }
}
