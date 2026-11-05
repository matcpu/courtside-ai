import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pathToFileURL } from "node:url";
import {
  localDatabase,
  initializeTestDatabase,
  asUser,
} from "./lib/local-database.mjs";
import {
  createSafetyFixture,
  prepareActors,
  safetyActor,
  safetyActor2,
  runSafety,
  preseasonPayload,
  safetyState,
  assertConflict,
} from "./lib/launchpad-safety-cases.mjs";
export async function policyChecks(db) {
  let count = 0;
  const ok = (v, label) => {
    assert.ok(v, label);
    count++;
  };
  const denied = async (fn, pattern) => {
    await assert.rejects(fn, pattern);
    count++;
  };
  await prepareActors(db);
  const referenceId = (
    await db.query("select id from public.leagues where slug='northstar-demo'")
  ).rows[0].id;
  const reference = (
    await db.query("select private.snapshot($1,true) r", [referenceId])
  ).rows[0].r;
  const f = await createSafetyFixture(db, "Proof Policy");
  const l = f.league_id;
  const cmd = (action, p, actor = safetyActor) =>
    asUser(
      db,
      actor,
      async (tx) =>
        (
          await tx.query("select public.preseason_command($1,$2,$3::jsonb) r", [
            l,
            action,
            JSON.stringify(p),
          ])
        ).rows[0].r,
    );
  const guardian = (hash, action, p = {}) =>
    asUser(
      db,
      null,
      async (tx) =>
        (
          await tx.query("select public.guardian_gateway($1,$2,$3::jsonb) r", [
            hash,
            action,
            JSON.stringify(p),
          ])
        ).rows[0].r,
      "anon",
    );
  const settings = () =>
    db.query("select * from public.preseason_settings where league_id=$1", [l]);
  const q = {
    ageCategory: "U14",
    previousLeague: "Synthetic",
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
    preferredTier: 2,
    coachConfidence: 70,
    notes: "Synthetic fixture",
  };
  const team = (
    await db.query("select id from public.teams where league_id=$1", [l])
  ).rows[0].id;
  const player = (
    await db.query("select id from public.players where league_id=$1", [l])
  ).rows[0].id;
  const { recommendation } = await cmd("save_questionnaire", {
    team_id: team,
    name: "Fictional Safety Team",
    data: q,
    submit: true,
  });
  await asUser(db, safetyActor, (tx) =>
    tx.query("select public.league_command($1,'approve_team',$2::jsonb)", [
      l,
      JSON.stringify({
        team_id: team,
        tier: recommendation.tier,
        override_reason: "Evidence rubric placement approved",
      }),
    ]),
  );
  const original = (await settings()).rows[0];
  ok(
    original.proof_required && original.allowed_document_types.length === 3,
    "Existing saved selections preserved",
  );
  // New ordinary leagues have no implicit proof selection and cannot become ready.
  const fresh = await asUser(
    db,
    safetyActor,
    async (tx) =>
      (
        await tx.query(
          "select public.league_command(null,'create_league',$1::jsonb) r",
          [
            JSON.stringify({
              name: "Synthetic Empty Policy",
              season: "2099",
              cutoff: "2099-01-01",
            }),
          ],
        )
      ).rows[0].r,
  );
  const defaults = (
    await db.query(
      "select * from public.preseason_settings where league_id=$1",
      [fresh.id],
    )
  ).rows[0];
  ok(
    defaults.proof_required && defaults.allowed_document_types.length === 0,
    "No proofs selected for a new league",
  );
  let before = await safetyState(db, l);
  await denied(
    () => cmd("configure", preseasonPayload(f, { allowed_document_types: [] })),
    /Select at least one/,
  );
  assert.deepEqual(await safetyState(db, l), before);
  count++;
  await cmd(
    "configure",
    preseasonPayload(f, {
      min_roster: 1,
      allowed_document_types: ["passport"],
    }),
  );
  ok(
    (await settings()).rows[0].allowed_document_types.join() === "passport",
    "Explicit selection saved",
  );
  await denied(
    () =>
      cmd(
        "configure",
        preseasonPayload(f, { expected_rules_version: original.rules_version }),
      ),
    /Reload and review/,
  );
  // Change proof policy through the supported command, not the eligibility enforcement toggle.
  const stale = await runSafety(db, "begin_edit", { league_id: l });
  await cmd(
    "configure",
    preseasonPayload(f, {
      proof_required: false,
      min_roster: 1,
      allowed_document_types: [],
    }),
  );
  before = await safetyState(db, l);
  await denied(
    () => runSafety(db, "finish", { id: stale.id, revision: stale.revision }),
    assertConflict,
  );
  assert.deepEqual(await safetyState(db, l), before);
  count++;
  const editing = await runSafety(db, "begin_edit", { league_id: l });
  ok(
    editing.data.proofRequired === false &&
      editing.data.allowedDocumentTypes.length === 0,
    "Launchpad reads actual no-proof policy",
  );
  // Saving an existing season in Launchpad must retain the explicit no-proof choice.
  await runSafety(db, "finish", { id: editing.id, revision: editing.revision });
  ok(
    (await settings()).rows[0].proof_required === false,
    "Launchpad preserves explicit policy",
  );
  const hash = "d".repeat(64);
  const inv = await cmd("create_invitation", {
    player_id: player,
    token_hash: hash,
  });
  let state = await guardian(hash, "status");
  ok(
    state.proof_required === false && state.allowed_document_types.length === 0,
    "Guardian sees only actual policy",
  );
  await denied(
    () =>
      guardian(hash, "reserve_upload", {
        invitation_id: inv.id,
        document_type: "passport",
        extension: "png",
      }),
    /does not collect/,
  );
  await denied(
    () =>
      guardian(hash, "submit_declaration", {
        invitation_id: inv.id,
        consent: false,
        confirmed_details: true,
      }),
    /consent/,
  );
  await guardian(hash, "submit_declaration", {
    invitation_id: inv.id,
    consent: true,
    confirmed_details: true,
  });
  const readiness = async () =>
    (await db.query("select private.team_readiness($1,$2) r", [l, team]))
      .rows[0].r;
  ok(
    !(await readiness()).eligible_for_scheduling,
    "Consent alone does not bypass human review",
  );
  await denied(
    () =>
      asUser(db, safetyActor, (tx) =>
        tx.query("select public.league_command($1,'verify_player',$2::jsonb)", [
          l,
          JSON.stringify({ player_id: player }),
        ]),
      ),
    /Document review is required/,
  );
  // Coach cannot approve. Use a genuine synthetic coach membership.
  await db.query(
    "update public.memberships set role='coach' where league_id=$1 and user_id=$2",
    [l, safetyActor2],
  );
  const review = {
    player_id: player,
    decision: "approved",
    reason: "Reviewed declared details and age rules.",
    details_checked: true,
    duplicate_acknowledged: false,
  };
  await denied(
    () => cmd("review_declaration", review, safetyActor2),
    /reviewer required/,
  );
  await cmd("review_declaration", { ...review, decision: "resubmission" });
  state = await guardian(hash, "status");
  ok(
    state.can_submit && state.review_reason.includes("Declaration only"),
    "Resubmission and reason available privately",
  );
  await guardian(hash, "submit_declaration", {
    invitation_id: inv.id,
    consent: true,
    confirmed_details: true,
  });
  await cmd("review_declaration", review);
  let ready = await readiness();
  ok(
    !ready.eligible_for_scheduling &&
      ready.verified === 0 &&
      ready.eligible_players === 1,
    "Approval is not document verification and roster remains required",
  );
  await cmd("submit_roster", { team_id: team });
  ready = await readiness();
  ok(
    ready.eligible_for_scheduling && ready.verified === 0,
    "Full explicit no-proof eligibility passes with human review",
  );
  await guardian(hash, "withdraw_consent", { invitation_id: inv.id });
  ok(
    !(await readiness()).eligible_for_scheduling,
    "Withdrawal blocks scheduling",
  );
  await guardian(hash, "submit_declaration", {
    invitation_id: inv.id,
    consent: true,
    confirmed_details: true,
  });
  await db.query(
    "update public.players set birth_date='2070-01-01' where id=$1",
    [player],
  );
  await denied(() => cmd("review_declaration", review), /outside.*age range/);
  await db.query(
    "update public.players set birth_date='2087-02-03' where id=$1",
    [player],
  );
  await cmd("review_declaration", review);
  await cmd(
    "configure",
    preseasonPayload(f, {
      proof_required: true,
      min_roster: 1,
      allowed_document_types: ["passport"],
    }),
  );
  ok(
    !(await readiness()).eligible_for_scheduling,
    "Requiring proof cannot inherit a declaration approval",
  );
  await denied(() => cmd("review_declaration", review), /Proof is required/);
  state = await guardian(hash, "status");
  ok(
    state.proof_required &&
      state.allowed_document_types.join() === "passport" &&
      state.can_submit,
    "Guardian now must supply permitted proof",
  );
  await denied(
    () =>
      guardian(hash, "reserve_upload", {
        invitation_id: inv.id,
        document_type: "birth_certificate",
        extension: "png",
      }),
    /not accepted/,
  );
  await denied(
    () =>
      guardian(hash, "submit_declaration", {
        invitation_id: inv.id,
        consent: true,
        confirmed_details: true,
      }),
    /not accepting/,
  );
  const doc = await guardian(hash, "reserve_upload", {
    invitation_id: inv.id,
    document_type: "passport",
    extension: "png",
  });
  ok(Boolean(doc.id), "Allowed proof reserved");
  // A proof reserved before a document-policy change cannot be finalized after it.
  await cmd(
    "configure",
    preseasonPayload(f, {
      proof_required: false,
      min_roster: 1,
      allowed_document_types: ["passport"],
    }),
  );
  await denied(
    () =>
      asUser(
        db,
        null,
        (tx) =>
          tx.query("select public.finalize_age_upload($1,$2,$3::jsonb)", [
            hash,
            doc.id,
            "{}",
          ]),
        "service_role",
      ),
    /collection is disabled/,
  );
  await db.query(
    "update public.guardian_invitations set expires_at=now()-interval '1 minute' where id=$1",
    [inv.id],
  );
  await denied(() => guardian(hash, "status"), /expired/);
  assert.deepEqual(
    (await db.query("select private.snapshot($1,true) r", [referenceId]))
      .rows[0].r,
    reference,
  );
  count++;
  return count;
}
export async function policyUpgradeChecks() {
  let league, original;
  const db = await initializeTestDatabase(new PGlite(), {
    beforeMigration: async (tx, file) => {
      if (!file.endsWith("_preseason_document_policy.sql")) return;
      await prepareActors(tx);
      league = (
        await asUser(
          tx,
          safetyActor,
          async (t) =>
            (
              await t.query(
                "select public.league_command(null,'create_league',$1::jsonb) r",
                [
                  JSON.stringify({
                    name: "Synthetic Preexisting Policy",
                    season: "2099",
                    cutoff: "2099-01-01",
                  }),
                ],
              )
            ).rows[0].r,
        )
      ).id;
      await asUser(tx, safetyActor, (t) =>
        t.query("select public.preseason_command($1,'configure',$2::jsonb)", [
          league,
          JSON.stringify({
            enabled: true,
            season_name: "2099",
            season_start: "2099-03-07",
            cutoff_date: "2099-01-01",
            registration_status: "open",
            questionnaire_deadline: "2099-02-01T00:00:00Z",
            roster_deadline: "2099-02-15T00:00:00Z",
            verification_deadline: "2099-02-28T00:00:00Z",
            min_roster: 6,
            max_roster: 15,
            document_retention_days: 7,
            allowed_document_types: ["passport"],
          }),
        ]),
      );
      original = (
        await tx.query(
          "select to_jsonb(s) r from public.preseason_settings s where league_id=$1",
          [league],
        )
      ).rows[0].r;
    },
  });
  try {
    const upgraded = (
      await db.query(
        "select to_jsonb(s) r from public.preseason_settings s where league_id=$1",
        [league],
      )
    ).rows[0].r;
    assert.equal(upgraded.proof_required, true);
    delete upgraded.proof_required;
    assert.deepEqual(upgraded, original);
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','private.preseason_document_command(uuid,text,jsonb)','EXECUTE') p",
        )
      ).rows[0].p,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','private.guardian_document_gateway(text,text,jsonb)','EXECUTE') p",
        )
      ).rows[0].p,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('service_role','private.finalize_document_upload(text,uuid,jsonb)','EXECUTE') p",
        )
      ).rows[0].p,
      false,
    );
    return 5;
  } finally {
    await db.close();
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = await localDatabase();
  try {
    console.log(
      `Preseason policy assertions passed: ${await policyChecks(db)}. Local synthetic database only.`,
    );
  } finally {
    await db.close();
  }
}
