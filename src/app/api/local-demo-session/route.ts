import { NextResponse } from "next/server";
import {
  localDemoEnabled,
  localDemoSession,
  localDemoDescription,
  prepareLocalDemo,
} from "@/lib/local-demo-server";
import { localDemoSameOrigin } from "@/lib/local-demo-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Origin",
};
export async function GET(request: Request) {
  if (!localDemoEnabled(request))
    return NextResponse.json({ enabled: false }, { status: 404, headers });
  try {
    const session = await localDemoSession(request);
    return NextResponse.json(
      session
        ? localDemoDescription(session)
        : { enabled: true, active: false },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Local demo session unavailable" },
      { status: 401, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!localDemoEnabled(request))
    return NextResponse.json({ enabled: false }, { status: 404, headers });
  if (!localDemoSameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin local preview required" },
      { status: 403, headers },
    );
  try {
    const { description, cookie } = await prepareLocalDemo(request);
    const response = NextResponse.json(description, { headers });
    if (cookie) response.cookies.set(cookie);
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not prepare the isolated synthetic demo. Check the existing loopback preview services.",
      },
      { status: 503, headers },
    );
  }
}
