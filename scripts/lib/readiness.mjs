import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
export const origin =
  process.env.E2E_BASE_URL ?? "https://courtside-ai-one.vercel.app";
if (
  !["https://courtside-ai-one.vercel.app", "http://127.0.0.1:3000"].includes(
    origin,
  )
)
  throw new Error("Unexpected readiness target");
export const env = parse(readFileSync(".env.local"));
assert.equal(
  env.NEXT_PUBLIC_SUPABASE_URL,
  "https://xdmkgoradmbnjofmbojs.supabase.co",
);
export function client(key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function actor(account) {
  const db = client();
  const signed = await db.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signed.error || !signed.data.session)
    throw new Error("Readiness sign-in failed; credentials redacted");
  const token = signed.data.session.access_token;
  return {
    client: db,
    id: signed.data.user.id,
    api: async (path, data, method = data ? "POST" : "GET", expected = 200) => {
      const r = await fetch(origin + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: origin,
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
        signal: AbortSignal.timeout(55000),
      }).catch(() => {
        throw new Error("Readiness transport failed; credentials redacted");
      });
      const value = await r.json();
      if (r.status !== expected)
        throw new Error(`${path.split("?")[0]}: ${value.error ?? r.status}`);
      return value;
    },
  };
}
function canonical(value) {
  if (Array.isArray(value))
    return value
      .map(canonical)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export async function publicFingerprint() {
  const list = await (
    await fetch(origin + "/api/league?public=true", { cache: "no-store" })
  ).json();
  assert.ok(Array.isArray(list));
  const snapshots = [];
  for (const league of list) {
    const r = await fetch(`${origin}/api/league?id=${league.id}&public=true`, {
      cache: "no-store",
    });
    assert.ok(r.ok);
    snapshots.push(await r.json());
  }
  return {
    ids: list.map((l) => l.id).sort(),
    digest: createHash("sha256")
      .update(JSON.stringify(canonical({ list, snapshots })))
      .digest("hex"),
  };
}
export async function assertPrivate(actor, id) {
  const s = await actor.api(`/api/league?id=${id}`);
  assert.equal(s.role, "admin");
  const publicAccess = await fetch(
    `${origin}/api/league?id=${id}&public=true`,
    { cache: "no-store" },
  );
  assert.equal(
    publicAccess.status,
    403,
    "Readiness scripts never mutate public leagues",
  );
  return s;
}
