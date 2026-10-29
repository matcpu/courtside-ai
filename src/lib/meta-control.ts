import { createHash } from "node:crypto";
import { ApiError } from "./server";
import { operationsTools } from "./operations-agent";
import {
  metaBudgetRPC,
  type MetaBudgetContext,
  type MetaBudgetRPC,
} from "./meta-budget";
export type MetaFeature =
  | "placement"
  | "scoresheet"
  | "operations"
  | "evaluation_scoresheet"
  | "evaluation_placement"
  | "synthetic_document_screening";
/** Operator-only, synthetic-fixture scope. The ordinary enable flag is insufficient. */
export function assertMetaScope(
  feature: MetaFeature,
  league: string,
  actor: string,
) {
  let scope: Record<string, { league: string; actor: string }>;
  try {
    scope = JSON.parse(process.env.META_CONTROLLED_SCOPE ?? "{}");
  } catch {
    throw new ApiError("Controlled Meta scope is unavailable", 503);
  }
  if (scope[feature]?.league !== league || scope[feature]?.actor !== actor)
    throw new ApiError(
      "Meta access is restricted to the authorized synthetic verification",
      403,
    );
}
export function safeProviderSummary(value: any) {
  return {
    status: value.status,
    model: value.model,
    usage: value.usage,
    output: (value.output ?? [])
      .filter(
        (item: any) => item.type === "message" || item.type === "function_call",
      )
      .map((item: any) =>
        item.type === "function_call"
          ? {
              type: item.type,
              name: item.name,
              arguments: item.arguments,
              call_id: item.call_id,
            }
          : {
              type: item.type,
              content: (item.content ?? [])
                .filter((c: any) => c.type === "output_text")
                .map((c: any) => ({ type: c.type, text: c.text })),
            },
      ),
    validation: "not-yet-validated",
    execution:
      "Consult resulting action receipts; this provider response alone does not prove execution",
  };
}
/** One serialized, cumulative database reservation before every paid dispatch. Zero retries. */
export async function controlledMetaRequest(
  request: Record<string, unknown>,
  feature: MetaFeature,
  remainingMilliseconds?: number,
  context?: MetaBudgetContext,
  rpc: MetaBudgetRPC = metaBudgetRPC,
) {
  if (
    !context ||
    !process.env.MODEL_API_KEY ||
    process.env.META_API_ENABLED !== "true"
  )
    throw new ApiError(
      "No enabled, scoped and budgeted Meta run is authorized",
      503,
    );
  const maximum = feature === "operations" ? 2500 : 4000;
  const tools = request.tools;
  const toolsAllowed = tools === undefined ||
    (feature === "operations" && Array.isArray(tools) && tools.every((tool) =>
      tool && typeof tool === "object" && tool.type === "function" &&
      operationsTools.some((allowed) => allowed.name === tool.name)));
  if (
    request.model !== "muse-spark-1.3" ||
    request.max_output_tokens !== maximum ||
    request.store !== false ||
    request.background || !toolsAllowed
  )
    throw new ApiError("Request exceeded the authorized model contract", 400);
  const serialized = JSON.stringify(request);
  if (Buffer.byteLength(serialized) > 2_000_000)
    throw new ApiError("Synthetic input is unexpectedly large", 400);
  const digest = createHash("sha256").update(serialized).digest("hex");
  const reservation = await rpc("reserve", {
    ...context,
    case_id: context.caseId,
    feature,
    model: request.model,
    max_output_tokens: maximum,
    request_digest: digest,
    request_key: feature + ":" + context.league + ":" + digest,
  });
  let settled = false;
  try {
    const response = await fetch("https://api.meta.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.MODEL_API_KEY,
        "Content-Type": "application/json",
      },
      body: serialized,
      signal: AbortSignal.timeout(
        Math.max(
          1,
          Math.min(
            remainingMilliseconds ?? 55000,
            feature === "operations" ? 20000 : 55000,
          ),
        ),
      ),
    });
    if (!response.ok)
      throw new ApiError(
        "Meta provider error (" + response.status + "); no automatic retry",
        502,
      );
    const value = await response.json(),
      u = value.usage;
    const valid =
      Number.isSafeInteger(u?.input_tokens) &&
      u.input_tokens >= 0 &&
      u.input_tokens <= 1048576 &&
      Number.isSafeInteger(u?.output_tokens) &&
      u.output_tokens >= 0 &&
      u.output_tokens <= maximum &&
      typeof value.id === "string" &&
      value.model === "muse-spark-1.3";
    if (!valid)
      throw new ApiError(
        "Provider identity or usage is unverifiable; inference stopped",
        502,
      );
    await rpc("settle", {
      id: reservation.id,
      response_id: value.id,
      usage: u,
      summary: safeProviderSummary(value),
    });
    settled = true;
    if (u.input_tokens > 100000)
      throw new ApiError(
        "Unexpectedly high input usage; spending control paused inference",
        502,
      );
    if (value.status !== "completed")
      throw new ApiError(
        "Meta returned an incomplete response. Actual output and usage are preserved; no automatic retry",
        502,
      );
    return value;
  } catch (error) {
    if (!settled)
      await rpc("uncertain", {
        id: reservation.id,
        summary: {
          status: "uncertain",
          reason:
            "Provider failure, timeout or unverifiable usage; reservation retained, inference paused",
        },
      }).catch(() => {});
    throw error instanceof ApiError
      ? error
      : new ApiError(
          "Meta transport outcome is uncertain; inference stopped without retry",
          502,
        );
  }
}
