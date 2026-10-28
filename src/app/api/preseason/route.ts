import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, body, fail, ApiError } from "@/lib/server";
import { preseasonQuestionnaire, settingsSchema } from "@/lib/preseason";
import {
  deleteAgeDocument,
  documentStorage,
  invitationHash,
} from "@/lib/document-storage";
import { deliver } from "@/lib/notifications";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const actions = [
  "configure",
  "configure_division",
  "save_questionnaire",
  "submit_roster",
  "withdraw_player",
  "invite_guardian",
  "revoke_invitation",
  "review_document",
  "open_document",
  "delete_document",
] as const;
export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request);
    const league = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("league"));
    const { data, error } = await client.rpc("preseason_snapshot", {
      p_league: league,
    });
    if (error) throw new ApiError("Preseason access denied", 403);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticate(request);
    const b = z
      .object({
        league: z.uuid(),
        action: z.enum(actions),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await body(request, 50000));
    let payload = b.payload,
      dbAction: string = b.action,
      token: string | undefined;
    if (b.action === "configure") payload = settingsSchema.parse(payload);
    if (b.action === "configure_division")
      payload = z
        .object({
          name: z.string().min(2).max(100),
          age_category: z.string().min(2).max(30),
          tier: z.number().int().min(1).max(3),
          min_age: z.number().int().min(0).max(20),
          max_age: z.number().int().min(5).max(20),
        })
        .refine((v) => v.min_age <= v.max_age)
        .parse(payload);
    if (b.action === "save_questionnaire") {
      const p = z
        .object({
          team_id: z.uuid().nullable(),
          name: z.string().min(2).max(100),
          data: z.record(z.string(), z.unknown()),
          submit: z.boolean(),
        })
        .parse(payload);
      p.data = p.submit
        ? preseasonQuestionnaire.parse(p.data)
        : preseasonQuestionnaire.partial().parse(p.data);
      payload = p;
    }
    if (b.action === "invite_guardian") {
      const p = z
        .object({
          player_id: z.uuid(),
          email: z.email().optional().or(z.literal("")),
          send_email: z.boolean().default(false),
        })
        .parse(payload);
      token = randomBytes(32).toString("base64url");
      payload = {
        player_id: p.player_id,
        email: p.email ?? "",
        token_hash: invitationHash(token),
      };
      dbAction = "create_invitation";
    }
    if (b.action === "review_document")
      payload = z
        .object({
          document_id: z.uuid(),
          decision: z.enum(["approved", "rejected", "resubmission"]),
          reason: z.string().min(10).max(1000),
          document_checked: z.boolean(),
          duplicate_acknowledged: z.boolean(),
        })
        .parse(payload);
    const { data, error } = await client.rpc("preseason_command", {
      p_league: b.league,
      p_action: dbAction,
      p_payload: payload,
    });
    if (error)
      throw new ApiError(
        error.code === "42501"
          ? "You do not have permission for this preseason action"
          : error.message,
        error.code === "42501" ? 403 : 400,
      );
    if (b.action === "open_document") {
      const signed = await documentStorage()
        .storage.from("youth-documents")
        .createSignedUrl(data.path, 60, { download: false });
      if (signed.error)
        throw new ApiError("Unable to open this private document", 502);
      return NextResponse.json(
        { url: signed.data.signedUrl, expiresIn: 60 },
        {
          headers: {
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }
    if (b.action === "delete_document") await deleteAgeDocument(data);
    if (token) {
      const url = new URL("/verify", request.url);
      url.hash = `invite=${token}`;
      let emailState = "not_requested";
      if (b.payload.send_email) {
        if (!b.payload.email) emailState = "missing_address";
        else if (
          process.env.NOTIFICATIONS_ENABLED !== "true" ||
          !process.env.RESEND_API_KEY ||
          !process.env.RESEND_FROM
        )
          emailState = "not_configured";
        else {
          try {
            const outcome = await deliver({
              id: data.id,
              channel: "email",
              destination: String(b.payload.email),
              subject: "Complete your Courtside preseason verification",
              body: `Your league invited you to complete a secure guardian verification. This private invitation expires within 72 hours. Open it only if you expect this invitation:\n\n${url.href}\n\nDo not forward this link. Contact your coach if you were not expecting it.`,
              idempotency_key: `guardian:${data.id}`,
              lease_id: "",
            });
            emailState = outcome.status;
          } catch {
            emailState = "failed";
          }
        }
      }
      return NextResponse.json(
        { ...data, invitationUrl: url.href, emailState },
        {
          headers: {
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
