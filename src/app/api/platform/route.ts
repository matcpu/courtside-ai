import { NextResponse } from "next/server";
import { authenticate, ApiError, fail } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request);
    const { data, error } = await client.rpc("platform_overview");
    if (error)
      throw new ApiError("Platform administrator access required", 403);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
