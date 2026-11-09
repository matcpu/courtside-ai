// Start ONLY the separately built synthetic review frontend. No .env files.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
const record = JSON.parse(
  fs.readFileSync(".local/launchpad-preview-3401.json", "utf8"),
);
const directory = fs.realpathSync(record.directory);
const temporary = fs.realpathSync(os.tmpdir());
if (
  !directory.startsWith(temporary + path.sep) ||
  !path.basename(directory).startsWith("courtside-launchpad-review-") ||
  record.origin !== "http://127.0.0.1:3401" ||
  record.backend !== "http://127.0.0.1:3402" ||
  !fs.existsSync(path.join(directory, ".next", "BUILD_ID"))
)
  throw Error("Expected isolated synthetic build");
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: record.backend,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-preview-publishable",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-local-storage-service-only",
  ORGANIZER_SETUP_ENABLED: "true",
  NEXT_PUBLIC_ORGANIZER_SETUP_ENABLED: "true",
  META_API_ENABLED: "false",
  NOTIFICATIONS_ENABLED: "false",
  SMS_ENABLED: "false",
  LAUNCHPAD_LOCAL_PREVIEW: "false",
};
// Clear inherited provider credentials as well as disabling providers.
for (const key of Object.keys(env))
  if (/^(MODEL_API_KEY|RESEND_API_KEY|TWILIO_|VERCEL_|SUPABASE_DB_)/.test(key))
    delete env[key];
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3401",
  ],
  { cwd: directory, env, stdio: "inherit", windowsHide: true },
);
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
