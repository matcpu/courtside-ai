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
export function emailConfiguration() {
  if (process.env.NOTIFICATIONS_ENABLED !== "true")
    throw new ApiError(
      "Email sending is disabled. Configure credentials and enable notifications.",
      503,
    );
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    throw new ApiError(
      "Resend credentials or verified sender are missing",
      503,
    );
  const from = process.env.RESEND_FROM;
  const address = (from.match(/<([^<>]+)>$/)?.[1] ?? from).trim().toLowerCase();
  if (/[\r\n]/.test(from))
    throw new ApiError("Invalid sender configuration", 503);
  const mode = process.env.EMAIL_DELIVERY_MODE ?? "test";
  if (mode === "test") {
    const recipient = process.env.EMAIL_TEST_RECIPIENT?.trim().toLowerCase();
    if (
      address !== "onboarding@resend.dev" ||
      !recipient ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
    )
      throw new ApiError(
        "Test email requires the Resend testing sender and one authorized recipient",
        503,
      );
    return { mode, recipient } as const;
  }
  if (
    mode !== "production" ||
    address.endsWith("@resend.dev") ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
  )
    throw new ApiError(
      "Production email requires an explicitly configured verified sender",
      503,
    );
  return { mode, recipient: null } as const;
}
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
    const config = emailConfiguration();
    if (
      config.mode === "test" &&
      item.destination.trim().toLowerCase() !== config.recipient
    )
      return {
        status: "suppressed",
        error:
          "Test mode permits only the authorized test inbox; no message sent",
        provider_id: null,
      };
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
export async function dispatch(
  client: SupabaseClient,
  league: string,
  fetcher: typeof fetch = fetch,
) {
  if (
    process.env.NOTIFICATIONS_ENABLED !== "true" ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM
  )
    throw new ApiError(
      "Resend is not configured for sending. Notifications remain queued.",
      503,
    );
  emailConfiguration();
  const items = (await command(
    client,
    league,
    "claim_notifications",
  )) as Delivery[];
  const results = [];
  for (const item of items) {
    let outcome;
    try {
      outcome = await deliver(item, fetcher);
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
