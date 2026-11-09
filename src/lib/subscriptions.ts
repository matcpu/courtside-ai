/** Normalize CURRENT provider state, never an out-of-order webhook snapshot. */
export type SubscriptionState = {
  id: string;
  customer: string;
  livemode: boolean;
  status: string;
  created: number;
  cancel_at_period_end: boolean;
  items: {
    data: {
      price: { id: string };
      quantity?: number | null;
      current_period_end?: number;
    }[];
    has_more?: boolean;
  };
};
export function subscriptionPolicy(
  subscriptions: SubscriptionState[],
  prices: { starter: string; pro: string },
  risk = false,
) {
  if (subscriptions.some((s) => s.livemode))
    throw Error("Live subscriptions are forbidden");
  const live = subscriptions.filter(
    (s) => !["canceled", "incomplete_expired"].includes(s.status),
  );
  const s = (live.length ? live : subscriptions).toSorted(
    (a, b) => b.created - a.created || a.id.localeCompare(b.id),
  )[0];
  const defaults = {
    subscription_id: s?.id ?? null,
    status: s?.status ?? "none",
    plan: "free",
    cancel_at_period_end: s?.cancel_at_period_end ?? false,
    period_end: null as string | null,
    issue_code: null as string | null,
  };
  if (live.length > 1)
    return { ...defaults, issue_code: "multiple_subscriptions" };
  if (!s) return { ...defaults, issue_code: risk ? "risk_review" : null };
  if (
    s.items.has_more ||
    s.items.data.length !== 1 ||
    s.items.data[0].quantity !== 1
  )
    return { ...defaults, issue_code: "unknown_price" };
  const item = s.items.data[0];
  const tier =
    item.price.id === prices.starter
      ? "starter"
      : item.price.id === prices.pro
        ? "pro"
        : null;
  const period_end = item.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;
  if (!tier) return { ...defaults, period_end, issue_code: "unknown_price" };
  if (!["active", "trialing"].includes(s.status))
    return { ...defaults, period_end, issue_code: "subscription_not_active" };
  return {
    ...defaults,
    period_end,
    plan: tier,
    issue_code: risk ? "risk_review" : null,
  };
}
export const subscriptionEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
]);
export const riskEvents = new Set([
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
]);
