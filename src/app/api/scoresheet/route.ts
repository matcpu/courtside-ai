import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  authenticate,
  body,
  command,
  fail,
  snapshot,
  reserveAI,
} from "@/lib/server";
import { extractionSchema, validateExtraction } from "@/lib/domain";
import {
  dataBoundary,
  metaJSON,
  metaIsEnabled,
  type MetaReceipt,
} from "@/lib/meta";
import { recordMetaEvidence } from "@/lib/meta-evidence";
import { assertMetaScope } from "@/lib/meta-control";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { client, user } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid(),
        game_id: z.uuid(),
        path: z.string().max(300),
        mode: z.enum(["meta", "manual"]),
        extraction: extractionSchema.optional(),
      })
      .parse(await body(request));
    const s = await snapshot(client, b.league),
      game = s.games.find((g) => g.id === b.game_id);
    if (!game) throw new ApiError("Game not found");
    if (
      !["admin", "scorekeeper"].includes(s.role) &&
      !s.teams.some(
        (t) =>
          [game.home_team_id, game.away_team_id].includes(t.id) &&
          t.coach_id === user.id,
      )
    )
      throw new ApiError("Scoresheet access denied", 403);
    if (!b.path.startsWith(`${b.league}/${user.id}/`))
      throw new ApiError("Invalid private upload path", 403);
    const { data: file, error } = await client.storage
      .from("scoresheets")
      .download(b.path);
    if (error || !file)
      throw new ApiError("Private upload could not be read", 400);
    if (
      file.size > 6 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new ApiError("Use a JPEG, PNG or WebP under 6 MB");
    const bytes = Buffer.from(await file.arrayBuffer()),
      sha256 = createHash("sha256").update(bytes).digest("hex");
    const magic =
      (bytes[0] === 0xff && bytes[1] === 0xd8) ||
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WEBP");
    if (!magic) throw new ApiError("The file is not a supported image");
    const home = s.teams.find((t) => t.id === game.home_team_id)!.name,
      away = s.teams.find((t) => t.id === game.away_team_id)!.name;
    if (b.mode === "meta" && !metaIsEnabled())
      throw new ApiError(
        "Meta scoresheet recognition is paused. No API call was made.",
        503,
      );
    if (b.mode === "meta") {
      assertMetaScope("scoresheet", b.league, user.id);
      await reserveAI(client, b.league, "scoresheet");
    }
    let receipt: MetaReceipt | undefined;
    const extraction =
      b.mode === "meta"
        ? await metaJSON(
            extractionSchema,
            dataBoundary +
              " Read the final result from the scoresheet image. Return exactly the names as visible, final scores, confidence and warnings. If a field is unreadable, return null and explain. Include only explicitly recorded player stats; an empty players array means not recorded. Do not infer missing statistics or use the expected fixture to invent team names.",
            [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `Expected fixture for validation only: ${home} versus ${away}. Extract only the image.`,
                  },
                  {
                    type: "input_image",
                    image_url: `data:${file.type};base64,${bytes.toString("base64")}`,
                    detail: "high",
                  },
                ],
              },
            ],
            (r) => {
              receipt = r;
            },
            "scoresheet",
          )
        : b.extraction;
    if (!extraction) throw new ApiError("Manual extraction is required");
    const warnings = validateExtraction(extraction, home, away);
    const result = await command(client, b.league, "submit_scoresheet", {
      game_id: b.game_id,
      sha256,
      storage_path: b.path,
      extraction,
      source: b.mode === "meta" ? "meta" : "manual",
    });
    const evidence = receipt
      ? await recordMetaEvidence(
          b.league,
          user.id,
          "scoresheet",
          result.id,
          receipt,
        )
      : null;
    return NextResponse.json({
      ...result,
      extraction,
      validationWarnings: warnings,
      official: false,
      evidence,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid(),
        sheet_id: z.uuid(),
        extraction: extractionSchema,
        reviewed: z.literal(true),
        correction_reason: z.string().max(1000).optional(),
      })
      .parse(await body(request));
    if (b.extraction.homeScore === null || b.extraction.awayScore === null)
      throw new ApiError("Both scores are required");
    return NextResponse.json(
      await command(client, b.league, "confirm_result", b),
    );
  } catch (e) {
    return fail(e);
  }
}
