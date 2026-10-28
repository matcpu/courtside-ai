import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { actor, env, publicFingerprint } from "./lib/readiness.mjs";
const f = JSON.parse(readFileSync(".local/demo-manifest.json"));
assert.equal(f.synthetic, true);
assert.equal(env.META_API_ENABLED, "false");
const baseline = await publicFingerprint();
assert.deepEqual(baseline, f.publicReference);
const coach = await actor(f.accounts.coach);
const s = await coach.api(`/api/league?id=${f.preseason.league}`);
assert.ok(
  s.players.some(
    (p) =>
      p.id === f.preseason.player && p.display_name === "Fictional Demo Player",
  ),
  "Expected owned synthetic guardian sample",
);
const invitation = await coach.api("/api/preseason", {
  league: f.preseason.league,
  action: "invite_guardian",
  payload: { player_id: f.preseason.player, email: "", send_email: false },
});
assert.equal(invitation.emailState, "not_requested");
f.preseason.invitationUrl = invitation.invitationUrl;
f.preseason.expiresAt = invitation.expires_at;
writeFileSync(".local/demo-manifest.json", JSON.stringify(f, null, 2));
assert.deepEqual(await publicFingerprint(), baseline);
console.log(
  "Fresh one-player invitation saved privately; previous invitation revoked. No email or model request sent. Regenerate the private judge packet before secure handoff.",
);
