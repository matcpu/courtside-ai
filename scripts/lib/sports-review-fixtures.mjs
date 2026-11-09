// Only imported by the loopback contract adapter when explicitly requested.
import { randomUUID } from "node:crypto";
import { asUser, organizer } from "./local-database.mjs";
import { newSetup } from "../../src/lib/launchpad.ts";
import { defaultSportRules } from "../../src/lib/sports.ts";
export async function sportsReviewFixtures(db, admin, coach, label = "") {
  const result = {};
  for (const sport of ["basketball", "hockey"]) {
    const command = (l, action, p) =>
      asUser(
        db,
        admin.id,
        async (tx) =>
          (
            await tx.query("select public.league_command($1,$2,$3::jsonb) r", [
              l,
              action,
              JSON.stringify(p),
            ])
          ).rows[0].r,
      );
    const cfg = {
      ...newSetup(),
      sport,
      sportRules: defaultSportRules(sport),
      name: `Synthetic ${sport} Review ${label}`,
      season: "Synthetic Sport Review 2099",
      city: "Toronto",
      start: "2099-05-01",
      end: "2099-06-30",
      opening: "2099-05-02",
      cutoff: "2099-01-01",
      registrationDeadline: "2099-04-01",
      rosterDeadline: "2099-04-15",
      verificationDeadline: "2099-04-30",
      allowedDocumentTypes: ["passport"],
      courts: [
        {
          name: sport === "hockey" ? "Synthetic Rink" : "Synthetic Court",
          venue: "Synthetic Sports Centre",
        },
      ],
    };
    const d = await asUser(db, admin.id, (tx) =>
      organizer(tx, "save_draft", { id: null, league_id: null, data: cfg }),
    );
    const l = (
      await asUser(db, admin.id, (tx) =>
        organizer(tx, "finish", { id: d.id, revision: d.revision }),
      )
    ).league_id;
    const teams = [];
    for (const name of ["Synthetic Alpha", "Synthetic Beta"]) {
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
        notes: "Synthetic assessment",
      };
      const t = await asUser(
        db,
        admin.id,
        async (tx) =>
          (
            await tx.query(
              "select public.preseason_command($1,$2,$3::jsonb) r",
              [
                l,
                "save_questionnaire",
                JSON.stringify({ name, data: q, submit: true }),
              ],
            )
          ).rows[0].r,
      );
      await command(l, "approve_team", {
        team_id: t.team_id,
        tier: 2,
        override_reason: "Synthetic placement acceptance review",
      });
      teams.push(t.team_id);
    }
    // This fixture isolates scores from age-document tests. It is explicitly
    // legacy readiness mode, not a manufactured document-verification decision.
    await db.query(
      "update public.preseason_settings set enabled=false where league_id=$1",
      [l],
    );
    await db.query(
      "insert into public.memberships(league_id,user_id,role) values($1,$2,'coach')",
      [l, coach.id],
    );
    await db.query(
      "update public.teams set coach_id=$1,coach_email=$2 where id=$3",
      [coach.id, coach.email, teams[0]],
    );
    const court = (
      await db.query("select id from public.courts where league_id=$1", [l])
    ).rows[0].id;
    await command(l, "add_availability", {
      court_id: court,
      starts_at: "2099-05-02T12:00:00Z",
      ends_at: "2099-05-02T17:00:00Z",
    });
    const s = (
      await asUser(db, admin.id, (tx) =>
        tx.query("select public.league_snapshot($1,false) s", [l]),
      )
    ).rows[0].s;
    const game_id = randomUUID();
    const v = await command(l, "draft_schedule", {
      base_revision: s.league.revision,
      data_revision: s.league.data_revision,
      explanation: "Synthetic browser acceptance fixture",
      fixtures: [
        {
          game_id,
          home_team_id: teams[0],
          away_team_id: teams[1],
          court_id: court,
          starts_at: "2099-05-02T12:00:00Z",
          ends_at: "2099-05-02T13:00:00Z",
        },
      ],
    });
    await command(l, "publish_schedule", { version_id: v.id });
    // Move ONLY the isolated test clock/fixture, never the recording database.
    await db.query(
      "update public.fixtures set starts_at=starts_at-interval '100 years',ends_at=ends_at-interval '100 years' where league_id=$1",
      [l],
    );
    const slug = (
      await db.query("select slug from public.leagues where id=$1", [l])
    ).rows[0].slug;
    result[sport] = { id: l, slug, game_id, teams };
  }
  return result;
}
