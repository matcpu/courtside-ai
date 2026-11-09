import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { nativeTestDatabase } from "./lib/native-test-database.mjs";
import { asUser } from "./lib/local-database.mjs";
const db = await nativeTestDatabase({ baselineCapacity: false });
const owner = randomUUID(),
  admin = randomUUID();
const call = (c, name, args) =>
  c
    .query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) r`,
      args,
    )
    .then((r) => r.rows[0].r);
const org = (c, action, p = {}) =>
  call(c, "organization_command", [action, JSON.stringify(p)]);
const cmd = (c, o, pr) =>
  call(c, "league_command", [
    null,
    "create_league",
    JSON.stringify({
      name: "Synthetic concurrent season",
      season: "2099",
      cutoff: "2099-01-01",
      organization_id: o,
      program_id: pr,
    }),
  ]);
const begin = async (c, actor, role = "authenticated") => {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: actor, role }),
  ]);
  await c.query(
    `set local role ${role};set local lock_timeout='10s';set local statement_timeout='15s'`,
  );
};
const wait = async (pid, blocker) => {
  const limit = Date.now() + 7000;
  while (Date.now() < limit) {
    const r = (await db.query("select pg_blocking_pids($1) p", [pid])).rows[0]
      .p;
    if (r.includes(blocker)) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error("Expected authoritative organization row-lock wait");
};
async function race(
  firstActor,
  secondActor,
  first,
  second,
  verify,
  roleA = "authenticated",
  roleB = "authenticated",
) {
  const a = await db.pool.connect(),
    b = await db.pool.connect();
  try {
    await begin(a, firstActor, roleA);
    const value = await first(a);
    const blocker = (await a.query("select pg_backend_pid() p")).rows[0].p;
    await begin(b, secondActor, roleB);
    const pid = (await b.query("select pg_backend_pid() p")).rows[0].p;
    const p = second(b).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await wait(pid, blocker);
    await a.query("commit");
    const r = await p;
    await b.query(r.error ? "rollback" : "commit");
    await verify(value, r);
  } finally {
    await a.query("rollback");
    await b.query("rollback");
    a.release();
    b.release();
  }
}
try {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-concurrency-owner@example.invalid',now()),($2,'synthetic-concurrency-admin@example.invalid',now())",
    [owner, admin],
  );
  const o = (
    await asUser(db, owner, (c) =>
      org(c, "create", { name: "Synthetic concurrent organization" }),
    )
  ).id;
  const pr = (
    await asUser(db, owner, (c) =>
      org(c, "create_program", {
        organization_id: o,
        name: "Synthetic Program",
      }),
    )
  ).program_id;
  for (let i = 0; i < 2; i++) await asUser(db, owner, (c) => cmd(c, o, pr));
  await race(
    owner,
    owner,
    (c) => cmd(c, o, pr),
    (c) => cmd(c, o, pr),
    async (_a, b) => {
      assert.equal(b.error?.code, "PT409");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.leagues where organization_id=$1",
            [o],
          )
        ).rows[0].n,
        3,
      );
    },
  );
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  await asUser(db, owner, (c) =>
    org(c, "invite", {
      organization_id: o,
      email: "synthetic-concurrency-admin@example.invalid",
      role: "admin",
      hash,
    }),
  );
  await asUser(db, admin, (c) => org(c, "accept", { hash }));
  // Raise only this fixture's capacity to isolate revocation from a quota denial.
  await db.query(
    "update public.organizations set capacity_floor='{" +
      '"seasons":10' +
      "}'::jsonb where id=$1",
    [o],
  );
  await race(
    owner,
    admin,
    (c) => org(c, "remove_member", { organization_id: o, user_id: admin }),
    (c) => cmd(c, o, pr),
    async (_a, b) => {
      assert.equal(b.error?.code, "42501");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.leagues where organization_id=$1",
            [o],
          )
        ).rows[0].n,
        3,
      );
    },
  );
  const invitePending=(c,email)=>org(c,"invite",{organization_id:o,email,role:"member",hash:createHash("sha256").update(email).digest("hex")});
  await asUser(db,owner,c=>invitePending(c,"synthetic-pending-base@example.invalid"));
  await race(owner,owner,c=>invitePending(c,"synthetic-pending-a@example.invalid"),c=>invitePending(c,"synthetic-pending-b@example.invalid"),async(_a,b)=>{
    assert.equal(b.error?.code,"PT409");assert.equal((await db.query("select count(*)::int n from public.organization_invitations where organization_id=$1 and accepted_at is null and revoked_at is null",[o])).rows[0].n,2);
  });
  const checkout = (c) =>
    call(c, "billing_access", [
      "checkout",
      JSON.stringify({ organization_id: o, plan: "pro" }),
    ]);
  let attempt;
  await race(owner, owner, checkout, checkout, async (a, b) => {
    assert.ok(!b.error);
    assert.equal(a.attempt_id, b.value.attempt_id);
    attempt = a.attempt_id;
  });
  const service = (c, action, p) =>
    call(c, "billing_service", [
      action,
      JSON.stringify({ ...p, livemode: false }),
    ]);
  await asUser(
    db,
    null,
    (c) =>
      service(c, "attach_customer", {
        attempt_id: attempt,
        customer_id: "cus_Concurrency",
      }),
    "service_role",
  );
  const payload = {
    id: "evt_Concurrency",
    type: "customer.subscription.updated",
    customer_id: "cus_Concurrency",
    created: 10,
    hash: "a".repeat(64),
  };
  let lease;
  await race(
    null,
    null,
    (c) => service(c, "begin", payload),
    (c) => service(c, "begin", { ...payload, id: "evt_Second" }),
    async (a, b) => {
      lease = a.lease;
      assert.equal(b.error?.code, "PT409");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.billing_events where id='evt_Second'",
          )
        ).rows[0].n,
        0,
      );
    },
    "service_role",
    "service_role",
  );
  await race(
    null,
    null,
    (c) =>
      service(c, "apply", {
        id: payload.id,
        lease,
        customer_id: payload.customer_id,
        plan: "pro",
        status: "active",
        subscription_id: "sub_Concurrency",
        issue_code: null,
      }),
    (c) => service(c, "begin", payload),
    async (_a, b) => {
      assert.equal(b.value?.duplicate, true);
      assert.equal(
        (
          await db.query(
            "select sync_version from public.organization_billing where organization_id=$1",
            [o],
          )
        ).rows[0].sync_version,
        "1",
      );
    },
    "service_role",
    "service_role",
  );
  console.log(
    "Six native SaaS concurrency cases passed: season capacity, role revocation, invitation capacity, Checkout reservation, reconciliation lease and webhook replay. Actual PostgreSQL lock waits observed; no hosted or Stripe requests.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
