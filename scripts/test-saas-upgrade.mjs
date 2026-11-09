import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { initializeTestDatabase, asUser } from "./lib/local-database.mjs";
let before,
  tables,
  owned = [],
  revoked,
  ownerless;
const owner = randomUUID(),
  other = randomUUID();
const fingerprints = async (db) => {
  const result = {};
  for (const table of tables) {
    assert.match(table, /^[a-z_]+$/);
    const value =
      table === "leagues"
        ? "to_jsonb(t)-'organization_id'-'program_id'"
        : "to_jsonb(t)";
    result[table] = (
      await db.query(
        `select md5(coalesce(jsonb_agg(r order by r::text),'[]')::text) d from(select ${value} r from public.${table} t) records`,
      )
    ).rows[0].d;
  }
  return result;
};
const db = new PGlite();
try {
  await initializeTestDatabase(db, {
    beforeMigration: async (db, file) => {
      if (!file.endsWith("_organization_saas_foundations.sql")) return;
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-upgrade-owner@example.invalid',now()),($2,'synthetic-former-owner@example.invalid',now())",
        [owner, other],
      );
      const create = (actor, name) =>
        asUser(
          db,
          actor,
          async (tx) =>
            (
              await tx.query(
                "select public.league_command(null,$1,$2::jsonb) r",
                [
                  "create_league",
                  JSON.stringify({
                    name,
                    season: "Synthetic Legacy",
                    cutoff: "2099-01-01",
                  }),
                ],
              )
            ).rows[0].r.id,
        );
      const demo = await asUser(
        db,
        owner,
        async (tx) =>
          (await tx.query("select public.create_demo() r")).rows[0].r.id,
      );
      owned.push(demo);
      for (let n = 0; n < 3; n++)
        owned.push(await create(owner, `Synthetic existing ${n}`));
      revoked = await create(other, "Synthetic revoked ownership");
      await db.query(
        "delete from public.memberships where league_id=$1 and user_id=$2",
        [revoked, other],
      );
      ownerless = await create(other, "Synthetic ownerless reference");
      await db.query("update public.leagues set owner_id=null where id=$1", [
        ownerless,
      ]);
      tables = (
        await db.query(
          "select tablename from pg_tables where schemaname='public' order by tablename",
        )
      ).rows.map((r) => r.tablename);
      before = await fingerprints(db);
    },
  });
  assert.deepEqual(await fingerprints(db), before);
  const groups = (
    await db.query("select id,organization_id,program_id from public.leagues")
  ).rows;
  assert.ok(groups.every((l) => l.organization_id && l.program_id));
  assert.equal(
    new Set(
      groups.filter((l) => owned.includes(l.id)).map((l) => l.organization_id),
    ).size,
    1,
  );
  const o = groups.find((l) => l.id === owned[0]).organization_id;
  const role = await asUser(
    db,
    owner,
    async (tx) =>
      (
        await tx.query("select public.organization_command($1,$2::jsonb) r", [
          "get",
          JSON.stringify({ organization_id: o }),
        ])
      ).rows[0].r,
  );
  assert.equal(role.role, "owner");
  assert.equal(role.limits.seasons, 4);
  assert.equal(role.limits.programs, 4);
  for (const l of [revoked, ownerless]) {
    const id = groups.find((r) => r.id === l).organization_id;
    assert.equal(
      (
        await db.query("select status from public.organizations where id=$1", [
          id,
        ])
      ).rows[0].status,
      "unclaimed",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.organization_members where organization_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
  }
  await assert.rejects(
    () =>
      asUser(db, owner, (tx) =>
        tx.query(
          "select public.league_command(null,'create_league',$1::jsonb)",
          [
            JSON.stringify({
              name: "Synthetic beyond grandfather capacity",
              organization_id: o,
              season: "2099",
              cutoff: "2099-01-01",
            }),
          ],
        ),
      ),
    /Season limit/,
  );
  assert.ok(
    (
      await db.query(
        "select count(*)::int n from public.games where status='confirmed'",
      )
    ).rows[0].n > 0,
  );
  console.log(
    `SaaS legacy upgrade passed: ${tables.length} existing public-table digests unchanged; all season IDs/roles/results retained, active owners grouped, revoked/ownerless cases quarantined, capacity grandfathered without new access.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
