import { NextResponse } from "next/server";
import { z } from "zod";
import {
  admin,
  ApiError,
  authenticate,
  body,
  command,
  fail,
  snapshot,
  reserveAI,
} from "@/lib/server";
import { roundRobin, schedule } from "@/lib/domain";
import { dataBoundary, metaJSON } from "@/lib/meta";
export const maxDuration = 60;
export async function draftSchedule(
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  league: string,
  round: number,
  useMeta = false,
) {
  const s = await snapshot(client, league);
  admin(s);
  const published = s.versions.find((v) => v.status === "published");
  const locked = s.fixtures.filter(
    (f) =>
      f.version_id === published?.id &&
      s.games.find((g) => g.id === f.game_id)?.status === "confirmed",
  );
  const pairs = roundRobin(s.teams, round).map((p) => ({
    ...p,
    game_id: crypto.randomUUID(),
  }));
  if (!pairs.length)
    throw new ApiError(
      "Approve at least two teams in the same division first.",
    );
  const generated = schedule(
    pairs,
    s.availability,
    locked,
    60,
    30,
    new Date().toISOString(),
  );
  if (generated.unscheduled.length)
    throw new ApiError(
      `No feasible schedule: ${generated.unscheduled.length} games need more confirmed court time. No draft was saved.`,
      409,
    );
  let explanation = `Round ${round + 1}: ${pairs.length} games assigned to confirmed courts. Minimum 30-minute rest enforced; ${locked.length} completed fixtures retained. All future fixtures in the prior version will be replaced on approval.`,
    ai = false;
  if (useMeta) {
    await reserveAI(client, league, "schedule_explanation");
    const text = await metaJSON(
      z.object({ explanation: z.string() }),
      dataBoundary +
        " Explain this deterministic schedule change for coaches. Only describe the supplied facts.",
      JSON.stringify({
        round: round + 1,
        games: pairs.length,
        locked: locked.length,
        previousVersion: published?.number ?? 0,
        restMinutes: 30,
      }),
    );
    explanation = text.explanation;
    ai = true;
  }
  const result = await command(client, league, "draft_schedule", {
    base_revision: s.league.revision,
    data_revision: s.league.data_revision,
    fixtures: generated.fixtures,
    explanation,
  });
  return { ...result, fixtures: generated.fixtures.length, explanation, ai };
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid(),
        round: z.number().int().min(0).max(499).default(0),
        useMeta: z.boolean().default(false),
      })
      .parse(await body(request));
    return NextResponse.json(
      await draftSchedule(client, b.league, b.round, b.useMeta),
    );
  } catch (e) {
    return fail(e);
  }
}
