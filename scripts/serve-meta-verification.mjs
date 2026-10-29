// Local-only launcher for the owner's single bounded synthetic verification.
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { spawn } from "node:child_process";
if (!process.argv.includes("--credits-confirmed"))
  throw Error(
    "Owner credit confirmation and bounded usage authorization are required",
  );
const config = parse(readFileSync(".env.local")),
  fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
if (config.META_API_ENABLED !== "false" || !fixture.synthetic)
  throw Error(
    "Keep saved and deployed inference disabled; use only the private synthetic fixture",
  );
const scope = {
  placement: {
    actor: fixture.accounts.coach.id,
    league: fixture.preseason.league,
  },
  scoresheet: {
    actor: fixture.accounts.admin.id,
    league: fixture.operations.league,
  },
  operations: {
    actor: fixture.accounts.admin.id,
    league: fixture.operations.league,
  },
};
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...config,
      META_API_ENABLED: "true",
      META_CONTROLLED_RUN: fixture.run,
      META_CONTROLLED_SCOPE: JSON.stringify(scope),
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
