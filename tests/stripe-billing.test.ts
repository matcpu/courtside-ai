import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
const shared = vi.hoisted(() => ({
  provider: {} as any,
  bridge: null as any,
  client: null as any,
  db: null as any,
  actor: "",
  org: "",
  customer: "",
  subscriptions: [] as any[],
  failSave: false,
}));
vi.mock("stripe", () => ({
  default: class {
    constructor() {
      return shared.provider;
    }
  },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => shared.bridge }));
vi.mock("@/lib/server", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/server")>("@/lib/server");
  return {
    ...actual,
    authenticate: async () => ({
      client: shared.client,
      user: { id: shared.actor },
    }),
  };
});
import { POST as webhook } from "../src/app/api/billing/webhook/route";
import { POST as billing } from "../src/app/api/billing/route";
import {
  startCheckout,
  openPortal,
  safeStripeUrl,
} from "../src/lib/stripe-billing";
import { subscriptionPolicy } from "../src/lib/subscriptions";
import { localDatabase, asUser } from "../scripts/lib/local-database.mjs";
let signer: any, secret: string;
const rpcClient = (role: string) => ({
  rpc: async (name: string, args: any = {}) => {
    try {
      return {
        data: await asUser(
          shared.db,
          role === "service_role" ? null : shared.actor,
          async (tx: any) =>
            (
              await tx.query(`select public.${name}($1,$2::jsonb) r`, [
                args.p_action,
                JSON.stringify(args.p_payload),
              ])
            ).rows[0].r,
          role,
        ),
        error: null,
      };
    } catch (e: any) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  },
});
function subscription(status = "active", price = "price_Pro") {
  return {
    id: "sub_" + shared.org.replaceAll("-", ""),
    customer: shared.customer,
    livemode: false,
    status,
    created: 100,
    cancel_at_period_end: false,
    items: {
      data: [
        { price: { id: price }, quantity: 1, current_period_end: 4070908800 },
      ],
    },
  };
}
function event(type = "customer.subscription.updated", overrides: any = {}) {
  return {
    id: "evt_" + randomUUID().replaceAll("-", ""),
    object: "event",
    type,
    created: 100,
    livemode: false,
    data: {
      object: {
        id: subscription().id,
        customer: shared.customer,
        status: "active",
        metadata: { organization_id: "forged" },
      },
    },
    ...overrides,
  };
}
async function deliver(e: any, change?: string) {
  const raw = JSON.stringify(e),
    header = signer.webhooks.generateTestHeaderString({ payload: raw, secret });
  return webhook(
    new Request("http://127.0.0.1:3501/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: change ?? raw,
    }),
  );
}
async function orgPlan() {
  return (
    await shared.db.query(
      "select effective_plan p from public.organizations where id=$1",
      [shared.org],
    )
  ).rows[0].p;
}
async function attach() {
  const a = await shared.client.rpc("billing_access", {
    p_action: "checkout",
    p_payload: { organization_id: shared.org, plan: "pro" },
  });
  await shared.bridge.rpc("billing_service", {
    p_action: "attach_customer",
    p_payload: {
      attempt_id: a.data.attempt_id,
      customer_id: shared.customer,
      livemode: false,
    },
  });
}
beforeAll(async () => {
  const actual = await vi.importActual<typeof import("stripe")>("stripe");
  signer = new actual.default(["sk", "test", "synthetic"].join("_"));
  shared.db = await localDatabase();
}, 60000);
afterAll(async () => {
  await shared.db?.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  shared.actor = randomUUID();
  shared.customer = "cus_" + randomUUID().replaceAll("-", "");
  await shared.db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [shared.actor, `synthetic-${shared.actor}@example.invalid`],
  );
  shared.client = rpcClient("authenticated");
  shared.bridge = rpcClient("service_role");
  const org = await shared.client.rpc("organization_command", {
    p_action: "create",
    p_payload: { name: "Synthetic Billing Organization" },
  });
  shared.org = org.data.id;
  secret = ["whsec", randomBytes(24).toString("hex")].join("_");
  shared.subscriptions = [];
  shared.failSave = false;
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3502",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-local-service-only",
    STRIPE_TEST_ENABLED: "true",
    STRIPE_SECRET_KEY: ["rk", "test", "synthetic"].join("_"),
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_PRICE_STARTER: "price_Starter",
    STRIPE_PRICE_PRO: "price_Pro",
    STRIPE_PORTAL_CONFIGURATION: "bpc_Synthetic",
    BILLING_APP_ORIGIN: "http://127.0.0.1:3501",
  }))
    vi.stubEnv(key, value);
  shared.provider = {
    webhooks: signer.webhooks,
    subscriptions: {
      list: vi.fn(() => ({
        async *[Symbol.asyncIterator]() {
          for (const s of structuredClone(shared.subscriptions)) yield s;
        },
      })),
    },
    prices: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        livemode: false,
        active: true,
        recurring: { usage_type: "licensed" },
        product: id === "price_Pro" ? "prod_Pro" : "prod_Starter",
      })),
    },
    customers: {
      create: vi.fn(async () => ({ id: shared.customer, livemode: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (p: any) => ({
          id: "cs_test_" + shared.org.replaceAll("-", ""),
          customer: p.customer,
          livemode: false,
          status: "open",
          mode: "subscription",
          url: "https://checkout.stripe.com/c/pay/synthetic",
        })),
        retrieve: vi.fn(async () => ({
          customer: shared.customer,
          livemode: false,
          status: "open",
          mode: "subscription",
          url: "https://checkout.stripe.com/c/pay/synthetic",
        })),
      },
    },
    billingPortal: {
      configurations: {
        retrieve: vi.fn(async () => ({ livemode: false, active: true })),
      },
      sessions: {
        create: vi.fn(async () => ({
          url: "https://billing.stripe.com/p/session/synthetic",
        })),
      },
    },
    charges: {
      retrieve: vi.fn(async () => ({
        customer: shared.customer,
        livemode: false,
      })),
    },
  };
});
describe("Stripe test-only service with actual signature verification and local PostgreSQL", () => {
  it("is disabled by default and rejects live credentials before provider use", async () => {
    vi.stubEnv("STRIPE_TEST_ENABLED", "false");
    expect((await deliver(event())).status).toBe(503);
    vi.stubEnv("STRIPE_TEST_ENABLED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", ["sk", "live", "synthetic"].join("_"));
    expect((await deliver(event())).status).toBe(503);
    expect(shared.provider.subscriptions.list).not.toHaveBeenCalled();
  });
  it("rejects tampered, stale-signed and live-mode events without a database receipt", async () => {
    const e = event();
    expect(
      (await deliver(e, JSON.stringify({ ...e, livemode: true }))).status,
    ).toBe(400);
    const raw = JSON.stringify(e),
      header = signer.webhooks.generateTestHeaderString({
        payload: raw,
        secret,
        timestamp: Math.floor(Date.now() / 1000) - 400,
      });
    expect(
      (
        await webhook(
          new Request("http://localhost/api/billing/webhook", {
            method: "POST",
            headers: { "stripe-signature": header },
            body: raw,
          }),
        )
      ).status,
    ).toBe(400);
    expect((await deliver({ ...e, livemode: true })).status).toBe(400);
    expect(
      (
        await shared.db.query(
          "select count(*)::int n from public.billing_events where id=$1",
          [e.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("processes a signed event once and acknowledges replay without another provider read", async () => {
    await attach();
    shared.subscriptions = [subscription()];
    const e = event();
    expect((await deliver(e)).status).toBe(200);
    expect(await orgPlan()).toBe("pro");
    expect((await deliver(e)).status).toBe(200);
    expect(shared.provider.subscriptions.list).toHaveBeenCalledTimes(1);
  });
  it("uses current canonical state for older and equal-time events, never their plan metadata", async () => {
    await attach();
    shared.subscriptions = [subscription("canceled")];
    expect(
      (await deliver(event("customer.subscription.deleted", { created: 200 })))
        .status,
    ).toBe(200);
    expect(await orgPlan()).toBe("free");
    expect(
      (await deliver(event("customer.subscription.updated", { created: 10 })))
        .status,
    ).toBe(200);
    expect(await orgPlan()).toBe("free");
    shared.subscriptions = [subscription()];
    expect((await deliver(event("invoice.paid", { created: 10 }))).status).toBe(
      200,
    );
    expect(await orgPlan()).toBe("pro");
  });
  it("fails closed for unknown prices/multiple subscriptions and reconciles past-due/recovery/cancellation", async () => {
    await attach();
    for (const [subscriptions, plan] of [
      [[subscription("active", "price_Unknown")], "free"],
      [[subscription(), { ...subscription(), id: "sub_Second" }], "free"],
      [[subscription("past_due")], "free"],
      [[subscription("trialing")], "pro"],
      [[subscription("canceled")], "free"],
    ] as const) {
      shared.subscriptions = subscriptions as any;
      expect((await deliver(event())).status).toBe(200);
      expect(await orgPlan()).toBe(plan);
    }
  });
  it("preserves paid access until cancellation becomes effective and latches risk issues for review", async () => {
    await attach();
    shared.subscriptions = [{ ...subscription(), cancel_at_period_end: true }];
    expect((await deliver(event())).status).toBe(200);
    expect(await orgPlan()).toBe("pro");
    expect(
      (
        await deliver(
          event("charge.dispute.created", {
            data: { object: { id: "dp_Synthetic", charge: "ch_Synthetic" } },
          }),
        )
      ).status,
    ).toBe(200);
    expect(shared.provider.charges.retrieve).toHaveBeenCalledWith(
      "ch_Synthetic",
    );
    expect((await deliver(event())).status).toBe(200);
    expect(
      (
        await shared.db.query(
          "select risk_flag from public.organization_billing where organization_id=$1",
          [shared.org],
        )
      ).rows[0].risk_flag,
    ).toBe(true);
  });
  it("does not fulfill from a Checkout return or an unpaid completion snapshot", async () => {
    await attach();
    shared.subscriptions = [subscription("incomplete")];
    expect((await deliver(event("checkout.session.completed"))).status).toBe(
      200,
    );
    expect(await orgPlan()).toBe("free");
  });
  it("returns retryable errors and permits a safe signed replay after provider failure", async () => {
    await attach();
    const e = event();
    shared.provider.subscriptions.list.mockImplementationOnce(() => {
      throw Error("Private upstream detail");
    });
    const r = await deliver(e);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("Private upstream");
    shared.subscriptions = [subscription()];
    expect((await deliver(e)).status).toBe(200);
    expect(await orgPlan()).toBe("pro");
  });
  it("binds Checkout to the authorized organization with stable idempotency keys and no client prices/redirects", async () => {
    const first = await startCheckout(
      shared.client,
      shared.org,
      "pro",
      shared.provider,
      shared.bridge,
    );
    expect(first.url).toMatch(/^https:\/\/checkout.stripe.com\//);
    await startCheckout(
      shared.client,
      shared.org,
      "pro",
      shared.provider,
      shared.bridge,
    );
    expect(shared.provider.customers.create).toHaveBeenCalledTimes(1);
    expect(shared.provider.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const [args, options] =
      shared.provider.checkout.sessions.create.mock.calls[0];
    expect(args).toMatchObject({
      mode: "subscription",
      customer: shared.customer,
      line_items: [{ price: "price_Pro", quantity: 1 }],
    });
    expect(args.success_url).toBe(
      `http://127.0.0.1:3501/organizations?organization=${shared.org}&checkout=returned`,
    );
    expect(args).not.toHaveProperty("payment_method_types");
    expect(args.integration_identifier).toMatch(/^courtside_saas_[a-p]{8}$/);
    expect(options.idempotencyKey).toContain("courtside:test:checkout:");
    expect(await orgPlan()).toBe("free");
  });
  it("freezes Checkout parameters across an ambiguous provider timeout and a configuration change", async () => {
    shared.provider.checkout.sessions.create.mockRejectedValueOnce(
      Error("Synthetic timeout"),
    );
    await expect(
      startCheckout(
        shared.client,
        shared.org,
        "pro",
        shared.provider,
        shared.bridge,
      ),
    ).rejects.toThrow("Synthetic timeout");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_Changed");
    await expect(
      startCheckout(
        shared.client,
        shared.org,
        "pro",
        shared.provider,
        shared.bridge,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(shared.provider.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(await orgPlan()).toBe("free");
  });
  it("a current provider subscription prevents a duplicate Checkout even when its webhook has not arrived", async () => {
    await attach();
    shared.subscriptions = [subscription()];
    await expect(
      startCheckout(
        shared.client,
        shared.org,
        "pro",
        shared.provider,
        shared.bridge,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(shared.provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("Portal uses the stored customer, explicit test configuration and fixed return origin", async () => {
    await attach();
    await openPortal(shared.client, shared.org, shared.provider);
    expect(shared.provider.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: shared.customer,
      configuration: "bpc_Synthetic",
      return_url: `http://127.0.0.1:3501/organizations?organization=${shared.org}`,
    });
    expect(() =>
      safeStripeUrl("https://attacker.example/session", "portal"),
    ).toThrow("Unexpected provider");
  });
  it("foreign owners and customer-supplied plan mutation attempts cannot use billing", async () => {
    const foreign = randomUUID();
    await shared.db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [foreign, `synthetic-${foreign}@example.invalid`],
    );
    shared.actor = foreign;
    const response = await billing(
      new Request("http://localhost/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: shared.org,
          action: "checkout",
          plan: "pro",
          price: "price_Attacker",
          return_url: "https://attacker.example",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(shared.provider.customers.create).not.toHaveBeenCalled();
  });
});
it("normalizer rejects live state and incomplete item lists", () => {
  expect(() =>
    subscriptionPolicy([{ ...subscription(), livemode: true }], {
      starter: "price_Starter",
      pro: "price_Pro",
    }),
  ).toThrow("Live");
  expect(
    subscriptionPolicy(
      [{ ...subscription(), items: { data: [], has_more: true } }],
      { starter: "price_Starter", pro: "price_Pro" },
    ).issue_code,
  ).toBe("unknown_price");
});
