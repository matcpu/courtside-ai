import assert from "node:assert/strict";
import fs from "node:fs";
export async function assertTestSchema(db) {
  const files = fs
    .readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const versions = files.map((f) => f.split("_")[0]);
  assert.equal(new Set(versions).size, versions.length);
  assert.equal(
    files.filter((f) => f.endsWith("_organizer_launchpad.sql")).length,
    1,
  );
  assert.ok(
    files.indexOf("20261104164024_organizer_launchpad.sql") <
      files.indexOf("20261104183226_preseason_document_policy.sql"),
  );
  assert.equal(
    fs.existsSync("supabase/proposals/organizer_launchpad.sql"),
    false,
  );
  const tables = [
    "organizer_drafts",
    "league_launch",
    "launch_site_versions",
    "member_invitations",
  ];
  let checks = 4;
  for (const table of tables) {
    assert.equal(
      (
        await db.query(
          "select relrowsecurity r from pg_class where oid=$1::regclass",
          ["public." + table],
        )
      ).rows[0].r,
      true,
    );
    checks++;
    assert.equal(
      (
        await db.query(
          "select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') p",
          ["public." + table],
        )
      ).rows[0].p,
      false,
    );
    checks++;
  }
  const privileges = (
    await db.query(`select
    has_function_privilege('anon','public.organizer_command(text,jsonb)','EXECUTE') anon_write,
    has_function_privilege('authenticated','public.organizer_command(text,jsonb)','EXECUTE') auth_rpc,
    has_function_privilege('anon','public.public_launch_site(text)','EXECUTE') public_site,
    has_function_privilege('authenticated','private.organizer_safety_snapshot(uuid)','EXECUTE') direct_snapshot,
    has_table_privilege('anon','public.organizer_drafts','SELECT') anon_draft`)
  ).rows[0];
  assert.deepEqual(privileges, {
    anon_write: false,
    auth_rpc: true,
    public_site: true,
    direct_snapshot: false,
    anon_draft: false,
  });
  checks++;
  const funcs = (
    await db.query(
      "select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('organizer_command','organizer_safety_snapshot')) or(n.nspname='public' and p.proname='organizer_command') order by n.nspname,p.proname",
    )
  ).rows;
  assert.equal(funcs.length, 3);
  checks++;
  assert.deepEqual(
    funcs.map((f) => f.prosecdef),
    [true, false, false],
  );
  checks++;
  assert.ok(funcs.every((f) => f.proconfig?.includes('search_path=""')));
  checks++;
  return checks;
}
