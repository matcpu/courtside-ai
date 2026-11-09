// Apply the new migration over an existing synthetic reference league and prove
// every old public-table value survives. No real project connection or env files.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { initializeTestDatabase, asUser } from "./lib/local-database.mjs";
import { defaultSportRules } from "../src/lib/sports.ts";
let before;
const fingerprint = async (db) => {
  const tables = (
    await db.query(
      "select tablename from pg_tables where schemaname='public' and tablename<>'sport_rule_revisions' order by tablename",
    )
  ).rows.map((r) => r.tablename);
  const result = {};
  for (const table of tables) {
    assert.match(table, /^[a-z_]+$/);
    const value =
      table === "leagues"
        ? "to_jsonb(t)-'sport'-'sport_rules'-'sport_revision'"
        : table === "games"
          ? "to_jsonb(t)-'decision'-'result_rules'-'result_sport_revision'"
          : "to_jsonb(t)";
    result[table] = (
      await db.query(
        `select md5(coalesce(jsonb_agg(r order by r::text),'[]')::text) digest from (select ${value} r from public.${table} t) rows`,
      )
    ).rows[0].digest;
  }
  return result;
};
const db = new PGlite();
try {
  await initializeTestDatabase(db, {
    beforeMigration: async (tx, file) => {
      if (!file.endsWith("_sport_rules.sql")) return;
      const actor = randomUUID();
      await tx.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,'upgrade-synthetic@example.invalid',now())",
        [actor],
      );
      await asUser(tx, actor, (t) => t.query("select public.create_demo()"));
      before = await fingerprint(tx);
    },
  });
  assert.ok(before);
  assert.deepEqual(await fingerprint(db), before);
  const leagues = (
    await db.query("select sport,sport_rules from public.leagues")
  ).rows;
  assert.ok(leagues.length > 0);
  for (const le of leagues) {
    assert.equal(le.sport, "basketball");
    assert.deepEqual(le.sport_rules, defaultSportRules());
  }
  assert.ok(
    (
      await db.query(
        "select count(*)::int n from public.games where status='confirmed'",
      )
    ).rows[0].n > 0,
  );
  console.log(
    `Upgrade preservation passed: ${Object.keys(before).length} existing table digests unchanged; existing synthetic official results retained with basketball defaults.`,
  );
} finally {
  await db.close();
}
