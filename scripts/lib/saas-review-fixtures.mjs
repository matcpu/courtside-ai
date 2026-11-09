// Ephemeral loopback review only. Never imported by application routes.
import { asUser } from "./local-database.mjs";
export async function saasReviewFixtures(db, admin, coach, outsider) {
  const org = (actor, action, p = {}) =>
    asUser(
      db,
      actor.id,
      async (tx) =>
        (
          await tx.query("select public.organization_command($1,$2::jsonb) r", [
            action,
            JSON.stringify(p),
          ])
        ).rows[0].r,
    );
  const a = (
    await org(admin, "create", { name: "Synthetic Demo Organization" })
  ).id;
  const b = (
    await org(outsider, "create", { name: "Synthetic Separate Organization" })
  ).id;
  const program = (
    await org(admin, "create_program", {
      organization_id: a,
      name: "Synthetic Hockey Club",
    })
  ).program_id;
  const season = (
    await asUser(
      db,
      admin.id,
      async (tx) =>
        (
          await tx.query("select public.league_command(null,$1,$2::jsonb) r", [
            "create_league",
            JSON.stringify({
              name: "Synthetic Private Hockey",
              season: "Synthetic 2099",
              cutoff: "2099-01-01",
              sport: "hockey",
              organization_id: a,
              program_id: program,
            }),
          ])
        ).rows[0].r,
    )
  ).id;
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'member')",
    [a, coach.id],
  );
  await db.query(
    "insert into public.platform_administrators(user_id) values($1)",
    [admin.id],
  );
  // Restore actual seeded capacities after the separate legacy review fixture.
  await db.query(
    'update public.saas_plans set limits=case code when \'free\' then \'{"programs":3,"seasons":3,"members":3}\'::jsonb when \'starter\' then \'{"programs":20,"seasons":20,"members":15}\'::jsonb else \'{"programs":100,"seasons":100,"members":100}\'::jsonb end',
  );
  return { organization: a, foreign: b, program, season };
}
