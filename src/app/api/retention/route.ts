import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { documentStorage, deleteAgeDocument } from "@/lib/document-storage";
import { authenticate, body, ApiError, fail } from "@/lib/server";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function sweep(league?: string) {
  let deleted = 0,
    failed = 0,
    morePossible = false;
  const deadline = Date.now() + 45000;
  do {
    const { data, error } = await documentStorage().rpc(
      "document_maintenance",
      { p_action: "claim_due", p_payload: league ? { league_id: league } : {} },
    );
    if (error) throw new ApiError("Retention scan failed", 500);
    const results = await Promise.allSettled(
      data.map((item: { id: string; path: string; lease: string }) =>
        deleteAgeDocument(item),
      ),
    );
    failed += results.filter((r) => r.status === "rejected").length;
    deleted += results.filter((r) => r.status === "fulfilled").length;
    morePossible = data.length === 30;
    if (failed || !morePossible) break;
  } while (Date.now() < deadline);
  return NextResponse.json(
    { deleted, failed, morePossible },
    { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !expected ||
    !actual ||
    Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return await sweep();
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request),
      { league } = z
        .object({ league: z.uuid() })
        .parse(await body(request, 1000));
    const { data, error } = await client.rpc("preseason_snapshot", {
      p_league: league,
    });
    if (error || data.role !== "admin")
      throw new ApiError(
        "Only league administrators can run document retention",
        403,
      );
    return sweep(league);
  } catch (e) {
    return fail(e);
  }
}
