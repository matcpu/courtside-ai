import { NextResponse } from "next/server";
import { db } from "@/lib/server";
import { metaIsEnabled } from "@/lib/meta";
import { emailConfiguration } from "@/lib/notifications";
export const dynamic = "force-dynamic";
export async function GET() {
  let database = false;
  let email = false;
  let emailMode = "disabled";
  try {
    const config = emailConfiguration();
    email = true;
    emailMode = config.mode;
  } catch {}
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
      email,
      emailMode,
      sms: false,
      privateDocumentsConfigured: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      retentionConfigured: Boolean(process.env.CRON_SECRET),
    },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
