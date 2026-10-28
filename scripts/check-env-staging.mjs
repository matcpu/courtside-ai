import { execFileSync } from "node:child_process";

const args = process.argv.includes("--tracked")
  ? ["ls-files", "-z"]
  : ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"];
const paths = execFileSync("git", args, { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const blocked = paths.filter((path) => {
  const name = path.split("/").at(-1).toLowerCase();
  return (
    ((name === ".env" || name.startsWith(".env.")) &&
      name !== ".env.example") ||
    [".vercel/", ".local/"].some((prefix) =>
      path.toLowerCase().startsWith(prefix),
    )
  );
});
if (blocked.length) {
  console.error("Blocked private environment/configuration files from Git:");
  for (const path of blocked) console.error(path);
  process.exit(1);
}
console.log("Git environment-file guard passed.");
