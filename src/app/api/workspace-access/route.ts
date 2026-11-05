import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, snapshot, fail } from "@/lib/server";
import { workspaceHref } from "@/lib/product-navigation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = z.uuid().parse(new URL(request.url).searchParams.get("league"));
    const { client } = await authenticate(request);
    // PostgreSQL's private snapshot verifies actual tenant membership. Never trust a URL or UI role.
    const league = await snapshot(client, id);
    let website: string | null = null;
    if (process.env.ORGANIZER_SETUP_ENABLED === "true") {
      const { data, error } = await client.rpc("public_launch_site", {
        p_slug: league.league.slug,
      });
      if (!error && data)
        website = `/league/${encodeURIComponent(league.league.slug)}/website`;
    }
    if (!website) {
      const { data } = await client.rpc("public_leagues");
      if (data?.some((row: { id: string }) => row.id === id))
        website = `/league/${encodeURIComponent(league.league.slug)}/website`;
    }
    return NextResponse.json(
      {
        canManage: league.role === "admin",
        dashboard: workspaceHref(id),
        website,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Authorization",
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
