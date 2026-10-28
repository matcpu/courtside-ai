import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./server";
/** Server-only bridge. Never use this client for ordinary league mutations.
 * Every path must come from a capability/reviewer-authorized database command. */
export function documentStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ApiError("Private document storage is not configured", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function validateAgeImage(bytes: Buffer, type: string) {
  if (!bytes.length || bytes.length > 6 * 1024 * 1024)
    throw new ApiError("Use a proof-of-age photo under 6 MB");
  const valid =
    (type === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (type === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (type === "image/webp" &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP");
  if (!valid) throw new ApiError("Use a genuine JPEG, PNG or WebP image");
  return createHash("sha256").update(bytes).digest("hex");
}
export async function deleteAgeDocument(item: {
  id: string;
  path: string;
  lease: string;
}) {
  const client = documentStorage();
  // The only deletion namespace accepted by this bridge.
  if (
    !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(
      item.path,
    )
  )
    throw new ApiError("Invalid private document path");
  const { error } = await client.storage
    .from("youth-documents")
    .remove([item.path]);
  if (error)
    throw new ApiError("Document deletion failed; a retry remains queued", 502);
  const finished = await client.rpc("document_maintenance", {
    p_action: "finish_delete",
    p_payload: { document_id: item.id, lease: item.lease },
  });
  if (finished.error)
    throw new ApiError("File removed; deletion receipt needs retry", 502);
}
