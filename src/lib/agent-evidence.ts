/** Deterministic display checks. These never rewrite provider responses or approve actions. */
export type AgentEvidenceContext = {
  teams: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  proposals: {
    id: string;
    team_id: string;
    from_division_id: string;
    to_division_id: string;
    status: string;
  }[];
  versions: { id: string; number: number; status: string }[];
};
export type ActionReceipt = {
  kind: "proposal" | "schedule";
  id: string;
  label: string;
  detail: string;
  recordVerified: boolean;
};
export type ToolReceipt = {
  tool: string;
  outcome: unknown;
  arguments?: unknown;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
export function toolReceiptState(
  outcome: unknown,
): "recorded" | "blocked" | "unknown" {
  const value = object(outcome);
  if (
    value &&
    (("error" in value && value.error !== null && value.error !== undefined) ||
      value.ok === false)
  )
    return "blocked";
  if (outcome === null || outcome === undefined || typeof outcome !== "object")
    return "unknown";
  return "recorded";
}
export function operationMessage(response: unknown) {
  const value = object(response);
  return typeof value?.message === "string" ? value.message : "";
}
export function readToolReceipts(value: unknown): ToolReceipt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = object(item);
    return typeof row?.tool === "string"
      ? [{ tool: row.tool, arguments: row.arguments, outcome: row.outcome }]
      : [];
  });
}
export function operationRunTrace(
  receipts: { feature: string; object_id: string; tool_calls: unknown }[],
  run: string,
): ToolReceipt[] {
  return receipts
    .filter(
      (receipt) =>
        receipt.feature === "operations" && receipt.object_id === run,
    )
    .flatMap((receipt) => readToolReceipts(receipt.tool_calls));
}
export function inspectAgentEvidence(
  message: string,
  trace: ToolReceipt[],
  context: AgentEvidenceContext,
) {
  const actions: ActionReceipt[] = [],
    warnings: string[] = [];
  const seen = new Set<string>();
  for (const entry of trace) {
    if (toolReceiptState(entry.outcome) === "blocked") {
      warnings.push(
        `${entry.tool} was blocked or failed. Its receipt does not establish a completed action.`,
      );
      continue;
    }
    if (entry.tool === "propose_balance" && Array.isArray(entry.outcome)) {
      for (const raw of entry.outcome) {
        const receipt = object(raw);
        if (typeof receipt?.id !== "string" || seen.has(receipt.id)) continue;
        seen.add(receipt.id);
        const proposal = context.proposals.find((p) => p.id === receipt.id);
        const team = context.teams.find((t) => t.id === proposal?.team_id);
        const verified =
          !!proposal && !!team && proposal.team_id === receipt.team_id;
        if (!verified)
          warnings.push(
            `Proposal ${receipt.id} cannot be matched to the current authorized league records. Review its raw receipt; no saved-record identity is assumed.`,
          );
        const from = context.divisions.find(
          (d) => d.id === proposal?.from_division_id,
        )?.name;
        const to = context.divisions.find(
          (d) => d.id === proposal?.to_division_id,
        )?.name;
        actions.push({
          kind: "proposal",
          id: receipt.id,
          label: verified ? team!.name : "Unresolved proposal identity",
          detail: verified
            ? `${from ?? "Unknown division"} → ${to ?? "Unknown division"} · Current record: ${proposal!.status}`
            : "Tool receipt only · saved record unavailable or inconsistent",
          recordVerified: verified,
        });
        if (verified)
          for (const line of message.split(/\r?\n/)) {
            if (
              !line.includes(receipt.id) ||
              line.toLowerCase().includes(team!.name.toLowerCase())
            )
              continue;
            const others = context.teams.filter(
              (t) =>
                t.id !== team!.id &&
                line.toLowerCase().includes(t.name.toLowerCase()),
            );
            if (others.length)
              warnings.push(
                `Model summary names ${others.map((t) => t.name).join(", ")} beside proposal ${receipt.id}; the saved proposal belongs to ${team!.name}. Review the canonical record before deciding. The original response is preserved below.`,
              );
          }
      }
    } else if (entry.tool === "draft_schedule") {
      const receipt = object(entry.outcome);
      if (typeof receipt?.id !== "string" || seen.has(receipt.id)) continue;
      seen.add(receipt.id);
      const version = context.versions.find((v) => v.id === receipt.id),
        verified = !!version && receipt.ok === true;
      if (!verified)
        warnings.push(
          `Schedule ${receipt.id} cannot be confirmed against the current authorized league records. No publication or feasibility success is inferred.`,
        );
      actions.push({
        kind: "schedule",
        id: receipt.id,
        label: version
          ? `Schedule version ${version.number}`
          : "Unresolved schedule record",
        detail: verified
          ? `Current record: ${version!.status} · This receipt grants no publication approval`
          : "Tool receipt only · saved draft unavailable or outcome unverified",
        recordVerified: verified,
      });
    }
  }
  return { actions, warnings: [...new Set(warnings)] };
}
