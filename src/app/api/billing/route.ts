import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, body, fail, ApiError } from "@/lib/server";
import {
  billingConfig,
  startCheckout,
  openPortal,
  manualReconcile,
} from "@/lib/stripe-billing";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        organization_id: z.uuid(),
        action: z.enum(["checkout", "portal", "reconcile"]),
        plan: z.enum(["starter", "pro"]).optional(),
      })
      .parse(await body(request, 4000));
    billingConfig();
    const data =
      b.action === "checkout"
        ? await startCheckout(
            client,
            b.organization_id,
            z.enum(["starter", "pro"]).parse(b.plan),
          )
        : b.action === "portal"
          ? await openPortal(client, b.organization_id)
          : await manualReconcile(client, b.organization_id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(
      e instanceof ApiError || e instanceof z.ZodError
        ? e
        : new ApiError(
            "Stripe test service is unavailable. No plan change was granted.",
            503,
          ),
    );
  }
}
