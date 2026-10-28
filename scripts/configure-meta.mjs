import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";

// The saved secret stays in memory and is sent to Vercel through stdin only.
// This script never calls Meta and never enables billable model requests.
const env = parse(readFileSync(".env.local"));
const key = env.MODEL_API_KEY?.trim();
if (!key) {
  console.error("MODEL_API_KEY is empty. Save the key in Notepad first.");
  process.exit(1);
}
if (env.META_API_ENABLED !== "false") {
  console.error("Keep META_API_ENABLED=false while credits are pending.");
  process.exit(1);
}
const cli = join(
  process.env.APPDATA,
  "npm",
  "node_modules",
  "vercel",
  "dist",
  "vc.js",
);
for (const [name, value, sensitive] of [
  ["META_API_ENABLED", "false", false],
  ["MODEL_API_KEY", key, true],
  ["META_MODEL", env.META_MODEL || "muse-spark-1.3", false],
]) {
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
      "--force",
      sensitive ? "--sensitive" : "--no-sensitive",
    ],
    { input: value, encoding: "utf8", shell: false },
  );
  if (result.error || result.status !== 0) {
    console.error(
      `Vercel could not configure ${name}; no secret output was displayed.`,
    );
    process.exit(1);
  }
  console.log(
    `Configured ${name} in production and preview${sensitive ? " as a secret" : ""}.`,
  );
}
console.log("Meta is prepared but disabled. No Meta API calls were made.");
