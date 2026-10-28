// Reports paths/object IDs, never matching confidential values. Heuristics are not a PII certification.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
const git = (args, options = {}) =>
  execFileSync("git", args, { maxBuffer: 100 * 1024 * 1024, ...options });
const env = existsSync(".env.local") ? parse(readFileSync(".env.local")) : {};
const privateValues = Object.entries(env)
  .filter(
    ([k, v]) =>
      /API_KEY|SERVICE_ROLE|CRON_SECRET|AUTH_TOKEN|EMAIL_TEST_RECIPIENT/.test(
        k,
      ) &&
      !k.startsWith("NEXT_PUBLIC_") &&
      v.length > 12,
  )
  .map(([, v]) => v);
const records = process.argv.includes("--tracked-only")
  ? git(["ls-files", "-s"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((l) => {
        const m = l.match(/^\d+ (\w+) \d\t(.+)$/);
        return m && { id: m[1], path: m[2] };
      })
      .filter(Boolean)
  : git(["rev-list", "--objects", "--all"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((l) => ({ id: l.split(" ")[0], path: l.slice(l.indexOf(" ") + 1) }));
const findings = [];
for (const r of records)
  if (
    /(^|\/)(\.local|\.vercel)(\/|$)|(^|\/)\.env(?:\..*)?$/.test(r.path) &&
    !r.path.endsWith(".env.example")
  )
    findings.push({ path: r.path, rule: "private-path" });
const ids = [...new Set(records.map((r) => r.id))];
const batch = git(["cat-file", "--batch"], { input: ids.join("\n") + "\n" });
let offset = 0,
  blobs = 0;
while (offset < batch.length) {
  const end = batch.indexOf(10, offset),
    header = batch.subarray(offset, end).toString(),
    [id, type, sizeText] = header.split(" "),
    size = Number(sizeText);
  if (!Number.isSafeInteger(size))
    throw new Error("Repository object scan could not read a complete object");
  const bytes = batch.subarray(end + 1, end + 1 + size);
  offset = end + size + 2;
  if (type !== "blob") continue;
  blobs++;
  const path = records.find((r) => r.id === id)?.path ?? id;
  if (privateValues.some((v) => bytes.includes(Buffer.from(v))))
    findings.push({ path, object: id, rule: "configured-private-value" });
  if (bytes.includes(0)) continue;
  const source = bytes.toString("utf8");
  const patterns = [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    [
      "provider-secret",
      /\b(?:sb_secret_[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/,
    ],
  ];
  for (const [rule, pattern] of patterns)
    if (pattern.test(source)) findings.push({ path, object: id, rule });
  for (const token of source.match(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  ) ?? [])
    try {
      if (
        JSON.parse(Buffer.from(token.split(".")[1], "base64url")).role ===
        "service_role"
      )
        findings.push({ path, object: id, rule: "privileged-jwt" });
    } catch {}
}
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/repository-audit.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope: process.argv.includes("--tracked-only")
        ? "tracked-index"
        : "all-reachable-git-history",
      blobs,
      findings,
      limits:
        "Known private values and common credential formats scanned. Fictional fixture provenance still requires review; this cannot prove arbitrary text contains no personal information.",
    },
    null,
    2,
  ),
);
if (findings.length) {
  console.error(JSON.stringify(findings));
  process.exit(1);
}
console.log(
  `Repository audit passed: ${blobs} blobs; private paths, configured private values and common credential formats absent. Synthetic-data provenance is separately reviewed.`,
);
