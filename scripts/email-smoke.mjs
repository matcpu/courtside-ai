// Explicitly authorized controlled-recipient test only. No Meta request is made.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
const env = parse(readFileSync(".env.local"));
if (!process.argv.includes("--send-authorized-test"))
  throw new Error("An explicit controlled-delivery flag is required");
if (
  env.META_API_ENABLED !== "false" ||
  env.EMAIL_DELIVERY_MODE !== "test" ||
  env.RESEND_FROM !== "COURTSIDE AI Test <onboarding@resend.dev>" ||
  !env.EMAIL_TEST_RECIPIENT ||
  !env.RESEND_API_KEY
)
  throw new Error(
    "Expected disabled Meta and privately configured testing sender/recipient",
  );
mkdirSync(".local", { recursive: true });
const file = ".local/email-readiness.json";
const report = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { run: randomUUID(), synthetic: true, createdAt: new Date().toISOString() };
if (report.smoke?.id) {
  console.log(
    "Existing test accepted; inspect its Gmail receipt rather than sending duplicates.",
  );
  process.exit(0);
}
const subject = `COURTSIDE AI controlled delivery ${report.run.slice(0, 8)}`;
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": `courtside-smoke-${report.run}`,
  },
  body: JSON.stringify({
    from: env.RESEND_FROM,
    to: [env.EMAIL_TEST_RECIPIENT],
    subject,
    text: "This is your authorized COURTSIDE AI hackathon delivery test. Only synthetic league information is used. Meta inference remains disabled. No actual coaches or parents were contacted. This message verifies transport; receipt must also be checked in the authorized inbox.",
  }),
  signal: AbortSignal.timeout(15000),
});
const value = await response.json();
if (!response.ok)
  throw new Error(
    `Resend testing delivery failed (${response.status}; ${value.name ?? "provider error"}). No credentials displayed.`,
  );
if (!value.id) throw new Error("No provider receipt returned");
report.smoke = {
  id: value.id,
  subject,
  acceptedAt: new Date().toISOString(),
  inboxReceipt: "pending",
};
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(
  `Test email accepted by Resend. Subject: ${subject}. Gmail receipt is still pending verification.`,
);
