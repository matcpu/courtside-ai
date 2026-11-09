import "server-only";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./server";
import {
  subscriptionPolicy,
  subscriptionEvents,
  riskEvents,
  type SubscriptionState,
} from "./subscriptions";

export function billingConfig() {
  if (process.env.STRIPE_TEST_ENABLED !== "true")
    throw new ApiError(
      "Stripe test billing is disabled. No provider request was made.",
      503,
    );
  const key = process.env.STRIPE_SECRET_KEY ?? "",
    secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!/^(rk|sk)_test_[A-Za-z0-9_]+$/.test(key) || !secret.startsWith("whsec_"))
    throw new ApiError(
      "Only explicit Stripe test credentials are supported",
      503,
    );
  const origin = process.env.BILLING_APP_ORIGIN ?? "";
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new ApiError("Billing origin is not configured", 503);
  }
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ))
  )
    throw new ApiError(
      "Billing origin must be a fixed HTTPS or loopback origin",
      503,
    );
  const starter = process.env.STRIPE_PRICE_STARTER ?? "",
    pro = process.env.STRIPE_PRICE_PRO ?? "";
  if (
    !/^price_[A-Za-z0-9]+$/.test(starter) ||
    !/^price_[A-Za-z0-9]+$/.test(pro) ||
    starter === pro
  )
    throw new ApiError(
      "Configure distinct test price IDs for Starter and Pro",
      503,
    );
  return {
    key,
    secret,
    origin,
    prices: { starter, pro },
    portal: process.env.STRIPE_PORTAL_CONFIGURATION ?? "",
  };
}
export function stripeClient() {
  const config = billingConfig();
  return new Stripe(config.key, {
    apiVersion: "2026-10-28.endive",
    maxNetworkRetries: 0,
    timeout: 15000,
  });
}
export function safeStripeUrl(value: string, kind: "checkout" | "portal") {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !==
      (kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com")
  )
    throw new ApiError("Unexpected provider redirect", 502);
  return value;
}
export function billingBridge() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ApiError("Billing database bridge is not configured", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function billingRpc(
  client: SupabaseClient,
  action: string,
  payload: unknown,
) {
  const { data, error } = await client.rpc("billing_access", {
    p_action: action,
    p_payload: payload,
  });
  if (error)
    throw new ApiError(
      error.code === "42501"
        ? "Organization owner required"
        : error.code === "PT409"
          ? error.message
          : "Billing database is unavailable",
      error.code === "42501" ? 403 : error.code === "PT409" ? 409 : 503,
    );
  return data;
}
export async function serviceRpc(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await client.rpc("billing_service", {
    p_action: action,
    p_payload: { ...payload, livemode: false },
  });
  if (error)
    throw new ApiError(
      "Billing synchronization could not complete. Retry reconciliation.",
      error.code === "PT409" ? 409 : 503,
    );
  return data;
}
async function currentSubscriptions(stripe: Stripe, customer: string) {
  const result: SubscriptionState[] = [];
  for await (const subscription of stripe.subscriptions.list({
    customer,
    status: "all",
    limit: 100,
  })) {
    if (subscription.customer !== customer || subscription.livemode)
      throw new ApiError("Provider customer or mode mismatch", 502);
    result.push(subscription as unknown as SubscriptionState);
    if (result.length > 1000)
      throw new ApiError("Subscription review limit exceeded", 503);
  }
  return result;
}
export async function startCheckout(
  client: SupabaseClient,
  org: string,
  plan: "starter" | "pro",
  stripe = stripeClient(),
  bridge = billingBridge(),
) {
  const config = billingConfig();
  const a = await billingRpc(client, "checkout", {
    organization_id: org,
    plan,
  });
  const price = await stripe.prices.retrieve(config.prices[plan]);
  if (
    price.livemode ||
    !price.active ||
    !price.recurring ||
    price.recurring.usage_type !== "licensed"
  )
    throw new ApiError("Choose an active fixed recurring test price", 503);
  let customer = a.customer_id as string | null;
  if (!customer) {
    const created = await stripe.customers.create(
      {},
      { idempotencyKey: `courtside:test:customer:${a.organization_id}` },
    );
    if (created.livemode) throw new ApiError("Live billing is forbidden", 502);
    customer = created.id;
    await serviceRpc(bridge, "attach_customer", {
      attempt_id: a.attempt_id,
      customer_id: customer,
    });
  }
  if (a.session_id) {
    const session = await stripe.checkout.sessions.retrieve(a.session_id);
    if (
      session.livemode ||
      session.customer !== customer ||
      session.mode !== "subscription"
    )
      throw new ApiError("Checkout binding mismatch", 502);
    if (session.status === "expired") {
      await serviceRpc(bridge, "expire_checkout", { attempt_id: a.attempt_id });
      throw new ApiError("Checkout expired. Start a fresh checkout.", 409);
    }
    if (session.status !== "open" || !session.url)
      throw new ApiError(
        "Checkout has completed. Reconcile billing before starting another.",
        409,
      );
    return { url: safeStripeUrl(session.url, "checkout") };
  }
  if (
    (await currentSubscriptions(stripe, customer)).some(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    )
  )
    throw new ApiError(
      "A provider subscription already exists. Reconcile it and use the customer portal.",
      409,
    );
  // Every retry of this reservation sends exactly the same key and parameters.
  const suffix = createHash("sha256")
    .update(a.attempt_id)
    .digest("hex")
    .slice(0, 8)
    .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer,
    line_items: [{ price: config.prices[plan], quantity: 1 }],
    success_url: `${config.origin}/organizations?organization=${a.organization_id}&checkout=returned`,
    cancel_url: `${config.origin}/organizations?organization=${a.organization_id}&checkout=canceled`,
    expires_at: Math.floor(Date.parse(a.expires_at) / 1000),
    integration_identifier: `courtside_saas_${suffix}`,
  };
  await serviceRpc(bridge, "bind_checkout", {
    attempt_id: a.attempt_id,
    customer_id: customer,
    hash: createHash("sha256").update(JSON.stringify(params)).digest("hex"),
  });
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `courtside:test:checkout:${a.attempt_id}`,
  });
  if (
    session.livemode ||
    session.customer !== customer ||
    !session.url ||
    !session.id.startsWith("cs_test_")
  )
    throw new ApiError("Test checkout was not established", 502);
  await serviceRpc(bridge, "save_checkout", {
    attempt_id: a.attempt_id,
    customer_id: customer,
    session_id: session.id,
  });
  return { url: safeStripeUrl(session.url, "checkout") };
}
export async function openPortal(
  client: SupabaseClient,
  org: string,
  stripe = stripeClient(),
) {
  const config = billingConfig();
  const b = await billingRpc(client, "context", { organization_id: org });
  if (!b.customer_id)
    throw new ApiError("No test billing customer exists yet", 409);
  if (!/^bpc_[A-Za-z0-9]+$/.test(config.portal))
    throw new ApiError(
      "Configure a dedicated test Customer Portal configuration",
      503,
    );
  const portalConfig = await stripe.billingPortal.configurations.retrieve(
    config.portal,
  );
  if (portalConfig.livemode || !portalConfig.active)
    throw new ApiError(
      "Customer Portal configuration must be active and test-mode",
      503,
    );
  const session = await stripe.billingPortal.sessions.create({
    customer: b.customer_id,
    configuration: config.portal,
    return_url: `${config.origin}/organizations?organization=${b.organization_id}`,
  });
  return { url: safeStripeUrl(session.url, "portal") };
}
export async function reconcileEvent(
  event: Stripe.Event,
  hash: string,
  stripe = stripeClient(),
  bridge = billingBridge(),
) {
  if (event.livemode || event.account)
    throw new ApiError("Live or Connect billing events are forbidden", 400);
  if (!subscriptionEvents.has(event.type)) return { ignored: true };
  const object = event.data.object as unknown as {
    id: string;
    customer?: string | null;
    charge?: string | { id: string } | null;
  };
  let customer = typeof object.customer === "string" ? object.customer : null;
  if (!customer && riskEvents.has(event.type) && object.charge) {
    const charge = await stripe.charges.retrieve(
      typeof object.charge === "string" ? object.charge : object.charge.id,
    );
    if (charge.livemode) throw new ApiError("Live charges are forbidden", 400);
    customer = typeof charge.customer === "string" ? charge.customer : null;
  }
  const begun = await serviceRpc(bridge, "begin", {
    id: event.id,
    type: event.type,
    hash,
    created: event.created,
    customer_id: customer,
  });
  if (begun.duplicate || begun.ignored) return begun;
  try {
    const state = subscriptionPolicy(
      await currentSubscriptions(stripe, begun.customer_id),
      billingConfig().prices,
      riskEvents.has(event.type),
    );
    return await serviceRpc(bridge, "apply", {
      ...state,
      id: event.id,
      lease: begun.lease,
      customer_id: begun.customer_id,
      event_type: event.type,
      event_session_id: event.type.startsWith("checkout.session.")
        ? object.id
        : null,
    });
  } catch {
    await serviceRpc(bridge, "fail", {
      id: event.id,
      lease: begun.lease,
    }).catch(() => {});
    throw new ApiError(
      "Provider reconciliation failed. Existing data is preserved; retry reconciliation.",
      503,
    );
  }
}
export async function manualReconcile(
  client: SupabaseClient,
  org: string,
  stripe = stripeClient(),
  bridge = billingBridge(),
) {
  const b = await billingRpc(client, "context", { organization_id: org });
  if (!b.customer_id)
    throw new ApiError("No test billing customer exists yet", 409);
  const id = "reconcile_" + randomUUID().replaceAll("-", "");
  const envelope = {
    id,
    type: "customer.subscription.updated",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { id: b.customer_id, customer: b.customer_id } },
  } as unknown as Stripe.Event;
  return reconcileEvent(
    envelope,
    createHash("sha256").update(id).digest("hex"),
    stripe,
    bridge,
  );
}
