import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const project = "xdmkgoradmbnjofmbojs";
const env = parse(readFileSync(".env.local"));
if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`)
  throw new Error("Unexpected database target");
if (env.META_API_ENABLED !== "false")
  throw new Error("Meta must remain disabled during the audit");
const cli = join(
  process.cwd(),
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const result = spawnSync(
  process.execPath,
  [
    cli,
    "projects",
    "api-keys",
    "--project-ref",
    project,
    "--reveal",
    "--output",
    "json",
  ],
  { encoding: "utf8", maxBuffer: 200000 },
);
if (result.status !== 0)
  throw new Error(
    "Authenticated Supabase CLI could not retrieve test-setup access; no credentials displayed",
  );
let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch {
  throw new Error("Unexpected CLI response; credentials were not displayed");
}
const keys = Array.isArray(parsed)
  ? parsed
  : (parsed.keys ?? parsed.data ?? []);
const entry =
  keys.find((k) => k.name === "service_role") ??
  keys.find((k) => k.type === "secret" && !k.disabled);
const secret = entry?.api_key ?? entry?.key;
if (!secret)
  throw new Error(
    "No administrative test-setup key available; no values displayed",
  );
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
mkdirSync(".local", { recursive: true });
const path = ".local/live-audit.json";
const state = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : {
      run: randomBytes(5).toString("hex"),
      accounts: {},
      createdAt: new Date().toISOString(),
    };
for (const role of [
  "admin",
  "coach",
  "outsider",
  "desktop_admin",
  "desktop_coach",
  "mobile_admin",
  "mobile_coach",
  "desktop_preseason_admin",
  "desktop_preseason_coach",
  "mobile_preseason_admin",
  "mobile_preseason_coach",
]) {
  if (state.accounts[role]) continue;
  const password = randomBytes(32).toString("base64url");
  const email = `audit-${state.run}-${role}@courtside.example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic: true, audit_run: state.run },
  });
  if (error)
    throw new Error(
      `Could not create synthetic ${role} account (${error.status ?? "provider error"})`,
    );
  state.accounts[role] = { id: data.user.id, email, password };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log(`Created isolated synthetic ${role} account.`);
}
// This file contains only synthetic account credentials; the service key is never persisted.
writeFileSync(path, JSON.stringify(state, null, 2));
console.log(
  "Audit accounts prepared with the supported Auth Admin API. No Meta calls or real emails sent.",
);
