import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parse } from "dotenv";
let raw = readFileSync(".env.local", "utf8");
const env = parse(raw);
if (
  env.NEXT_PUBLIC_SUPABASE_URL !== "https://xdmkgoradmbnjofmbojs.supabase.co" ||
  env.META_API_ENABLED !== "false"
)
  throw new Error("Expected Courtside project with Meta disabled");
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
    "xdmkgoradmbnjofmbojs",
    "--reveal",
    "--output",
    "json",
  ],
  { encoding: "utf8", maxBuffer: 200000 },
);
if (result.status !== 0)
  throw new Error(
    "Authenticated Supabase configuration unavailable; credentials redacted",
  );
let keys;
try {
  const value = JSON.parse(result.stdout);
  keys = Array.isArray(value) ? value : (value.keys ?? value.data ?? []);
} catch {
  throw new Error("Invalid configuration response; credentials redacted");
}
const entry =
    keys.find((k) => k.name === "service_role") ??
    keys.find((k) => k.type === "secret" && !k.disabled),
  key = entry?.api_key ?? entry?.key;
if (!key) throw new Error("Server-only storage credential unavailable");
const secret = env.CRON_SECRET || randomBytes(32).toString("base64url");
for (const [name, value] of [
  ["SUPABASE_SERVICE_ROLE_KEY", key],
  ["CRON_SECRET", secret],
]) {
  raw = raw.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, "m"), "");
  raw += `\n${name}=${value}\n`;
}
writeFileSync(".env.local", raw);
console.log(
  "Configured server-only private Storage bridge and retention secret locally. Meta remains disabled.",
);
if (process.argv.includes("--vercel")) {
  const vc = join(
    process.env.APPDATA,
    "npm",
    "node_modules",
    "vercel",
    "dist",
    "vc.js",
  );
  for (const [name, value] of [
    ["SUPABASE_SERVICE_ROLE_KEY", key],
    ["CRON_SECRET", secret],
  ]) {
    const saved = spawnSync(
      process.execPath,
      [
        vc,
        "env",
        "add",
        name,
        "--environment",
        "production,preview",
        "--scope",
        "matcpus-projects",
        "--yes",
        "--force",
        "--sensitive",
      ],
      { input: value, encoding: "utf8", shell: false },
    );
    if (saved.status !== 0)
      throw new Error(`Could not save ${name}; provider output redacted`);
    console.log(`Configured ${name} as a Vercel Secret.`);
  }
}
