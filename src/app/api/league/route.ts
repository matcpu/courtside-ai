import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import {
  ApiError,
  authenticate,
  body,
  command,
  db,
  fail,
  requireSportRules,
} from "@/lib/server";
import { dispatch } from "@/lib/notifications";
import { sportSchema, sportRulesSchema } from "@/lib/sports";
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
      // my_leagues is subject to league RLS, which also permits public rows.
      // A private snapshot is the authoritative membership check; public visibility
      // must never turn a public reference league into the user's workspace.
      const choices = isPublic
        ? data
        : (
            await Promise.all(
              (data ?? []).map(
                async (row: {
                  id: string;
                  name: string;
                  slug: string;
                  is_demo: boolean;
                  season_name: string;
                }) => {
                  const { data: member, error: denied } = await client.rpc(
                    "league_snapshot",
                    { p_league: row.id, p_public: false },
                  );
                  if (denied?.code === "42501") return null;
                  if (denied)
                    throw new ApiError(
                      "Could not verify league memberships. Reload and try again.",
                      503,
                    );
                  if (!member?.role) return null;
                  return {
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    is_demo: row.is_demo,
                    season_name: row.season_name,
                    role: member.role,
                  };
                },
              ),
            )
          ).filter(Boolean);
      return NextResponse.json(choices, {
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
  "configure_sport",
  "create_league",
  "configure_public",
  "invite_member",
  "assign_coach",
  "mark_notification_read",
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
      if (b.payload.sport || b.payload.sportRules)
        await requireSportRules(client);
      z.object({
        name: z.string().min(2).max(100),
        season: z.string().min(2).max(80),
        cutoff: z.iso.date(),
        demo: z.boolean().optional(),
      }).parse(b.payload);
    } else if (!b.league) throw new Error("League required");
    if (b.action === "configure_sport") {
      await requireSportRules(client);
      b.payload = z
        .object({
          sport: sportSchema,
          sportRules: sportRulesSchema,
          expected_sport_revision: z.number().int().positive(),
        })
        .parse(b.payload);
    }
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
