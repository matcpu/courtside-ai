import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticate,
  body,
  fail,
  ApiError,
  requireSportRules,
} from "@/lib/server";
import { normalizeDomain, setupSchema, websiteSchema } from "@/lib/launchpad";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const actions = [
  "save_draft",
  "finish",
  "copy",
  "begin_edit",
  "workspace",
  "open_registration",
  "invite",
  "revoke_invite",
  "accept_invite",
  "site_save",
  "site_preview",
  "site_publish",
  "site_unpublish",
  "domain_save",
  "domain_lookup",
] as const;
function enabled() {
  if (process.env.ORGANIZER_SETUP_ENABLED !== "true")
    throw new ApiError("Launchpad is not enabled on this deployment", 404);
}
async function rpc(
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  action: string,
  payload: unknown,
) {
  const { data, error } = await client.rpc("organizer_command", {
    p_action: action,
    p_payload: payload,
  });
  if (error) {
    if (error.code === "42501")
      throw new ApiError(
        "Access denied. Check your role or invitation account and expiry.",
        403,
      );
    if (error.code === "40001" || error.code === "PT409")
      throw new ApiError(
        error.message?.includes("Safety configuration changed")
          ? "The league’s safety settings changed after this draft was opened. Close this draft, reload the current league and open a fresh edit to review the newer settings before finishing. Your draft has not overwritten them."
          : "This draft changed in another window. Reload and review the changes before saving.",
        409,
      );
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      throw new ApiError(
        "Launchpad database rollout is pending owner approval.",
        503,
      );
    throw new ApiError(
      "Could not save this change. Check dates, division names, existing assignments and required fields.",
      400,
    );
  }
  return data;
}
export async function GET(request: Request) {
  try {
    enabled();
    const { client } = await authenticate(request);
    const league = new URL(request.url).searchParams.get("league");
    const data = await rpc(
      client,
      league ? "workspace" : "list",
      league ? { league_id: z.uuid().parse(league) } : {},
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    enabled();
    const { client } = await authenticate(request);
    const b = z
      .object({
        action: z.enum(actions),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await body(request, 450000));
    let p = b.payload;
    if (b.action === "save_draft" || b.action === "finish")
      await requireSportRules(client);
    let token: string | undefined;
    if (b.action === "save_draft")
      p = z
        .object({
          id: z.uuid().nullable(),
          revision: z.number().int().positive().nullable(),
          base_revision: z.number().int().min(0).default(0),
          league_id: z.uuid().nullable(),
          data: setupSchema,
        })
        .parse(p);
    else if (b.action === "finish")
      p = z
        .object({ id: z.uuid(), revision: z.number().int().positive() })
        .parse(p);
    else if (b.action === "accept_invite") {
      const raw = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(p.token);
      p = { hash: createHash("sha256").update(raw).digest("hex") };
    } else {
      z.uuid().parse(p.league_id);
      if (b.action === "invite") {
        p = z
          .object({
            league_id: z.uuid(),
            email: z.email().max(150),
            role: z.enum(["coach", "scorekeeper", "referee"]),
            team_id: z.uuid().nullable(),
          })
          .parse(p);
        token = randomBytes(32).toString("base64url");
        p = { ...p, hash: createHash("sha256").update(token).digest("hex") };
      } else if (b.action === "site_save") {
        p = z
          .object({
            league_id: z.uuid(),
            revision: z.number().int().min(0),
            site: websiteSchema,
          })
          .parse(p);
        const site = websiteSchema.parse(p.site);
        if (site.logo) {
          const bytes = await sharp(
            Buffer.from(site.logo.split(",")[1], "base64"),
            { limitInputPixels: 16000000, animated: false },
          )
            .resize(512, 512, { fit: "inside", withoutEnlargement: true })
            .png()
            .toBuffer()
            .catch(() => {
              throw new ApiError("Choose a readable PNG, JPEG or WebP logo.");
            });
          if (bytes.length > 250000)
            throw new ApiError("Use a simpler logo below 250 KB.");
          site.logo = "data:image/png;base64," + bytes.toString("base64");
        }
        p.site = site;
      } else if (b.action === "site_publish")
        p = z
          .object({
            league_id: z.uuid(),
            revision: z.number().int().positive(),
            approved_public: z.literal(true),
          })
          .parse(p);
      else if (b.action === "revoke_invite")
        p = z.object({ league_id: z.uuid(), id: z.uuid() }).parse(p);
      else if (b.action === "domain_save" || b.action === "domain_lookup") {
        const value = z.string().max(253).parse(p.domain);
        try {
          p = { league_id: p.league_id, domain: normalizeDomain(value) };
        } catch {
          throw new ApiError("Enter a domain name without a URL or path.");
        }
      }
    }
    if (b.action === "domain_lookup") {
      await rpc(client, "workspace", { league_id: p.league_id });
      const domain = String(p.domain);
      // Fixed official registry host: no arbitrary URL, redirects or registrant data.
      if (!/^[a-z0-9-]+\.com$/.test(domain))
        throw new ApiError(
          "This preview supports official .com RDAP lookup only. Other extensions require manual registrar checks.",
        );
      const url =
        "https://rdap.verisign.com/com/v1/domain/" + encodeURIComponent(domain);
      const response = await fetch(url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/rdap+json, application/json" },
      }).catch(() => {
        throw new ApiError(
          "Registry lookup could not complete. No availability conclusion was made.",
          502,
        );
      });
      if (![200, 404].includes(response.status))
        throw new ApiError(
          "Registry lookup unavailable. No availability conclusion was made.",
          502,
        );
      if (response.status === 200) {
        const raw = await response.text();
        if (raw.length > 250000)
          throw new ApiError(
            "Registry response exceeded the lookup limit.",
            502,
          );
        const result = JSON.parse(raw);
        if (String(result.ldhName ?? "").toLowerCase() !== domain)
          throw new ApiError(
            "Registry did not confirm the requested name.",
            502,
          );
      }
      return NextResponse.json(
        {
          domain,
          status: "Registration lookup completed",
          registered: response.status === 200,
          purchaseAvailability: "Not confirmed",
          checkedAt: new Date().toISOString(),
          source: url,
          note: "No registration record does not establish purchase availability. No purchase, trademark or social-handle check was performed.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const data = await rpc(client, b.action, p);
    return NextResponse.json(
      token ? { ...data, invitation: "/join#invite=" + token } : data,
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
