// Run with node --import tsx. The recipient is read privately; never redirect other people's mail.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  actor,
  env,
  origin,
  publicFingerprint,
  assertPrivate,
} from "./lib/readiness.mjs";
import { dispatch } from "../src/lib/notifications.ts";
assert.equal(env.META_API_ENABLED, "false");
assert.equal(env.EMAIL_DELIVERY_MODE, "test");
assert.ok(env.EMAIL_TEST_RECIPIENT && env.RESEND_API_KEY);
Object.assign(process.env, env, { NOTIFICATIONS_ENABLED: "true" });
const health = await (await fetch(origin + "/api/health")).json();
assert.equal(health.meta, false);
assert.equal(health.emailMode, "test");
assert.equal(health.email, true);
const file = ".local/email-readiness.json",
  report = JSON.parse(readFileSync(file));
assert.equal(
  report.smoke.inboxReceipt,
  "verified",
  "Actual smoke-test inbox receipt must be checked first",
);
const fixture = JSON.parse(readFileSync(".local/demo-manifest.json"));
const admin = await actor(fixture.accounts.admin),
  coach = await actor(fixture.accounts.coach);
const signup = JSON.parse(readFileSync(".local/signup-test.json"));
assert.equal(signup.email, env.EMAIL_TEST_RECIPIENT);
await actor(signup); // Real confirmed password sign-in; no administrative confirmation bypass.
const baseline = await publicFingerprint();
const save = () => writeFileSync(file, JSON.stringify(report, null, 2));
const core = (league, action, payload = {}) =>
  admin.api("/api/league", { league, action, payload });
if (process.argv.includes("--prepare-retry")) {
  assert.ok(
    !report.notification,
    "Existing notification test found; use --retry rather than duplicate sends",
  );
  const league = (await admin.api("/api/demo", {})).id;
  let s = await assertPrivate(admin, league);
  await core(league, "invite_member", { email: signup.email, role: "coach" });
  const team = s.teams.find((t) => t.name === "Eastside Eagles");
  await core(league, "assign_coach", { team_id: team.id, email: signup.email });
  const draft = await admin.api("/api/schedule", {
    league,
    round: 0,
    useMeta: false,
  });
  // Use the real authorized database command to queue before the app's after-response dispatcher.
  const published = await admin.client.rpc("league_command", {
    p_league: league,
    p_action: "publish_schedule",
    p_payload: { version_id: draft.id },
  });
  assert.equal(published.error, null);
  s = await assertPrivate(admin, league);
  const target = s.notifications.find(
    (n) => n.channel === "email" && n.destination === env.EMAIL_TEST_RECIPIENT,
  );
  assert.ok(target);
  // Controlled network fault, NOT a claim of an observed Resend outage. No provider request yet.
  for (let batch = 0; batch < 8; batch++) {
    await dispatch(admin.client, league, async () => {
      throw new Error("Controlled network fault before provider send");
    });
    s = await assertPrivate(admin, league);
    if (s.notifications.find((n) => n.id === target.id)?.status === "failed")
      break;
  }
  const failed = s.notifications.find((n) => n.id === target.id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempts, 1);
  assert.equal(failed.provider_id, null);
  report.notification = {
    league,
    id: target.id,
    team: team.id,
    version: draft.id,
    subject: target.subject,
    controlledFault: true,
    retryAt: failed.next_attempt_at,
    status: failed.status,
    inboxReceipt: "pending",
  };
  save();
  console.log(
    "Real synthetic outbox persisted the controlled pre-send failure and backoff. No provider outage was simulated as a live result. Run --retry after its recorded due time.",
  );
}
if (process.argv.includes("--retry")) {
  const item = report.notification;
  assert.ok(item);
  let s = await assertPrivate(admin, item.league),
    n = s.notifications.find((n) => n.id === item.id);
  if (n.status !== "accepted") {
    assert.ok(
      +new Date(n.next_attempt_at) <= Date.now(),
      "Retry is not due yet; no provider request made",
    );
    for (let i = 0; i < 8; i++) {
      await admin.api("/api/notifications", { league: item.league });
      s = await assertPrivate(admin, item.league);
      n = s.notifications.find((n) => n.id === item.id);
      if (n.status === "accepted") break;
    }
  }
  assert.equal(n.status, "accepted");
  assert.equal(n.attempts, 2);
  assert.ok(n.provider_id);
  item.status = n.status;
  item.attempts = n.attempts;
  item.providerId = n.provider_id;
  item.acceptedAt = new Date().toISOString();
  save();
  // A duplicate dispatch must not send this accepted logical event again.
  await admin.api("/api/notifications", { league: item.league });
  const again = (await assertPrivate(admin, item.league)).notifications.find(
    (r) => r.id === item.id,
  );
  assert.equal(again.attempts, 2);
  assert.equal(again.provider_id, n.provider_id);
  item.noDuplicateOnRedispatch = true;
  save();
  console.log(
    "Actual Resend acceptance followed the durable retry; repeated dispatch did not duplicate it. Verify the schedule message in Gmail.",
  );
}
if (process.argv.includes("--guardian-invitation")) {
  assert.ok(
    !report.guardianInvitation,
    "Existing invitation email found; inspect it instead of resending",
  );
  await assertPrivate(admin, fixture.preseason.league);
  const result = await coach.api("/api/preseason", {
    league: fixture.preseason.league,
    action: "invite_guardian",
    payload: {
      player_id: fixture.preseason.player,
      email: env.EMAIL_TEST_RECIPIENT,
      send_email: true,
    },
  });
  assert.equal(result.emailState, "accepted");
  report.guardianInvitation = {
    league: fixture.preseason.league,
    id: result.id,
    invitationUrl: result.invitationUrl,
    status: "accepted",
    acceptedAt: new Date().toISOString(),
    inboxReceipt: "pending",
  };
  save();
  // Issuing this replacement invalidates the rehearsal's previous invitation; keep the manifest current.
  fixture.preseason.invitationUrl = result.invitationUrl;
  fixture.preseason.expiresAt = result.expires_at;
  writeFileSync(".local/demo-manifest.json", JSON.stringify(fixture, null, 2));
  console.log(
    "The real guardian invitation was accepted for the one controlled inbox. Private link retained locally; verify its Gmail receipt and portal destination.",
  );
}
assert.deepEqual(await publicFingerprint(), baseline);
report.publicReferenceUnchanged = true;
save();
