// Isolated synthetic PostgreSQL only. No env files, provider calls or hosted writes.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { localDatabase, asUser, organizer } from "./lib/local-database.mjs";
import { defaultSportRules } from "../src/lib/sports.ts";
import { standings } from "../src/lib/domain.ts";
import { newSetup } from "../src/lib/launchpad.ts";
const db = await localDatabase();
const admin = randomUUID(),
  coach = randomUUID(),
  outsider = randomUUID();
let checks = 0;
const check = (value, label) => {
  assert.ok(value, label);
  checks++;
};
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const rpc = (actor, league, action, p = {}) =>
  asUser(
    db,
    actor,
    async (tx) =>
      (
        await tx.query("select public.league_command($1,$2,$3::jsonb) r", [
          league,
          action,
          JSON.stringify(p),
        ])
      ).rows[0].r,
  );
const launch = (actor, action, p) =>
  asUser(db, actor, (tx) => organizer(tx, action, p));
const reject = async (fn, pattern) => {
  await assert.rejects(fn, pattern);
  checks++;
};
const state = async (l) =>
  JSON.stringify(
    await sql(
      "select to_jsonb(le) le,(select jsonb_agg(to_jsonb(la)) from public.league_launch la where league_id=le.id) launch,(select count(*) from public.audit_events where league_id=le.id) events from public.leagues le where id=$1",
      [l],
    ),
  );
try {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'sports-admin@example.invalid',now()),($2,'sports-coach@example.invalid',now()),($3,'sports-outsider@example.invalid',now())",
    [admin, coach, outsider],
  );
  for (const sport of ["basketball", "hockey"]) {
    const rules = defaultSportRules(sport);
    const l = (
      await rpc(admin, null, "create_league", {
        name: `Synthetic ${sport}`,
        season: "Synthetic 2099",
        cutoff: "2099-01-01",
        sport,
      })
    ).id;
    const league = (
      await sql("select * from public.leagues where id=$1", [l])
    )[0];
    assert.deepEqual(league.sport_rules, rules);
    checks++;
    await reject(
      () =>
        rpc(outsider, l, "configure_sport", {
          sport,
          sportRules: rules,
          expected_sport_revision: league.sport_revision,
        }),
      /access|Administrator/i,
    );
    await rpc(admin, l, "invite_member", {
      email: "sports-coach@example.invalid",
      role: "coach",
    });
    await reject(
      () =>
        rpc(coach, l, "configure_sport", {
          sport,
          sportRules: rules,
          expected_sport_revision: league.sport_revision,
        }),
      /Administrator/i,
    );
    await reject(
      () =>
        rpc(admin, l, "configure_sport", {
          sport,
          sportRules: rules,
          expected_sport_revision: 0,
        }),
      /changed/i,
    );
    const malformed = { ...rules };
    delete malformed.tieBreak;
    malformed.unknown = "wins";
    await reject(
      () =>
        rpc(admin, l, "configure_sport", {
          sport,
          sportRules: malformed,
          expected_sport_revision: league.sport_revision,
        }),
      /Invalid sport rules/,
    );
    await reject(
      () =>
        rpc(admin, l, "configure_sport", {
          sport,
          sportRules: { ...rules, gameMinutes: 0 },
          expected_sport_revision: league.sport_revision,
        }),
      /Invalid sport rules/,
    );
    const teams = [];
    for (const name of ["Alpha", "Beta"]) {
      const assessment = {
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
        notes: "Synthetic assessment",
      };
      const saved = await asUser(
        db,
        admin,
        async (tx) =>
          (
            await tx.query(
              "select public.preseason_command($1,$2,$3::jsonb) r",
              [
                l,
                "save_questionnaire",
                JSON.stringify({ name, data: assessment, submit: true }),
              ],
            )
          ).rows[0].r,
      );
      const team = saved.team_id;
      if (sport === "hockey")
        check(
          saved.recommendation.source === "coach_preference" &&
            saved.recommendation.confidence === 0 &&
            saved.recommendation.rating === 1000,
          "Hockey does not use basketball placement calibration",
        );
      await rpc(admin, l, "approve_team", {
        team_id: team,
        tier: 2,
        override_reason: "Synthetic administrator placement review",
      });
      teams.push(team);
    }
    // Scheduling/scoring cases isolate sport constraints from the independently
    // covered document workflow. No real eligibility decisions are manufactured.
    await db.query(
      "update public.preseason_settings set enabled=false where league_id=$1",
      [l],
    );
    await reject(
      () =>
        rpc(admin, l, "configure_sport", {
          sport: sport === "hockey" ? "basketball" : "hockey",
          sportRules: defaultSportRules(
            sport === "hockey" ? "basketball" : "hockey",
          ),
          expected_sport_revision: league.sport_revision,
        }),
      /before registering teams/,
    );
    // Configurable no-draw policy is authoritative in PostgreSQL, not just UI.
    const configured = { ...rules, gameMinutes: 90, restMinutes: 45 };
    await rpc(admin, l, "configure_sport", {
      sport,
      sportRules: configured,
      expected_sport_revision: league.sport_revision,
    });
    const court = (
      await rpc(admin, l, "add_court", {
        name: sport === "hockey" ? "Synthetic Rink" : "Synthetic Court",
        venue: "Synthetic facility",
      })
    ).id;
    await rpc(admin, l, "add_availability", {
      court_id: court,
      starts_at: "2099-05-01T12:00:00Z",
      ends_at: "2099-05-01T20:00:00Z",
    });
    const snapshot = () =>
      asUser(
        db,
        admin,
        async (tx) =>
          (await tx.query("select public.league_snapshot($1,false) s", [l]))
            .rows[0].s,
      );
    const pair = (start, end) => ({
      game_id: randomUUID(),
      home_team_id: teams[0],
      away_team_id: teams[1],
      court_id: court,
      starts_at: start,
      ends_at: end,
    });
    let s = await snapshot();
    await reject(
      () =>
        rpc(admin, l, "draft_schedule", {
          explanation: "Synthetic test",
          base_revision: s.league.revision,
          data_revision: s.league.data_revision,
          fixtures: [pair("2099-05-01T12:00:00Z", "2099-05-01T13:00:00Z")],
        }),
      /duration/,
    );
    await reject(
      () =>
        rpc(admin, l, "draft_schedule", {
          explanation: "Synthetic test",
          base_revision: s.league.revision,
          data_revision: s.league.data_revision,
          fixtures: [
            pair("2099-05-01T12:00:00Z", "2099-05-01T13:30:00Z"),
            pair("2099-05-01T14:00:00Z", "2099-05-01T15:30:00Z"),
          ],
        }),
      /rest|conflict/i,
    );
    check(
      (
        await sql(
          "select count(*)::int n from public.schedule_versions where league_id=$1",
          [l],
        )
      )[0].n === 0,
      "Rejected schedules make no partial records",
    );
    const fixtures = [
      pair("2099-05-01T12:00:00Z", "2099-05-01T13:30:00Z"),
      pair("2099-05-01T14:30:00Z", "2099-05-01T16:00:00Z"),
      pair("2099-05-01T17:00:00Z", "2099-05-01T18:30:00Z"),
    ];
    const version = (
      await rpc(admin, l, "draft_schedule", {
        explanation: "Synthetic test",
        base_revision: s.league.revision,
        data_revision: s.league.data_revision,
        fixtures,
      })
    ).id;
    await reject(
      () => rpc(coach, l, "publish_schedule", { version_id: version }),
      /Administrator/,
    );
    await rpc(admin, l, "publish_schedule", { version_id: version });
    const before = await state(l);
    await reject(
      () =>
        rpc(admin, l, "configure_sport", {
          sport,
          sportRules: { ...configured, winPoints: 3 },
          expected_sport_revision: s.league.sport_revision,
        }),
      /locked/,
    );
    check((await state(l)) === before, "Locked rule update changes nothing");
    // Advance the synthetic fixture clock to permit normal human result review.
    await db.query(
      "update public.fixtures set starts_at=starts_at-interval '100 years',ends_at=ends_at-interval '100 years' where league_id=$1",
      [l],
    );
    const outcomes =
      sport === "hockey"
        ? [
            [4, 3, "overtime"],
            [1, 2, "shootout"],
            [0, 0, "regulation"],
          ]
        : [
            [78, 43, "regulation"],
            [60, 65, "overtime"],
            [45, 45, "regulation"],
          ];
    for (let i = 0; i < fixtures.length; i++) {
      const [homeScore, awayScore, decision] = outcomes[i];
      const extraction = {
        homeTeam: "Alpha",
        awayTeam: "Beta",
        homeScore,
        awayScore,
        decision,
        confidence: 1,
        warnings: [],
        players: [],
      };
      const path = `${l}/${admin}/${randomUUID()}.png`;
      await db.query(
        "insert into storage.objects(bucket_id,name,owner) values('scoresheets',$1,$2)",
        [path, admin],
      );
      const hash = createHash("sha256").update(path).digest("hex");
      if (sport === "hockey")
        await reject(
          () =>
            rpc(admin, l, "submit_scoresheet", {
              game_id: fixtures[i].game_id,
              storage_path: path,
              sha256: hash,
              source: "meta",
              extraction,
            }),
          /manual team scores/,
        );
      const sheet = (
        await rpc(admin, l, "submit_scoresheet", {
          game_id: fixtures[i].game_id,
          storage_path: path,
          sha256: hash,
          source: "manual",
          extraction,
        })
      ).id;
      const confirm = (p) =>
        rpc(admin, l, "confirm_result", {
          sheet_id: sheet,
          reviewed: true,
          extraction,
          ...p,
        });
      await reject(
        () =>
          rpc(coach, l, "confirm_result", {
            sheet_id: sheet,
            reviewed: true,
            extraction,
          }),
        /Reviewer|Administrator/,
      );
      await reject(() => confirm({ reviewed: false }), /Human review/);
      await reject(
        () => confirm({ extraction: { ...extraction, homeScore: 301 } }),
        /bounds/,
      );
      await reject(
        () =>
          confirm({
            extraction: {
              ...extraction,
              homeScore: 2,
              awayScore: 2,
              decision: "overtime",
            },
          }),
        /Tied/,
      );
      if (sport === "hockey")
        await reject(
          () =>
            confirm({
              extraction: {
                ...extraction,
                players: [
                  {
                    team: "home",
                    jersey: "7",
                    points: 1,
                    rebounds: null,
                    assists: null,
                  },
                ],
              },
            }),
          /team scores/,
        );
      await confirm();
      const g = (
        await sql("select * from public.games where id=$1", [
          fixtures[i].game_id,
        ])
      )[0];
      check(
        g.decision === decision &&
          g.result_sport_revision === s.league.sport_revision,
        "Official result stores decision and rules revision",
      );
      assert.deepEqual(g.result_rules, configured);
      checks++;
    }
    s = await snapshot();
    const js = standings(s.teams, s.games, configured).map((r) => ({
      name: r.team.name,
      played: r.played,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      overtimeLosses: r.overtimeLosses,
      points: r.points,
      differential: r.for - r.against,
    }));
    const pg = (await sql("select private.sport_standings($1) s", [l]))[0].s;
    assert.deepEqual(pg, js);
    checks++;
    if (sport === "hockey") {
      check(
        js.every((r) => r.points === 4),
        "Hockey W + OT/SO L + D = 4 points each",
      );
      await reject(() => rpc(admin, l, "propose_balance"), /basketball only/);
    }
    // Corrections must retain prior decisions in immutable review history.
    const sheet = (
      await sql(
        "select id,extraction from public.scoresheets where game_id=$1",
        [fixtures[0].game_id],
      )
    )[0];
    await rpc(admin, l, "reopen_result", {
      sheet_id: sheet.id,
      correction_reason: "Synthetic correction test",
    });
    await rpc(admin, l, "confirm_result", {
      sheet_id: sheet.id,
      reviewed: true,
      correction_reason: "Synthetic correction test",
      extraction: {
        ...sheet.extraction,
        homeScore: 5,
        awayScore: 1,
        decision: "regulation",
      },
    });
    check(
      (
        await sql(
          "select count(*)::int n from public.result_revisions where game_id=$1",
          [fixtures[0].game_id],
        )
      )[0].n === 2,
      "Corrections preserve both review revisions",
    );
    check(
      (
        await sql(
          "select extraction from public.result_revisions where game_id=$1 order by created_at limit 1",
          [fixtures[0].game_id],
        )
      )[0].extraction.decision === outcomes[0][2],
      "Prior decision is recoverable",
    );
    await rpc(admin, l, "configure_public", { enabled: true });
    const publicS = await asUser(
      db,
      null,
      async (tx) =>
        (await tx.query("select public.league_snapshot($1,true) s", [l]))
          .rows[0].s,
      "anon",
    );
    check(
      publicS.league.sport === sport &&
        publicS.players.length === 0 &&
        publicS.statistics.length === 0,
      "Public sport metadata preserves redaction",
    );
    await reject(
      () =>
        asUser(db, outsider, (tx) =>
          tx.query("update public.leagues set sport=$1 where id=$2", [
            "hockey",
            l,
          ]),
        ),
      /permission/,
    );
    check(
      (
        await asUser(db, outsider, (tx) =>
          tx.query(
            "select * from public.sport_rule_revisions where league_id=$1",
            [l],
          ),
        )
      ).rows.length === 0,
      "Rule history is admin-only",
    );
  }
  // Launchpad finish sets hockey atomically, including copy and existing drafts.
  const cfg = {
    ...newSetup(),
    sport: "hockey",
    sportRules: defaultSportRules("hockey"),
    name: "Synthetic Hockey Launch",
    city: "Toronto",
    season: "Synthetic 2099",
    start: "2099-05-01",
    end: "2099-06-30",
    opening: "2099-05-02",
    cutoff: "2099-01-01",
    registrationDeadline: "2099-04-01",
    rosterDeadline: "2099-04-15",
    verificationDeadline: "2099-04-30",
    allowedDocumentTypes: ["passport"],
  };
  let d = await launch(admin, "save_draft", {
    id: null,
    league_id: null,
    data: cfg,
  });
  const l = (await launch(admin, "finish", { id: d.id, revision: d.revision }))
    .league_id;
  check(
    (await sql("select sport from public.leagues where id=$1", [l]))[0]
      .sport === "hockey",
    "Launchpad creates hockey",
  );
  const copy = await launch(admin, "copy", { league_id: l });
  check(
    copy.data.sport === "hockey" &&
      copy.data.sportRules.overtimeLossPoints === 1,
    "Copy preserves sport rules",
  );
  d = await launch(admin, "begin_edit", { league_id: l });
  const le = (
    await sql("select sport_revision from public.leagues where id=$1", [l])
  )[0];
  await rpc(admin, l, "configure_sport", {
    sport: "hockey",
    sportRules: { ...cfg.sportRules, winPoints: 3 },
    expected_sport_revision: le.sport_revision,
  });
  const before = await state(l);
  await reject(
    () => launch(admin, "finish", { id: d.id, revision: d.revision }),
    /Safety configuration changed/,
  );
  check((await state(l)) === before, "Stale sport draft rejection is atomic");
  check(
    (
      await sql("select status from public.organizer_drafts where id=$1", [
        d.id,
      ])
    )[0].status === "draft",
    "Rejected draft remains reviewable",
  );
  check(
    (
      await sql(
        "select has_function_privilege('authenticated','private.set_sport_rules(uuid,text,jsonb)','EXECUTE') allowed",
      )
    )[0].allowed === false,
    "Private rule writer cannot be invoked directly",
  );
  await reject(
    () =>
      asUser(
        db,
        null,
        (tx) =>
          tx.query(
            "select public.league_command($1,'configure_sport','{}'::jsonb)",
            [l],
          ),
        "anon",
      ),
    /permission/,
  );
  await rpc(admin, l, "configure_sport", {
    sport: "hockey",
    sportRules: {
      ...cfg.sportRules,
      allowDraws: false,
      allowOvertime: false,
      allowShootout: false,
    },
    expected_sport_revision: le.sport_revision + 1,
  });
  check(
    (await sql("select sport_rules from public.leagues where id=$1", [l]))[0]
      .sport_rules.allowDraws === false,
    "League can configure a no-draw regulation-only policy",
  );
  const extraction = {
    homeTeam: "Synthetic Alpha",
    awayTeam: "Synthetic Beta",
    homeScore: 2,
    awayScore: 2,
    confidence: 1,
    warnings: [],
    players: [],
  };
  await reject(
    () =>
      rpc(admin, l, "confirm_result", {
        sheet_id: randomUUID(),
        reviewed: true,
        extraction,
      }),
    /Tied final scores/,
  );
  await reject(
    () =>
      rpc(admin, l, "confirm_result", {
        sheet_id: randomUUID(),
        reviewed: true,
        extraction: { ...extraction, homeScore: 3, decision: "overtime" },
      }),
    /not allowed/,
  );
  const oldDraft = await launch(admin, "begin_edit", { league_id: l });
  const {
    sport: omittedSport,
    sportRules: omittedRules,
    ...legacyData
  } = oldDraft.data;
  const oldSaved = await launch(admin, "save_draft", {
    id: oldDraft.id,
    league_id: l,
    revision: oldDraft.revision,
    data: legacyData,
  });
  const policyBefore = (
    await sql(
      "select sport,sport_rules,sport_revision from public.leagues where id=$1",
      [l],
    )
  )[0];
  await launch(admin, "finish", {
    id: oldSaved.id,
    revision: oldSaved.revision,
  });
  assert.deepEqual(
    (
      await sql(
        "select sport,sport_rules,sport_revision from public.leagues where id=$1",
        [l],
      )
    )[0],
    policyBefore,
  );
  checks++;
  await reject(
    () =>
      rpc(admin, l, "confirm_result", {
        sheet_id: randomUUID(),
        reviewed: true,
        extraction: { ...extraction, homeScore: 3, decision: "shootout" },
      }),
    /not allowed/,
  );
  console.log(
    `Multi-sport PostgreSQL assertions passed: ${checks}. Synthetic in-memory database; no hosted changes.`,
  );
} finally {
  await db.close();
}
