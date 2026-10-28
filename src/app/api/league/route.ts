import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { authenticate, body, command, db, fail } from "@/lib/server";
import { dispatch } from "@/lib/notifications";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get("id"),
      isPublic = searchParams.get("public") === "true";
    const client = isPublic ? db() : (await authenticate(request)).client;
    if (!league) {
      const { data, error } = await client.rpc(
        isPublic ? "public_leagues" : "my_leagues",
      );
      if (error) throw error;
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    z.uuid().parse(league);
    const { data, error } = await client.rpc("league_snapshot", {
      p_league: league,
      p_public: isPublic,
    });
    if (error)
      return NextResponse.json(
        { error: "League not found or access denied" },
        { status: 403 },
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
const allowed = [
  "create_league",
  "configure_public",
  "invite_member",
  "approve_team",
  "reject_team",
  "add_court",
  "add_availability",
  "add_player",
  "verify_player",
  "reject_scoresheet",
  "reopen_result",
  "reject_schedule",
  "publish_schedule",
  "propose_balance",
  "decide_proposal",
  "set_sms_consent",
] as const;
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid().nullable(),
        action: z.enum(allowed),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await body(request));
    if (b.action === "create_league") {
      z.object({
        name: z.string().min(2).max(100),
        season: z.string().min(2).max(80),
        cutoff: z.iso.date(),
        demo: z.boolean().optional(),
      }).parse(b.payload);
    } else if (!b.league) throw new Error("League required");
    const result = await command(client, b.league, b.action, b.payload);
    if (
      b.action === "publish_schedule" &&
      b.league &&
      process.env.NOTIFICATIONS_ENABLED === "true" &&
      process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM
    ) {
      const league = b.league;
      // Publication is already committed. A provider failure must never undo it
      // or report that approval failed; the durable outbox retains retry state.
      after(async () => {
        try {
          await dispatch(client, league);
        } catch {
          // A transport/database outage leaves durable leases/pending work.
          // Administrators can resume the queue; no false delivery is recorded.
        }
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return fail(e);
  }
}
