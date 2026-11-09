// Synthetic, in-memory PostgreSQL. Auth/Storage schemas are contract fixtures,
// not hosted services. Never loads credentials or connects to Supabase.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
export async function initializeTestDatabase(
  db,
  { beforeMigration, baselineCapacity = false } = {},
) {
  await db.exec(
    `
    do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
    end $$;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, aud text, role text, email text unique, email_confirmed_at timestamptz, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'$$;
  `.replace(
      "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
      "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
    ),
  );
  await db.exec(`
    grant usage on schema auth,storage to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,owner_id text,metadata jsonb default '{}',created_at timestamptz default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select on storage.objects to anon;
    grant all on storage.buckets to service_role;
  `);
  for (const file of fs
    .readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      if (beforeMigration) await beforeMigration(db, file);
      await db.exec(
        fs.readFileSync(path.join("supabase/migrations", file), "utf8"),
      );
    } catch (e) {
      throw new Error(`Local migration ${file}: ${e.message}`);
    }
  }
  // Explicit fixture-only capacities for legacy suites creating many leagues.
  // SaaS authorization/quota tests use the real migration defaults instead.
  if (baselineCapacity)
    await db.exec(
      `update public.saas_plans set limits='{"programs":10000,"seasons":10000,"members":10000}'::jsonb`,
    );
  return db;
}
export async function localDatabase(options = {}) {
  return initializeTestDatabase(new PGlite(), options);
}
export async function asUser(db, actor, fn, role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: actor, role }),
    ]);
    await tx.exec(
      `set local role ${role === "service_role" ? "service_role" : role === "anon" ? "anon" : "authenticated"}`,
    );
    return fn(tx);
  });
}
export async function organizer(tx, action, payload = {}) {
  const r = await tx.query(
    "select public.organizer_command($1,$2::jsonb) result",
    [action, JSON.stringify(payload)],
  );
  return r.rows[0].result;
}
