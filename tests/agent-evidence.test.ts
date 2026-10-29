import { describe, expect, it } from "vitest";
import {
  inspectAgentEvidence,
  operationMessage,
  operationRunTrace,
  readToolReceipts,
  toolReceiptState,
  type AgentEvidenceContext,
} from "../src/lib/agent-evidence";
const context: AgentEvidenceContext = {
  teams: [
    { id: "ravens", name: "Riverside Ravens" },
    { id: "panthers", name: "Parkdale Panthers" },
  ],
  divisions: [
    { id: "competitive", name: "U14 Competitive" },
    { id: "development", name: "U14 Development" },
  ],
  proposals: [
    {
      id: "proposal-1",
      team_id: "ravens",
      from_division_id: "competitive",
      to_division_id: "development",
      status: "pending",
    },
  ],
  versions: [{ id: "draft-1", number: 2, status: "draft" }],
};
const trace = [
  {
    tool: "propose_balance",
    outcome: [{ id: "proposal-1", team_id: "ravens", status: "pending" }],
  },
  {
    tool: "draft_schedule",
    outcome: { id: "draft-1", ok: true, fixtures: 25 },
  },
];
describe("deterministic agent evidence presentation", () => {
  it("groups a final response with earlier tool receipts from its own operations run only", () => {
    const receipts = [
      { feature: "operations", object_id: "run-1", tool_calls: trace },
      { feature: "operations", object_id: "run-1", tool_calls: [] },
      {
        feature: "operations",
        object_id: "run-2",
        tool_calls: [{ tool: "other_run", outcome: {} }],
      },
      {
        feature: "placement",
        object_id: "run-1",
        tool_calls: [{ tool: "other_feature", outcome: {} }],
      },
    ];
    expect(operationRunTrace(receipts, "run-1")).toEqual(trace);
    expect(operationRunTrace(receipts, "missing-run")).toEqual([]);
  });
  it("flags the actual class of provider team-name mismatch while preserving the original response", () => {
    const message =
      "Also generated: ID proposal-1 for Parkdale Panthers (ravens): recommend one tier down.";
    const before = JSON.stringify({ message, trace });
    const result = inspectAgentEvidence(message, trace, context);
    expect(
      result.warnings.some((w) =>
        w.includes("saved proposal belongs to Riverside Ravens"),
      ),
    ).toBe(true);
    expect(result.actions[0]).toMatchObject({
      label: "Riverside Ravens",
      recordVerified: true,
    });
    expect(result.actions[0].detail).toContain(
      "U14 Competitive → U14 Development",
    );
    expect(JSON.stringify({ message, trace })).toBe(before);
  });
  it("does not flag a correct name or a line that genuinely mentions both teams", () => {
    expect(
      inspectAgentEvidence("ID proposal-1 for Riverside Ravens", trace, context)
        .warnings,
    ).toEqual([]);
    expect(
      inspectAgentEvidence(
        "ID proposal-1 for Riverside Ravens; compare Parkdale Panthers",
        trace,
        context,
      ).warnings,
    ).toEqual([]);
  });
  it("keeps blocked and missing outcomes from being presented as successful saved actions", () => {
    expect(toolReceiptState({ error: "Court availability unavailable" })).toBe(
      "blocked",
    );
    expect(toolReceiptState({ ok: false, id: "draft-1" })).toBe("blocked");
    expect(toolReceiptState(null)).toBe("unknown");
    const result = inspectAgentEvidence(
      "Draft saved successfully",
      [
        {
          tool: "draft_schedule",
          outcome: { ok: false, error: "No feasible schedule", id: "draft-1" },
        },
      ],
      context,
    );
    expect(result.actions).toEqual([]);
    expect(result.warnings[0]).toMatch(/blocked or failed/);
  });
  it("does not assume a referenced proposal was saved or belongs to a named team without the current authorized record", () => {
    const result = inspectAgentEvidence(
      "ID proposal-1 for Riverside Ravens",
      trace,
      { ...context, proposals: [], versions: [] },
    );
    expect(result.actions.every((a) => !a.recordVerified)).toBe(true);
    expect(result.actions[0].label).toBe("Unresolved proposal identity");
    expect(result.warnings).toHaveLength(2);
  });
  it("flags a tool result whose proposal ID and team ID disagree with the current saved record", () => {
    const result = inspectAgentEvidence(
      "",
      [
        {
          tool: "propose_balance",
          outcome: [{ id: "proposal-1", team_id: "panthers" }],
        },
      ],
      context,
    );
    expect(result.actions[0].recordVerified).toBe(false);
  });
  it("shows the current human decision status without rewriting the historical tool status", () => {
    const result = inspectAgentEvidence("", trace, {
      ...context,
      proposals: context.proposals.map((p) => ({ ...p, status: "approved" })),
    });
    expect(result.actions[0].detail).toContain("Current record: approved");
    expect(trace[0].outcome).toEqual([
      { id: "proposal-1", team_id: "ravens", status: "pending" },
    ]);
    expect(result.actions[1].detail).toContain(
      "grants no publication approval",
    );
  });
  it("parses only recorded trace entries and does not invent a provider message", () => {
    expect(
      readToolReceipts([null, "ignored", { name: "not-a-receipt" }]),
    ).toEqual([]);
    expect(
      readToolReceipts([
        { tool: "inspect_league", arguments: {}, outcome: { teams: [] } },
      ]),
    ).toEqual([
      { tool: "inspect_league", arguments: {}, outcome: { teams: [] } },
    ]);
    expect(operationMessage({ calls: [] })).toBe("");
  });
});
