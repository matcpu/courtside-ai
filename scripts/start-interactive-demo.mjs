// Starts only the existing frontend against the already-running synthetic backend.
import fs from "node:fs";
import { spawn } from "node:child_process";
const record = JSON.parse(
  fs.readFileSync(".local/launchpad-preview.json", "utf8"),
);
if (
  record.exitCode !== 0 ||
  record.backend !== "http://127.0.0.1:3302" ||
  record.origin !== "http://127.0.0.1:3301"
)
  throw Error("Existing verified local preview required");
const response = await fetch(record.backend + "/__preview");
if (!response.ok)
  throw Error("Keep the existing synthetic backend running on 3302");
const preview = await response.json();
if (preview.accounts?.admin !== "launchpad-admin@example.invalid")
  throw Error("Wrong backend");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3301",
  ],
  {
    cwd: record.directory,
    env: {
      ...process.env,
      NODE_ENV: "development",
      LAUNCHPAD_LOCAL_PREVIEW: "true",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3302",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-preview-publishable",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-local-storage-service-only",
      ORGANIZER_SETUP_ENABLED: "true",
      NEXT_PUBLIC_ORGANIZER_SETUP_ENABLED: "true",
      META_API_ENABLED: "false",
      NOTIFICATIONS_ENABLED: "false",
      SMS_ENABLED: "false",
    },
    stdio: "inherit",
  },
);
child.on("exit", (code) => (process.exitCode = code));
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
