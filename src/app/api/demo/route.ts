import { NextResponse } from "next/server";
import { ApiError, authenticate, fail } from "@/lib/server";
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const { data, error } = await client.rpc("create_demo");
    if (error) throw new ApiError(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return fail(e);
  }
}
