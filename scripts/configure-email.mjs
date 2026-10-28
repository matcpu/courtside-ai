import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
const env = parse(readFileSync(".env.local"));
if (
  env.META_API_ENABLED !== "false" ||
  env.EMAIL_DELIVERY_MODE !== "test" ||
  !env.EMAIL_TEST_RECIPIENT ||
  !env.RESEND_API_KEY ||
  env.RESEND_FROM !== "COURTSIDE AI Test <onboarding@resend.dev>"
)
  throw new Error(
    "Expected disabled Meta and authorized private Resend test configuration",
  );
if (process.argv.includes("--vercel")) {
  const linked = JSON.parse(readFileSync(".vercel/project.json"));
  if (
    linked.projectId !== "prj_JASWQ1rQPlbrEUHAEqX7l7R0b1p8" ||
    linked.orgId !== "team_FlYfAmtHUOI768FAwl7j59h8"
  )
    throw new Error("Unexpected Vercel project");
  const vc = join(process.env.APPDATA, "npm/node_modules/vercel/dist/vc.js");
  for (const name of [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "EMAIL_DELIVERY_MODE",
    "EMAIL_TEST_RECIPIENT",
    "NOTIFICATIONS_ENABLED",
  ]) {
    const value = name === "NOTIFICATIONS_ENABLED" ? "true" : env[name];
    const r = spawnSync(
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
      { input: value, encoding: "utf8" },
    );
    if (r.status)
      throw new Error(`Could not configure ${name}; provider output redacted`);
    console.log(`Configured ${name} privately for restricted test delivery.`);
  }
}
if (
  process.argv.includes("--prepare-smtp") ||
  process.argv.includes("--apply-smtp")
) {
  mkdirSync(".local/smtp-only/supabase", { recursive: true });
  // Config push only changes explicitly declared properties. Review its diff first.
  const config = `project_id = "courtside-auth-readiness"\n[auth]\nadditional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000", "https://courtside-ai-matcpus-projects.vercel.app", "https://courtside-ai-one.vercel.app"]\n[auth.email.smtp]\nenabled = true\nhost = "smtp.resend.com"\nport = 465\nuser = "resend"\npass = "env(RESEND_API_KEY)"\nadmin_email = "onboarding@resend.dev"\nsender_name = "COURTSIDE AI Test"\n`;
  writeFileSync(".local/smtp-only/supabase/config.toml", config);
  const cli = join(process.cwd(), "node_modules/supabase/dist/supabase.js");
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "config",
      "diff",
      "--project-ref",
      "xdmkgoradmbnjofmbojs",
      "--workdir",
      ".local/smtp-only",
      "--output-format",
      "json",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, RESEND_API_KEY: env.RESEND_API_KEY },
    },
  );
  writeFileSync(".local/smtp-only/diff.json", r.stdout);
  if (r.status)
    throw new Error("SMTP diff failed; private diagnostic retained");
  const diff = JSON.parse(r.stdout);
  if (
    diff.target?.project_ref !== "xdmkgoradmbnjofmbojs" ||
    diff.changes.some(
      (c) =>
        c.declared &&
        !(
          c.path.join(".").startsWith("auth.email.smtp.") ||
          c.path.join(".") === "auth.additional_redirect_urls"
        ),
    )
  )
    throw new Error("Unexpected configuration change; SMTP push blocked");
  console.log(
    "SMTP and stable redirect changes prepared. Review the private diff before applying.",
  );
  if (process.argv.includes("--apply-smtp")) {
    const pushed = spawnSync(
      process.execPath,
      [
        cli,
        "config",
        "push",
        "--project-ref",
        "xdmkgoradmbnjofmbojs",
        "--workdir",
        ".local/smtp-only",
        "--yes",
        "--output-format",
        "json",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, RESEND_API_KEY: env.RESEND_API_KEY },
      },
    );
    writeFileSync(".local/smtp-only/push.json", pushed.stdout);
    if (pushed.status)
      throw new Error("SMTP push failed; diagnostics retained privately");
    console.log(
      "Applied testing SMTP and stable redirect allowlist only. Email confirmations remain required.",
    );
  }
}
