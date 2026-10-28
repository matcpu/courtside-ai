import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError, fail } from "@/lib/server";
import { metaIsEnabled, metaModel } from "@/lib/meta";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request),
      league = z.uuid().parse(new URL(request.url).searchParams.get("league"));
    const { data, error } = await client.rpc("meta_evidence_list", {
      p_league: league,
    });
    if (error)
      throw new ApiError(
        "Only league administrators can inspect model evidence",
        403,
      );
    return NextResponse.json(
      {
        enabled: metaIsEnabled(),
        configured: Boolean(process.env.MODEL_API_KEY),
        model: metaModel(),
        evidence: data,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
