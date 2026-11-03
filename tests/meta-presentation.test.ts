import { describe, it, expect } from "vitest";
import { toolStory } from "../src/lib/meta-presentation";
describe("readable Meta tool outcomes", () => {
  it("never labels failed or missing outcomes as completed", () => {
    expect(
      toolStory({
        tool: "draft_schedule",
        outcome: { ok: false, error: "Conflict" },
      }),
    ).toMatchObject({ state: "blocked", detail: "Conflict" });
    expect(toolStory({ tool: "propose_balance", outcome: null }).state).toBe(
      "unknown",
    );
  });
  it("distinguishes legacy readiness from verified players", () => {
    expect(
      toolStory({
        tool: "inspect_preseason_readiness",
        outcome: { enforced: false, teams: [] },
      }).detail,
    ).toContain("not evidence of verified players");
  });
  it("reports actual returned counts and preserves the original", () => {
    const t = {
      tool: "inspect_league",
      outcome: { teams: [{}, {}], verifiedResults: [], confirmedSlots: [{}] },
    };
    const before = JSON.stringify(t);
    expect(toolStory(t).detail).toContain(
      "2 teams; 0 verified results; 1 confirmed",
    );
    expect(JSON.stringify(t)).toBe(before);
  });
  it("keeps proposals and saved fixture totals separate from applied moves or publication", () => {
    expect(
      toolStory({ tool: "propose_balance", outcome: [] }).detail,
    ).toContain("0 proposals");
    expect(
      toolStory({ tool: "draft_schedule", outcome: { ok: true, fixtures: 25 } })
        .detail,
    ).toContain("including any retained completed games");
  });
});
