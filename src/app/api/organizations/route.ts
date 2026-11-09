import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, body, fail, ApiError } from "@/lib/server";
import { organizationAction } from "@/lib/organizations";
import { billingConfig } from "@/lib/stripe-billing";
export const dynamic = "force-dynamic";
async function run(
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  action: string,
  p: unknown,
) {
  const { data, error } = await client.rpc("organization_command", {
    p_action: action,
    p_payload: p,
  });
  if (error)
    throw new ApiError(
      error.code === "42501"
        ? "Organization access denied"
        : error.code === "PT409"
          ? error.message
          : "Organization change could not be saved. Check the fields and database rollout.",
      error.code === "42501"
        ? 403
        : error.code === "PT409"
          ? 409
          : ["PGRST202", "42P01"].includes(error.code)
            ? 503
            : 400,
    );
  return data;
}
export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request);
    const id = new URL(request.url).searchParams.get("organization");
    const data = await run(
      client,
      id ? "get" : "list",
      id ? { organization_id: z.uuid().parse(id) } : {},
    );
    let billing_enabled = false;
    try {
      billingConfig();
      billing_enabled = true;
    } catch {}
    return NextResponse.json(
      { ...data, billing_enabled },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        action: organizationAction,
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await body(request, 20000));
    let p = b.payload,
      token: string | undefined;
    if (["create", "rename", "create_program"].includes(b.action))
      z.string().trim().min(2).max(100).parse(p.name);
    if (!["list", "create", "personal", "accept"].includes(b.action))
      z.uuid().parse(p.organization_id);
    if (b.action === "invite") {
      p = {
        organization_id: z.uuid().parse(p.organization_id),
        email: z.email().max(150).parse(p.email).toLowerCase(),
        role: z.enum(["admin", "member"]).parse(p.role),
      };
      token = randomBytes(32).toString("base64url");
      p.hash = createHash("sha256").update(token).digest("hex");
    } else if (b.action === "accept") {
      const raw = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(p.token);
      p = { hash: createHash("sha256").update(raw).digest("hex") };
    } else if (
      [
        "set_role",
        "remove_member",
        "transfer_owner",
        "grant_league_role",
      ].includes(b.action)
    )
      z.uuid().parse(p.user_id);
    if (b.action === "grant_league_role") z.uuid().parse(p.league_id);
    if (b.action === "revoke_invite") z.uuid().parse(p.invitation_id);
    const data = await run(client, b.action, p);
    return NextResponse.json(
      {
        ...data,
        ...(token ? { invitation_path: `/organizations#invite=${token}` } : {}),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
