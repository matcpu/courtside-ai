import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
const env = existsSync(".env.local") ? parse(readFileSync(".env.local")) : {};
const secrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "MODEL_API_KEY",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "EMAIL_TEST_RECIPIENT",
]
  .map((name) => env[name])
  .filter((value) => value && value.length > 16);
function scan(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, item.name);
    if (statSync(file).isDirectory()) scan(file);
    else if (secrets.some((secret) => readFileSync(file).includes(secret)))
      throw new Error(
        "A private credential was found in a client artifact. Deployment is blocked; value redacted.",
      );
  }
}
if (process.argv.includes("--live-origin")) {
  const origin = "https://courtside-ai-one.vercel.app",
    urls = new Set();
  for (const path of ["/", "/verify"]) {
    const r = await fetch(origin + path);
    if (!r.ok) throw new Error("Unable to inspect deployed client");
    const html = await r.text();
    if (secrets.some((s) => html.includes(s)))
      throw new Error("Private value in deployed HTML; value redacted");
    for (const m of html.matchAll(
      /(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g,
    )) {
      const url = new URL(m[1], origin);
      if (url.origin === origin && url.pathname.startsWith("/_next/static/"))
        urls.add(url.href);
    }
  }
  for (const url of urls) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Unable to inspect deployed client asset");
    const data = await r.text();
    if (secrets.some((s) => data.includes(s)))
      throw new Error("Private value in deployed client asset; value redacted");
  }
  console.log(
    `Inspected ${urls.size} deployed client assets and both entry pages.`,
  );
} else if (existsSync(".next/static")) scan(".next/static");
console.log("Client artifacts contain no configured private credentials.");
