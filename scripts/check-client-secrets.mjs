import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
const env = existsSync(".env.local") ? parse(readFileSync(".env.local")) : {};
const secrets = ["SUPABASE_SERVICE_ROLE_KEY", "MODEL_API_KEY", "CRON_SECRET"]
  .map((name) => env[name])
  .filter((value) => value && value.length > 16);
function scan(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, item.name);
    if (item.isDirectory()) scan(file);
    else if (secrets.some((secret) => readFileSync(file).includes(secret)))
      throw new Error(
        "A private credential was found in a client artifact. Deployment is blocked; value redacted.",
      );
  }
}
if (existsSync(".next/static")) scan(".next/static");
console.log("Client artifacts contain no configured private credentials.");
