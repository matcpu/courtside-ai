import { NextResponse } from "next/server";
import { db } from "@/lib/server";
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
      meta: Boolean(process.env.MODEL_API_KEY),
      email: Boolean(
        process.env.RESEND_API_KEY &&
        process.env.RESEND_FROM &&
        process.env.NOTIFICATIONS_ENABLED === "true",
      ),
      sms: false,
    },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
