import { describe, it, expect, vi } from "vitest";
import {
  executeOperationTool,
  operationsTools,
} from "../src/lib/operations-agent";
import type { Snapshot } from "../src/lib/domain";
const team = "cc000000-0000-4000-8000-000000000001",
  other = "cc000000-0000-4000-8000-000000000002";
const s = {
  league: { revision: 1, preseason_enabled: true },
  teams: [
    {
      id: team,
      name: "Fictional A",
      rating: 1100,
      status: "approved",
      division_id: "d",
      coach_email: "private@example.invalid",
    },
    {
      id: other,
      name: "Fictional B",
      rating: 950,
      status: "approved",
      division_id: "d",
    },
  ],
  divisions: [{ id: "d", name: "U14 Competitive" }],
  games: [
    {
      id: "g",
      home_team_id: team,
      away_team_id: other,
      status: "confirmed",
      home_score: 70,
      away_score: 40,
      played_at: "2026-10-20T12:00:00Z",
    },
  ],
  availability: [],
  proposals: [{ id: "p", status: "pending" }],
  versions: [{ id: "v", number: 1, status: "published" }],
  readiness: [
    {
      team_id: team,
      eligible_for_scheduling: false,
      blockers: ["Guardian review pending"],
    },
  ],
  players: [{ birth_date: "2013-02-03", display_name: "Private child" }],
} as unknown as Snapshot;
function dependencies() {
  return {
    snapshot: vi.fn().mockResolvedValue(s),
    propose: vi.fn().mockResolvedValue({ ok: true }),
    draft: vi.fn().mockResolvedValue({ id: "draft", official: false }),
  };
}
describe("model-selected operations tools (mock model contract, not provider evidence)", () => {
  it("has no tool that can approve, publish, send or inspect identity documents", () => {
    expect(operationsTools.map((t) => t.name)).toEqual([
      "inspect_league",
      "inspect_team_history",
      "inspect_preseason_readiness",
      "propose_balance",
      "draft_schedule",
    ]);
  });
  it("rejects a mutating tool before a successful investigation", async () => {
    const d = dependencies();
    await expect(
      executeOperationTool("propose_balance", "{}", new Set(), d),
    ).rejects.toThrow("Inspect the league");
    expect(d.propose).not.toHaveBeenCalled();
  });
  it("does not count a failed league inspection as success", async () => {
    const d = dependencies(),
      used = new Set<string>();
    d.snapshot.mockRejectedValue(new Error("Database unavailable"));
    await expect(
      executeOperationTool("inspect_league", "{}", used, d),
    ).rejects.toThrow("Database unavailable");
    expect(used.has("inspect_league")).toBe(false);
  });
  it("keeps youth identity and coach contacts out of model tool context", async () => {
    const value = await executeOperationTool(
      "inspect_league",
      "{}",
      new Set(),
      dependencies(),
    );
    expect(JSON.stringify(value)).not.toContain("private@example.invalid");
    expect(JSON.stringify(value)).not.toContain("2013-02-03");
    expect(JSON.stringify(value)).not.toContain("Private child");
  });
  it("investigates margins before saving actionable proposals", async () => {
    const used = new Set<string>(),
      d = dependencies();
    await executeOperationTool("inspect_league", "{}", used, d);
    await expect(
      executeOperationTool("propose_balance", "{}", used, d),
    ).rejects.toThrow("Investigate verified team history");
    const history = (await executeOperationTool(
      "inspect_team_history",
      JSON.stringify({ team_id: team }),
      used,
      d,
    )) as { verifiedGames: { margin: number }[] };
    expect(history.verifiedGames[0].margin).toBe(30);
    const proposals = await executeOperationTool(
      "propose_balance",
      "{}",
      used,
      d,
    );
    expect(proposals).toEqual(s.proposals.map(p=>expect.objectContaining(p)));
    expect(proposals).toEqual(expect.arrayContaining([expect.objectContaining({teamName:null,investigationSource:"Additional deterministic candidate; individual history has not been inspected in this run"})]));
    expect(d.propose).toHaveBeenCalledTimes(1);
    await expect(
      executeOperationTool("propose_balance", "{}", used, d),
    ).rejects.toThrow("already ran");
  });
  it("prepares a draft through the deterministic scheduler exactly once", async () => {
    const used = new Set(["inspect_league"]),
      d = dependencies();
    expect(
      await executeOperationTool("draft_schedule", '{"round":1}', used, d),
    ).toEqual({ id: "draft", official: false });
    await expect(
      executeOperationTool("draft_schedule", '{"round":1}', used, d),
    ).rejects.toThrow("already ran");
    expect(d.draft).toHaveBeenCalledTimes(1);
  });
  it("rejects prompt-injected tools and extra approval arguments", async () => {
    const used = new Set(["inspect_league"]),
      d = dependencies();
    await expect(
      executeOperationTool("publish_schedule", "{}", used, d),
    ).rejects.toThrow("unauthorized");
    await expect(
      executeOperationTool(
        "draft_schedule",
        '{"round":1,"approve":true}',
        used,
        d,
      ),
    ).rejects.toThrow();
    expect(d.draft).not.toHaveBeenCalled();
  });
  it("readiness inspection includes blockers without documents", async () => {
    const result = await executeOperationTool(
      "inspect_preseason_readiness",
      "{}",
      new Set(["inspect_league"]),
      dependencies(),
    );
    expect(result).toEqual({ enforced: true, teams: s.readiness });
    expect(JSON.stringify(result)).not.toContain("birth_date");
  });
});
