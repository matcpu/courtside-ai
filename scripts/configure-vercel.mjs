import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { join } from "node:path";
config({ path: ".env.local", quiet: true });
// Pass values through stdin. Never print credentials or put them in process arguments.
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "META_MODEL",
  "NOTIFICATIONS_ENABLED",
  "SMS_ENABLED",
  "MODEL_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
]) {
  const value = process.env[name];
  if (!value) continue;
  const cli = join(
    process.env.APPDATA,
    "npm",
    "node_modules",
    "vercel",
    "dist",
    "vc.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "env",
      "add",
      name,
      "--environment",
      "production,preview",
      "--scope",
      "matcpus-projects",
      "--yes",
      name.startsWith("NEXT_PUBLIC_") ? "--no-sensitive" : "--sensitive",
    ],
    { input: value, encoding: "utf8", shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(
      `Failed to configure ${name}; inspect Vercel environment settings.`,
    );
    process.exit(1);
  }
  console.log(`Configured ${name}`);
}
