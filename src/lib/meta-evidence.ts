import "server-only";
import { documentStorage } from "./document-storage";
import { ApiError } from "./server";
import type { MetaReceipt } from "./meta";
/** Only this trusted server path writes receipts. Browser roles cannot forge them. */
export async function recordMetaEvidence(
  league: string,
  actor: string,
  feature: "scoresheet" | "placement" | "operations" | "schedule",
  object: string,
  receipt: MetaReceipt,
  toolCalls: unknown[] = [],
  revision?: number,
) {
  const { data, error } = await documentStorage().rpc("record_meta_evidence", {
    p_league: league,
    p_payload: {
      ...receipt,
      actor_id: actor,
      feature,
      object_id: object,
      tool_calls: toolCalls,
      revision,
    },
  });
  if (error)
    throw new ApiError(
      "The model responded, but its evidence receipt could not be saved. No approval was performed.",
      502,
    );
  return data;
}
export function redactCoachContext(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email removed]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[date removed]")
    .replace(/(?:\+?\d[\s().-]*){10,}/g, "[phone removed]");
}
