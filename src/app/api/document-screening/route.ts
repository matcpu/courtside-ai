import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError, body, fail } from "@/lib/server";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request),
      params = new URL(request.url).searchParams;
    const { data, error } = await client.rpc("document_screening", {
      p_league: z.uuid().parse(params.get("league")),
      p_document: z.uuid().parse(params.get("document")),
    });
    if (error)
      throw new ApiError(
        "Document screening access denied or original expired",
        403,
      );
    return NextResponse.json(data, { headers });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request),
      p = z
        .object({
          league: z.uuid(),
          document: z.uuid(),
          reason: z.string().min(10).max(1000),
        })
        .parse(await body(request, 3000));
    const { data, error } = await client.rpc("document_screening", {
      p_league: p.league,
      p_document: p.document,
      p_action: "escalate",
      p_reason: p.reason,
    });
    if (error)
      throw new ApiError(
        "Escalation denied; only an authorized reviewer can escalate a pending document",
        403,
      );
    return NextResponse.json(data, { headers });
  } catch (error) {
    return fail(error);
  }
}
