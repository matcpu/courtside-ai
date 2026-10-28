import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, body, db, fail } from "@/lib/server";
import {
  documentStorage,
  invitationHash,
  validateAgeImage,
} from "@/lib/document-storage";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const cookie = "courtside_guardian";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
function capability(request: NextRequest) {
  const token = request.cookies.get(cookie)?.value;
  if (!token || !/^[\w-]{43}$/.test(token))
    throw new ApiError("Open a valid invitation link from your coach", 403);
  return invitationHash(token);
}
function sameOrigin(request: NextRequest) {
  const supplied = request.headers.get("origin");
  let origin: URL | undefined;
  try {
    if (supplied) origin = new URL(supplied);
  } catch {}
  // Next's dev server may normalize request.url to localhost while the visible
  // page uses 127.0.0.1. The browser-controlled Origin must match the actual Host.
  if (
    !origin ||
    !["http:", "https:"].includes(origin.protocol) ||
    origin.host !== request.headers.get("host")
  )
    throw new ApiError(
      "This request must come from the secure guardian page",
      403,
    );
}
async function gateway(hash: string, action: string, payload: unknown = {}) {
  const { data, error } = await db().rpc("guardian_gateway", {
    p_hash: hash,
    p_action: action,
    p_payload: payload,
  });
  if (error)
    throw new ApiError(
      error.code === "42501"
        ? "This invitation is unavailable, revoked or expired. Ask your coach for a new link."
        : error.message,
      error.code === "42501" ? 403 : 400,
    );
  return data;
}
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await gateway(capability(request), "status"), {
      headers,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(cookie, "", {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "strict",
      path: "/api/guardian",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const b = z
      .object({
        action: z.enum([
          "exchange",
          "reserve_upload",
          "submit",
          "withdraw_consent",
        ]),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await body(request, 8000));
    if (b.action === "exchange") {
      const token = z
          .string()
          .regex(/^[\w-]{43}$/)
          .parse(b.payload.token),
        data = await gateway(invitationHash(token), "status");
      const response = NextResponse.json(data, { headers });
      response.cookies.set(cookie, token, {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "strict",
        path: "/api/guardian",
        expires: new Date(data.expires_at),
      });
      return response;
    }
    const hash = capability(request);
    if (b.action === "reserve_upload") {
      const p = z
        .object({
          invitation_id: z.uuid(),
          document_type: z.enum([
            "birth_certificate",
            "passport",
            "government_id",
          ]),
          mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
        })
        .parse(b.payload);
      const item = await gateway(hash, "reserve_upload", {
        ...p,
        extension:
          p.mime === "image/png"
            ? "png"
            : p.mime === "image/webp"
              ? "webp"
              : "jpg",
      });
      const signed = await documentStorage()
        .storage.from("youth-documents")
        .createSignedUploadUrl(item.path, { upsert: false });
      if (signed.error)
        throw new ApiError("Unable to prepare private upload", 502);
      return NextResponse.json(
        {
          document_id: item.id,
          path: item.path,
          uploadToken: signed.data.token,
          signedUrl: signed.data.signedUrl,
          uploadExpiresIn: 7200,
        },
        { headers },
      );
    }
    if (b.action === "withdraw_consent")
      return NextResponse.json(
        await gateway(
          hash,
          "withdraw_consent",
          z.object({ invitation_id: z.uuid() }).parse(b.payload),
        ),
        { headers },
      );
    const p = z
      .object({
        document_id: z.uuid(),
        invitation_id: z.uuid(),
        guardian_name: z.string().min(2).max(100),
        relationship: z.string().min(2).max(80),
        consent: z.literal(true),
        confirmed_details: z.literal(true),
      })
      .parse(b.payload);
    const current = await gateway(hash, "status");
    if (current.invitation_id !== p.invitation_id)
      throw new ApiError("Invitation changed. Refresh this page.", 403);
    const service = documentStorage(),
      metadata = await service.rpc("document_maintenance", {
        p_action: "document_path",
        p_payload: { document_id: p.document_id, hash },
      });
    if (metadata.error) throw new ApiError("Upload access denied", 403);
    const uploaded = await service.storage
      .from("youth-documents")
      .download(metadata.data.path);
    if (uploaded.error || !uploaded.data)
      throw new ApiError("Upload the document before submitting");
    const bytes = Buffer.from(await uploaded.data.arrayBuffer()),
      sha256 = validateAgeImage(bytes, uploaded.data.type);
    const saved = await service.rpc("finalize_age_upload", {
      p_hash: hash,
      p_document: p.document_id,
      p_payload: { ...p, sha256 },
    });
    if (saved.error)
      throw new ApiError(
        saved.error.code === "42501"
          ? "Invitation is unavailable"
          : saved.error.message,
        saved.error.code === "42501" ? 403 : 400,
      );
    return NextResponse.json(saved.data, { headers });
  } catch (e) {
    return fail(e);
  }
}
