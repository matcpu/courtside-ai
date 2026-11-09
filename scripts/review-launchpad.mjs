// Reproducible local review. Never reads .env.local or deploys infrastructure.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
if (process.argv.includes("--help")) {
  console.log(
    "node scripts/review-launchpad.mjs [--build-only]\nBuilds an isolated local synthetic preview. Default: also runs the adapter on 3302 and Next on 3301. Ctrl+C stops only its own children.",
  );
  process.exit(0);
}
const root = process.cwd(),
  reviewPort = Number(process.env.LAUNCHPAD_REVIEW_FRONTEND_PORT ?? 3301),
  backendPort = Number(process.env.LAUNCHPAD_REVIEW_BACKEND_PORT ?? 3302),
  record = path.join(
    root,
    ".local",
    reviewPort === 3301
      ? "launchpad-preview.json"
      : `launchpad-preview-${reviewPort}.json`,
  );
if (
  ![reviewPort, backendPort].every(
    (p) => Number.isInteger(p) && p >= 1024 && p <= 65535,
  )
)
  throw Error("Invalid loopback review ports");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "courtside-launchpad-review-"),
);
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter(
    (p) =>
      !p.startsWith(".env") &&
      !p.startsWith(".local/") &&
      !p.startsWith(".vercel/"),
  );
for (const file of files) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
// A physical dependency copy keeps Turbopack resolution inside its workspace root.
fs.cpSync(
  path.join(root, "node_modules"),
  path.join(directory, "node_modules"),
  { recursive: true, dereference: true },
);
const organizerFlag = process.env.LAUNCHPAD_REVIEW_ORGANIZER_ENABLED ?? "true";
if (!["true", "false"].includes(organizerFlag))
  throw Error("Invalid local review organizer flag");
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
  LAUNCHPAD_REVIEW_BACKEND_PORT: String(backendPort),
  LAUNCHPAD_REVIEW_FRONTEND_PORT: String(reviewPort),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-preview-publishable",
  ORGANIZER_SETUP_ENABLED: organizerFlag,
  NEXT_PUBLIC_ORGANIZER_SETUP_ENABLED: organizerFlag,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-local-storage-service-only",
  META_API_ENABLED: "false",
  NOTIFICATIONS_ENABLED: "false",
  SMS_ENABLED: "false",
};
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: directory,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Local preview check failed")),
    );
  });
await run(["node_modules/next/dist/bin/next", "typegen"]);
await run(["node_modules/typescript/bin/tsc", "--noEmit"]);
await run(["node_modules/next/dist/bin/next", "build"]);
fs.mkdirSync(path.dirname(record), { recursive: true });
fs.writeFileSync(
  record,
  JSON.stringify({
    directory,
    origin: `http://127.0.0.1:${reviewPort}`,
    backend: `http://127.0.0.1:${backendPort}`,
    exitCode: 0,
    organizerEnabled: organizerFlag,
  }),
);
if (!process.argv.includes("--build-only")) {
  const backend = spawn(
    process.execPath,
    [path.join(root, "scripts/preview-launchpad.mjs")],
    { cwd: root, env, stdio: "inherit" },
  );
  const next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(reviewPort),
    ],
    { cwd: directory, env, stdio: "inherit" },
  );
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    backend.kill();
    next.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  backend.on("exit", stop);
  next.on("exit", stop);
}
