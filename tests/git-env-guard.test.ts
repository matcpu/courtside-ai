import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const directories: string[] = [];
const guard = fileURLToPath(
  new URL("../scripts/check-env-staging.mjs", import.meta.url),
);
afterEach(() => {
  for (const directory of directories.splice(0)) {
    const rel = relative(resolve(tmpdir()), resolve(directory));
    if (
      isAbsolute(rel) ||
      rel.startsWith("..") ||
      !rel.startsWith("courtside-env-guard-")
    )
      throw new Error(
        "Refusing to remove a path outside this test's temporary directories",
      );
    rmSync(directory, { recursive: true, force: true });
  }
});
function repository(filename: string) {
  const directory = mkdtempSync(join(tmpdir(), "courtside-env-guard-"));
  directories.push(directory);
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  writeFileSync(join(directory, ".gitignore"), ".env*\n!.env.example\n");
  mkdirSync(dirname(join(directory, filename)), { recursive: true });
  writeFileSync(join(directory, filename), "MODEL_API_KEY=\n");
  execFileSync("git", ["add", "--force", filename], { cwd: directory });
  return spawnSync(process.execPath, [guard], {
    cwd: directory,
    encoding: "utf8",
  });
}
describe("environment commit protection with a real Git index", () => {
  it("blocks even a force-added .env.local", () => {
    const result = repository(".env.local");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.local");
  });
  it("allows the empty .env.example template", () => {
    expect(repository(".env.example").status).toBe(0);
  });
  it("blocks force-added private audit credentials", () => {
    expect(repository(".local/live-audit.json").status).toBe(1);
  });
});
