import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { ApiError } from "./server";

export type MetaFeature = "placement" | "scoresheet" | "operations";
const ceilings = { placement: 1, scoresheet: 1, operations: 6 };
/** Operator-only, synthetic-fixture scope. Enabling the ordinary flag is insufficient. */
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

/** A local, durable journal for the single authorized run; never deployed enabled. */
export async function controlledMetaRequest(
  request: Record<string, unknown>,
  feature: MetaFeature,
) {
  const run = process.env.META_CONTROLLED_RUN;
  if (!run || !/^[a-f0-9]{10}$/.test(run))
    throw new ApiError("No controlled Meta run is authorized", 503);
  const directory = join(
    process.env.META_JOURNAL_ROOT ?? ".local",
    `meta-provider-${run}`,
  );
  mkdirSync(directory, { recursive: true });
  for (const name of Object.keys(ceilings) as MetaFeature[])
    for (let n = 1; n <= ceilings[name]; n++) {
      const file = join(directory, `${name}-${n}.json`);
      if (
        existsSync(file) &&
        JSON.parse(readFileSync(file, "utf8")).status !== "completed"
      )
        throw new ApiError(
          "A previous provider outcome is failed or uncertain. Stop; no paid retry is authorized.",
          409,
        );
    }
  const max = feature === "operations" ? 2500 : 4000;
  if (
    request.model !== "muse-spark-1.3" ||
    request.max_output_tokens !== max ||
    request.store !== false ||
    request.background
  )
    throw new ApiError("Request exceeded the authorized model contract", 400);
  const serialized = JSON.stringify(request);
  if (Buffer.byteLength(serialized) > 2_000_000)
    throw new ApiError("Controlled synthetic input is unexpectedly large", 400);
  let file = "",
    fd: number | undefined;
  for (let n = 1; n <= ceilings[feature]; n++) {
    file = join(directory, `${feature}-${n}.json`);
    try {
      fd = openSync(file, "wx", 0o600);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  if (fd === undefined)
    throw new ApiError(
      "Authorized request allowance is exhausted; no paid retry",
      409,
    );
  const startedAt = new Date().toISOString();
  try {
    writeFileSync(
      fd,
      JSON.stringify({
        feature,
        startedAt,
        status: "uncertain",
        maxOutputTokens: max,
      }),
    );
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    const response = await fetch("https://api.meta.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: serialized,
      signal: AbortSignal.timeout(feature === "operations" ? 20000 : 55000),
    });
    if (!response.ok)
      throw new ApiError(
        `Meta provider error (${response.status}); stop without retry`,
        502,
      );
    const value = await response.json();
    const usage = value.usage;
    const validUsage =
      Number.isSafeInteger(usage?.input_tokens) &&
      usage.input_tokens >= 0 &&
      usage.input_tokens <= 100_000 &&
      Number.isSafeInteger(usage?.output_tokens) &&
      usage.output_tokens >= 0 &&
      usage.output_tokens <= max;
    const receipt = {
      feature,
      startedAt,
      completedAt: new Date().toISOString(),
      status: value.status,
      responseId: value.id,
      model: value.model,
      usage,
      estimatedUSD: validUsage
        ? (usage.input_tokens * 1.25 + usage.output_tokens * 4.25) / 1_000_000
        : null,
      costSource:
        "Published standard token rates; not a provider invoice or credit balance",
    };
    writeFileSync(file, JSON.stringify(receipt, null, 2));
    if (
      !validUsage ||
      value.status !== "completed" ||
      !value.id ||
      value.model !== "muse-spark-1.3"
    ) {
      writeFileSync(
        file,
        JSON.stringify({ ...receipt, status: "requires_review" }, null, 2),
      );
      throw new ApiError(
        "Provider usage, model or completion is uncertain; stop without further paid calls",
        502,
      );
    }
    return value;
  } catch (error) {
    // Keep the pre-dispatch uncertain marker if transport failed. Never retry.
    throw error instanceof ApiError
      ? error
      : new ApiError(
          "Meta transport outcome is uncertain; stop without retry",
          502,
        );
  }
}
