import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, body, command, fail, reserveAI } from "@/lib/server";
import {
  questionnaireSchema,
  initialRating,
  divisionForRating,
} from "@/lib/domain";
import { dataBoundary, metaJSON, metaIsEnabled } from "@/lib/meta";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid(),
        name: z.string().min(2).max(100),
        assessment: questionnaireSchema,
        phone: z.string().max(20).default(""),
        sms_consent: z.boolean().default(false),
      })
      .parse(await body(request));
    if (b.sms_consent && !/^\+[1-9][0-9]{7,14}$/.test(b.phone))
      return NextResponse.json(
        { error: "SMS consent requires a valid international phone number" },
        { status: 400 },
      );
    const rating = initialRating(b.assessment),
      tier = divisionForRating(rating);
    let explanation = `Questionnaire rubric recommends tier ${tier} with an initial rating of ${rating}. Based on experience, years together and weekly practices. Administrator approval is required.`,
      ai = false;
    if (metaIsEnabled()) {
      await reserveAI(client, b.league, "registration");
      const result = await metaJSON(
        z.object({
          explanation: z.string(),
          uncertainties: z.array(z.string()),
        }),
        dataBoundary +
          " Explain the deterministic team placement using only this questionnaire. Do not override its tier. Clearly identify self-reported information and uncertainty.",
        JSON.stringify({
          assessment: b.assessment,
          deterministicTier: tier,
          initialRating: rating,
        }),
      );
      explanation = result.explanation + " " + result.uncertainties.join(" ");
      ai = true;
    }
    const result = await command(client, b.league, "register_team", {
      ...b,
      explanation,
    });
    return NextResponse.json({ ...result, rating, tier, explanation, ai });
  } catch (e) {
    return fail(e);
  }
}
