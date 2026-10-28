import { NextResponse } from "next/server";
import { db } from "@/lib/server";
import { metaIsEnabled } from "@/lib/meta";
export const dynamic = "force-dynamic";
export async function GET() {
  let database = false;
  try {
    const { error } = await db().rpc("public_leagues");
    database = !error;
  } catch {}
  return NextResponse.json(
    {
      app: "Courtside AI",
      database,
      meta: metaIsEnabled(),
      metaConfigured: Boolean(process.env.MODEL_API_KEY),
      metaEnabled: process.env.META_API_ENABLED === "true",
      email: Boolean(
        process.env.RESEND_API_KEY &&
        process.env.RESEND_FROM &&
        process.env.NOTIFICATIONS_ENABLED === "true",
      ),
      sms: false,
      privateDocumentsConfigured: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      retentionConfigured: Boolean(process.env.CRON_SECRET),
    },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
