import type { ToolReceipt } from "./agent-evidence";
import { toolReceiptState } from "./agent-evidence";
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function toolStory(entry: ToolReceipt) {
  const o = record(entry.outcome),
    state = toolReceiptState(entry.outcome);
  const labels: Record<string, string> = {
    inspect_league: "Inspect the league",
    inspect_team_history: "Investigate team history",
    inspect_preseason_readiness: "Check scheduling readiness",
    propose_balance: "Propose division changes",
    draft_schedule: "Prepare a schedule draft",
  };
  let detail = "Recorded tool result available in the original evidence.";
  if (state === "blocked")
    detail =
      typeof o.error === "string"
        ? o.error
        : "The tool was blocked or failed. No completed action is claimed.";
  else if (state === "unknown")
    detail = "No structured outcome recorded. Completion is unverified.";
  else if (entry.tool === "inspect_league")
    detail = `${Array.isArray(o.teams) ? o.teams.length : "Unknown"} teams; ${Array.isArray(o.verifiedResults) ? o.verifiedResults.length : "unknown"} verified results; ${Array.isArray(o.confirmedSlots) ? o.confirmedSlots.length : "unknown"} confirmed availability blocks inspected.`;
  else if (entry.tool === "inspect_team_history")
    detail = `${typeof record(o.team).name === "string" ? record(o.team).name : "Requested team"}: ${Array.isArray(o.verifiedGames) ? o.verifiedGames.length : "unknown"} verified games returned. Results and margins inform the investigation.`;
  else if (entry.tool === "inspect_preseason_readiness")
    detail =
      o.enforced === false
        ? "Legacy season: document readiness was not enforced. This is not evidence of verified players."
        : o.enforced === true
          ? "Readiness requirements checked; individual team blockers remain in the recorded outcome."
          : "Readiness outcome recorded; enforcement status is unspecified.";
  else if (entry.tool === "propose_balance")
    detail = Array.isArray(entry.outcome)
      ? `${entry.outcome.length} proposals returned for administrator review. A proposal does not move a team.`
      : "Proposal outcome recorded; inspect the original before assuming a move was saved.";
  else if (entry.tool === "draft_schedule")
    detail =
      o.ok === true
        ? `${typeof o.fixtures === "number" ? o.fixtures : "Recorded"} fixtures in the saved version, including any retained completed games. Publication requires human approval.`
        : "Draft outcome recorded; feasibility or publication is not assumed.";
  return { title: labels[entry.tool] ?? entry.tool, state, detail };
}
