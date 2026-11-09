import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { localDatabase, asUser, organizer } from "./lib/local-database.mjs";
const db = await localDatabase();
let checks = 0;
const actors = Array.from({ length: 8 }, () => randomUUID());
const [owner, other, admin, member, extra, quotaOwner, platform, unconfirmed] =
  actors;
const email = (a) => `synthetic-${actors.indexOf(a)}@example.invalid`;
const check = (v, label) => {
  assert.ok(v, label);
  checks++;
};
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const rpc = (actor, name, args, role = "authenticated") =>
  asUser(
    db,
    actor,
    async (tx) =>
      (
        await tx.query(
          `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) r`,
          args,
        )
      ).rows[0].r,
    role,
  );
const org = (actor, action, p = {}) =>
  rpc(actor, "organization_command", [action, JSON.stringify(p)]);
const league = (actor, id, action, p = {}) =>
  rpc(actor, "league_command", [id, action, JSON.stringify(p)]);
const service = (action, p) =>
  rpc(
    null,
    "billing_service",
    [action, JSON.stringify({ ...p, livemode: false })],
    "service_role",
  );
const reject = async (fn, pattern) => {
  await assert.rejects(fn, pattern);
  checks++;
};
const invite = async (actor, o, target, role = "member") => {
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  await org(actor, "invite", {
    organization_id: o,
    email: email(target),
    role,
    hash,
  });
  return hash;
};
const season = (actor, o, pr, name = "Synthetic season") =>
  league(actor, null, "create_league", {
    name,
    season: "Synthetic 2099",
    cutoff: "2099-01-01",
    organization_id: o,
    program_id: pr,
    sport: "hockey",
  });
const event = (id, customer, created = 10) => ({
  id: `evt_${id}`,
  type: "customer.subscription.updated",
  hash: createHash("sha256").update(id).digest("hex"),
  created,
  customer_id: customer,
});
const state = (customer, plan = "pro", status = "active") => ({
  customer_id: customer,
  plan,
  status,
  subscription_id: "sub_Synthetic",
  cancel_at_period_end: false,
  period_end: "2099-01-01T00:00:00Z",
  issue_code: null,
});
async function apply(
  id,
  customer,
  plan = "pro",
  status = "active",
  created = 10,
) {
  const e = event(id, customer, created),
    lease = await service("begin", e);
  return service("apply", {
    id: e.id,
    lease: lease.lease,
    ...state(customer, plan, status),
  });
}
try {
  for (const a of actors)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)",
      [
        a,
        email(a),
        a === unconfirmed ? null : new Date().toISOString(),
        JSON.stringify({ platform_admin: true, organization_role: "owner" }),
      ],
    );
  const a = (await org(owner, "create", { name: "Synthetic Organization A" }))
      .id,
    b = (await org(other, "create", { name: "Synthetic Organization B" })).id;
  const pr = (
    await org(owner, "create_program", {
      organization_id: a,
      name: "Synthetic Hockey Program",
    })
  ).program_id;
  const l = (await season(owner, a, pr)).id;
  check(
    (
      await sql(
        "select organization_id,program_id from public.leagues where id=$1",
        [l],
      )
    )[0].organization_id === a,
    "League is owned by correct organization",
  );
  await reject(
    () => org(other, "get", { organization_id: a }),
    /access denied/,
  );
  await reject(() => season(other, a, pr), /manager required/);
  await reject(() => season(owner, b, pr), /manager required/);
  const prB = (
    await org(other, "create_program", {
      organization_id: b,
      name: "Synthetic B Program",
    })
  ).program_id;
  await reject(() => season(owner, a, prB), /program access/);
  const token = await invite(owner, a, admin, "admin");
  await org(admin, "accept", { hash: token });
  check(
    (await org(admin, "get", { organization_id: a })).role === "admin",
    "Confirmed invite grants only requested organization role",
  );
  await reject(
    () => rpc(admin, "league_snapshot", [l, false]),
    /League access/,
  );
  await reject(
    () =>
      org(admin, "invite", {
        organization_id: a,
        email: email(extra),
        role: "admin",
        hash: "a".repeat(64),
      }),
    /owner/,
  );
  await reject(
    () =>
      org(admin, "set_role", {
        organization_id: a,
        user_id: owner,
        role: "member",
      }),
    /Owner/,
  );
  await reject(() => org(other, "accept", { hash: token }), /Invitation/);
  check(
    (await org(admin, "accept", { hash: token })).duplicate === true,
    "Accepted invitation replay is idempotent",
  );
  const storagePath = `${l}/${owner}/synthetic.png`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('scoresheets',$1)",
    [storagePath],
  );
  check(
    (
      await asUser(db, admin, (tx) =>
        tx.query("select * from storage.objects where name=$1", [storagePath]),
      )
    ).rows.length === 0,
    "Org admin does not inherit private Storage access",
  );
  await reject(
    () =>
      asUser(db, other, (tx) =>
        tx.query(
          "insert into storage.objects(bucket_id,name) values('scoresheets',$1)",
          [`${l}/${other}/foreign.png`],
        ),
      ),
    /row-level security/,
  );
  await org(owner, "grant_league_role", {
    organization_id: a,
    league_id: l,
    user_id: admin,
    role: "admin",
  });
  check(
    (await rpc(admin, "league_snapshot", [l, false])).role === "admin",
    "Explicit per-league grant works",
  );
  check(
    (
      await asUser(db, admin, (tx) =>
        tx.query("select * from storage.objects where name=$1", [storagePath]),
      )
    ).rows.length === 1,
    "Storage follows explicit league role",
  );
  await org(owner, "remove_member", { organization_id: a, user_id: admin });
  await reject(
    () => rpc(admin, "league_snapshot", [l, false]),
    /League access/,
  );
  await reject(() => org(admin, "accept", { hash: token }), /Invitation/);
  check(
    (
      await asUser(db, admin, (tx) =>
        tx.query("select * from storage.objects where name=$1", [storagePath]),
      )
    ).rows.length === 0,
    "Removal immediately revokes organization-delegated Storage access",
  );
  await league(owner, l, "invite_member", {
    email: email(member),
    role: "coach",
  });
  const memberToken = await invite(owner, a, member);
  await org(member, "accept", { hash: memberToken });
  await org(owner, "grant_league_role", {
    organization_id: a,
    league_id: l,
    user_id: member,
    role: "admin",
  });
  await org(owner, "remove_member", { organization_id: a, user_id: member });
  check(
    (await rpc(member, "league_snapshot", [l, false])).role === "coach",
    "Prior explicit league permissions survive org removal",
  );
  const expired = await invite(owner, a, extra);
  await db.query(
    "update public.organization_invitations set expires_at=now()-interval'1 second' where token_hash=$1",
    [expired],
  );
  await reject(() => org(extra, "accept", { hash: expired }), /Invitation/);
  const noConfirm = await invite(owner, a, unconfirmed);
  await reject(
    () => org(unconfirmed, "accept", { hash: noConfirm }),
    /confirmed account/,
  );
  const revoked = await invite(owner, a, extra);
  const inv = (
    await sql(
      "select id from public.organization_invitations where token_hash=$1",
      [revoked],
    )
  )[0].id;
  await org(owner, "revoke_invite", { organization_id: a, invitation_id: inv });
  await reject(() => org(extra, "accept", { hash: revoked }), /Invitation/);
  await reject(
    () =>
      org(owner, "set_role", {
        organization_id: a,
        user_id: owner,
        role: "member",
      }),
    /last owner/,
  );
  const transfer = await invite(owner, a, member);
  await org(member, "accept", { hash: transfer });
  await org(owner, "transfer_owner", { organization_id: a, user_id: member });
  check(
    (await org(member, "get", { organization_id: a })).role === "owner" &&
      (await org(owner, "get", { organization_id: a })).role === "admin",
    "Owner transfer is atomic and retains one owner",
  );
  await reject(
    () =>
      rpc(owner, "billing_access", [
        "checkout",
        JSON.stringify({ organization_id: a, plan: "pro" }),
      ]),
    /owner required/,
  );
  await reject(
    () =>
      asUser(db, other, (tx) =>
        tx.query(
          "update public.organizations set effective_plan='pro' where id=$1",
          [b],
        ),
      ),
    /permission/,
  );
  await reject(
    () => rpc(other, "billing_service", ["begin", "{}"]),
    /permission/,
  );
  await reject(
    () => rpc(null, "organization_command", ["list", "{}"], "anon"),
    /permission/,
  );
  check(
    (
      await asUser(db, other, (tx) =>
        tx.query("select * from public.organizations where id=$1", [a]),
      )
    ).rows.length === 0,
    "Organization table RLS denies foreign tenant",
  );
  await reject(
    () => rpc(other, "platform_overview", []),
    /Platform administrator/,
  );
  await db.query(
    "insert into public.platform_administrators(user_id) values($1)",
    [platform],
  );
  const overview = await rpc(platform, "platform_overview", []);
  check(
    overview.organizations.length >= 2,
    "Dedicated platform binding enables redacted administration",
  );
  await reject(
    () => rpc(platform, "league_snapshot", [l, false]),
    /League access/,
  );
  check(
    !JSON.stringify(overview).includes(email(owner)) &&
      !JSON.stringify(overview).includes("birth_date"),
    "Platform overview omits contacts and youth records",
  );
  const q = (await org(quotaOwner, "create", { name: "Synthetic Quota Org" }))
      .id,
    qp = (
      await org(quotaOwner, "create_program", {
        organization_id: q,
        name: "Synthetic Basketball",
      })
    ).program_id;
  for (let n = 0; n < 3; n++)
    await season(quotaOwner, q, qp, `Synthetic season ${n}`);
  const before = (await sql("select count(*)::int n from public.leagues"))[0].n;
  await reject(() => season(quotaOwner, q, qp), /Season limit/);
  check(
    (await sql("select count(*)::int n from public.leagues"))[0].n === before,
    "Quota failure rolls back league creation",
  );
  const checkout = () =>
    rpc(quotaOwner, "billing_access", [
      "checkout",
      JSON.stringify({ organization_id: q, plan: "pro" }),
    ]);
  const attempt = await checkout();
  check(
    (await checkout()).attempt_id === attempt.attempt_id,
    "Repeated Checkout reserves one stable idempotency identity",
  );
  await reject(
    () =>
      rpc(other, "billing_access", [
        "checkout",
        JSON.stringify({ organization_id: q, plan: "pro" }),
      ]),
    /owner required/,
  );
  await reject(
    () =>
      rpc(quotaOwner, "billing_access", [
        "checkout",
        JSON.stringify({ organization_id: q, plan: "starter" }),
      ]),
    /different checkout/,
  );
  const customer = "cus_SyntheticQuota";
  await service("attach_customer", {
    attempt_id: attempt.attempt_id,
    customer_id: customer,
  });
  await service("save_checkout", {
    attempt_id: attempt.attempt_id,
    customer_id: customer,
    session_id: "cs_test_SyntheticQuota",
  });
  await apply("Upgrade", customer);
  check(
    (await org(quotaOwner, "get", { organization_id: q })).plan === "pro",
    "Verified service reconciliation grants Pro",
  );
  await season(quotaOwner, q, qp, "Synthetic above Free");
  const ids = (
    await sql(
      "select id from public.leagues where organization_id=$1 order by id",
      [q],
    )
  ).map((r) => r.id);
  await apply("Downgrade", customer, "free", "canceled", 20);
  check(
    (await org(quotaOwner, "get", { organization_id: q })).plan === "free",
    "Canceled subscription returns Free",
  );
  assert.deepEqual(
    (
      await sql(
        "select id from public.leagues where organization_id=$1 order by id",
        [q],
      )
    ).map((r) => r.id),
    ids,
  );
  checks++;
  await reject(() => season(quotaOwner, q, qp), /Season limit/);
  await league(quotaOwner, ids[0], "configure_public", { enabled: true });
  check(
    (await rpc(quotaOwner, "league_snapshot", [ids[0], false])).role ===
      "admin",
    "Downgrade preserves existing league operations",
  );
  const e = event("Replay", customer, 30),
    lease = await service("begin", e);
  await service("apply", { ...state(customer), id: e.id, lease: lease.lease });
  const version = (
    await sql(
      "select sync_version from public.organization_billing where organization_id=$1",
      [q],
    )
  )[0].sync_version;
  check(
    (await service("begin", e)).duplicate === true,
    "Webhook replay detected durably",
  );
  check(
    (
      await sql(
        "select sync_version from public.organization_billing where organization_id=$1",
        [q],
      )
    )[0].sync_version === version,
    "Replay cannot apply twice",
  );
  await reject(
    () => service("begin", { ...e, hash: "0".repeat(64) }),
    /identity conflict/,
  );
  const first = await service("begin", event("LeaseOne", customer));
  await reject(() => service("begin", event("LeaseTwo", customer)), /busy/);
  await db.query(
    "update public.organization_billing set lease_until=now()-interval '1 second' where organization_id=$1",
    [q],
  );
  const second = await service("begin", event("LeaseTwo", customer));
  await reject(
    () =>
      service("apply", {
        ...state(customer, "free", "canceled"),
        id: "evt_LeaseOne",
        lease: first.lease,
      }),
    /Stale/,
  );
  await service("apply", {
    ...state(customer),
    id: "evt_LeaseTwo",
    lease: second.lease,
  });
  check(
    (await org(quotaOwner, "get", { organization_id: q })).plan === "pro",
    "Expired holder cannot overwrite newer reconciliation",
  );
  const retry = event("ProviderFail", customer);
  let pending = await service("begin", retry);
  await service("fail", { id: retry.id, lease: pending.lease });
  pending = await service("begin", retry);
  await service("apply", {
    ...state(customer),
    id: retry.id,
    lease: pending.lease,
  });
  check(
    (
      await sql("select status from public.billing_events where id=$1", [
        retry.id,
      ])
    )[0].status === "applied",
    "Provider failure can be replayed safely",
  );
  await reject(
    () =>
      rpc(
        null,
        "billing_service",
        [
          "begin",
          JSON.stringify({ ...event("Live", customer), livemode: true }),
        ],
        "service_role",
      ),
    /test-mode/,
  );
  check(
    (await service("begin", event("Unmapped", "cus_Unknown"))).ignored === true,
    "Unknown customer cannot select an organization through metadata",
  );
  await reject(
    () =>
      service("begin", {
        ...event("Unmapped", "cus_Unknown"),
        hash: "1".repeat(64),
      }),
    /identity conflict/,
  );
  const unknown = await service("begin", event("UnknownPrice", customer));
  await service("apply", {
    ...state(customer),
    issue_code: "unknown_price",
    id: "evt_UnknownPrice",
    lease: unknown.lease,
  });
  check(
    (await org(quotaOwner, "get", { organization_id: q })).plan === "free",
    "Unknown prices fail closed",
  );
  const past = await service("begin", event("PastDue", customer));
  await service("apply", {
    ...state(customer, "pro", "past_due"),
    issue_code: "subscription_not_active",
    id: "evt_PastDue",
    lease: past.lease,
  });
  check(
    (await org(quotaOwner, "get", { organization_id: q })).plan === "free",
    "Past-due plan is deterministically Free without deleting records",
  );
  const constraints = (
    await sql(
      "select has_function_privilege('authenticated','private.billing_service(text,jsonb)','EXECUTE') mutate,has_table_privilege('authenticated','public.organization_billing','SELECT') read,has_table_privilege('authenticated','public.platform_administrators','INSERT') appoint",
    )
  )[0];
  assert.deepEqual(constraints, { mutate: false, read: false, appoint: false });
  checks++;
  console.log(
    `SaaS authorization, quotas and billing assertions passed: ${checks}. Disposable local PostgreSQL; no Stripe or hosted requests.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
