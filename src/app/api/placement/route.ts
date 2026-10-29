import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, body, ApiError, fail, reserveAI } from "@/lib/server";
import {
  preseasonQuestionnaire,
  placementInterpretation,
  type PreseasonData,
} from "@/lib/preseason";
import {
  dataBoundary,
  metaIsEnabled,
  metaJSON,
  type MetaReceipt,
} from "@/lib/meta";
import { recordMetaEvidence, redactCoachContext } from "@/lib/meta-evidence";
import { assertMetaScope } from "@/lib/meta-control";
import { placementInstructions } from "@/lib/meta-prompts";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { client, user } = await authenticate(request),
      b = z
        .object({ league: z.uuid(), team_id: z.uuid() })
        .parse(await body(request));
    if (!metaIsEnabled())
      throw new ApiError(
        "Meta placement interpretation is paused. No API call was made.",
        503,
      );
    assertMetaScope("placement", b.league, user.id);
    const { data, error } = await client.rpc("preseason_snapshot", {
      p_league: b.league,
    });
    if (error) throw new ApiError("Questionnaire access denied", 403);
    const s = data as PreseasonData,
      q = s.questionnaires.find(
        (q) => q.team_id === b.team_id && q.status === "submitted",
      );
    if (!q)
      throw new ApiError(
        "Submit the comprehensive questionnaire before requesting interpretation",
      );
    const answer = preseasonQuestionnaire.parse(q.data);
    await reserveAI(client, b.league, "preseason_placement");
    let receipt: MetaReceipt | undefined;
    const interpretation = await metaJSON(
      placementInterpretation,
      placementInstructions,
      JSON.stringify({
        questionnaire: {
          ...answer,
          notes: redactCoachContext(answer.notes),
          previousLeague: redactCoachContext(answer.previousLeague),
          previousDivision: redactCoachContext(answer.previousDivision),
        },
        deterministic: q.recommendation,
      }),
      (r) => {
        receipt = r;
      },
      "placement",
      { league: b.league, actor: user.id },
    );
    if (!receipt) throw new ApiError("No provider evidence was returned", 502);
    const evidence = await recordMetaEvidence(
      b.league,
      user.id,
      "placement",
      b.team_id,
      receipt,
      [],
      q.revision,
    );
    return NextResponse.json(
      { interpretation, evidence, requiresHumanApproval: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
