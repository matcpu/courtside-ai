import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, command } from "./server";
export type Delivery = {
  id: string;
  channel: "email" | "sms";
  destination: string;
  subject: string;
  body: string;
  idempotency_key: string;
  lease_id: string;
};
export async function deliver(item: Delivery, fetcher: typeof fetch = fetch) {
  if (process.env.NOTIFICATIONS_ENABLED !== "true")
    throw new ApiError(
      "Email sending is disabled. Configure credentials and enable notifications.",
      503,
    );
  if (/@(?:example\.(?:com|org|net)|.*\.invalid)$/i.test(item.destination))
    return {
      status: "suppressed",
      error: "Synthetic demo recipient: no message sent",
      provider_id: null,
    };
  if (item.channel === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
      throw new ApiError(
        "Resend credentials or verified sender are missing",
        503,
      );
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": item.idempotency_key,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [item.destination],
        subject: item.subject,
        text: item.body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      throw new ApiError(`Resend rejected delivery (${res.status})`, 502);
    const data = await res.json();
    if (!data.id) throw new ApiError("Resend returned no message ID", 502);
    return { status: "accepted", provider_id: data.id, error: null };
  }
  // SMS remains fail-closed until verified inbound STOP handling and provider credentials are configured.
  throw new ApiError(
    "SMS sending is not enabled. Consent is saved; no SMS was sent.",
    503,
  );
}
export async function dispatch(client: SupabaseClient, league: string) {
  if (
    process.env.NOTIFICATIONS_ENABLED !== "true" ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM
  )
    throw new ApiError(
      "Resend is not configured for sending. Notifications remain queued.",
      503,
    );
  const items = (await command(
    client,
    league,
    "claim_notifications",
  )) as Delivery[];
  const results = [];
  for (const item of items) {
    let outcome;
    try {
      outcome = await deliver(item);
    } catch (e) {
      outcome = {
        status: "failed",
        error:
          e instanceof ApiError
            ? e.message
            : "Provider request failed or timed out",
        provider_id: null,
      };
    }
    await command(client, league, "finish_notification", {
      notification_id: item.id,
      lease_id: item.lease_id,
      ...outcome,
    });
    results.push({ id: item.id, ...outcome });
  }
  return results;
}
