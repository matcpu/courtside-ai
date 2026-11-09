import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, fail } from "@/lib/server";
import {
  billingConfig,
  stripeClient,
  reconcileEvent,
} from "@/lib/stripe-billing";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const config = billingConfig(),
      stripe = stripeClient();
    if (Number(request.headers.get("content-length") ?? 0) > 256000)
      throw new ApiError("Webhook is too large", 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 256000)
      throw new ApiError("Webhook is too large", 413);
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ApiError("Missing signature", 400);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        raw,
        signature,
        config.secret,
        300,
      );
    } catch {
      throw new ApiError("Invalid webhook signature", 400);
    }
    const result = await reconcileEvent(
      event,
      createHash("sha256").update(raw).digest("hex"),
      stripe,
    );
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    return fail(
      e instanceof ApiError
        ? e
        : new ApiError(
            "Webhook processing is unavailable; retry delivery.",
            503,
          ),
    );
  }
}
