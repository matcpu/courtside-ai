import { NextResponse } from "next/server";
import { z } from "zod";
import { admin, authenticate, body, fail, snapshot } from "@/lib/server";
import { dispatch } from "@/lib/notifications";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const { league } = z
      .object({ league: z.uuid() })
      .parse(await body(request));
    admin(await snapshot(client, league));
    return NextResponse.json({ results: await dispatch(client, league) });
  } catch (e) {
    return fail(e);
  }
}
