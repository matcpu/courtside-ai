import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  scoresheetCases,
  questionnaireCases,
  scoresheetSvg,
  patchedProofSvg,
} from "../scripts/lib/meta-evaluation-fixtures.mjs";
import { preseasonQuestionnaire } from "../src/lib/preseason";

describe("synthetic model-evaluation fixture contracts", () => {
  it("keeps every coach case within the existing questionnaire contract", () => {
    for (const c of questionnaireCases)
      expect(preseasonQuestionnaire.safeParse(c.questionnaire).success).toBe(
        true,
      );
    expect(
      questionnaireCases.find((c) => c.id === "missing-competition-evidence")
        ?.expected.requiredTopics,
    ).toContain("missing history");
  });
  it("uses null rather than invented zeros for absent player-stat cells", () => {
    const expected = scoresheetCases.find(
      (c) => c.id === "printed-recorded-stats",
    )!.expected!;
    expect(expected.players).toContainEqual({
      jersey: "12",
      team: "home",
      points: 18,
      rebounds: null,
      assists: null,
    });
    expect(
      scoresheetCases.find((c) => c.id === "no-player-stats")!.expected!
        .players,
    ).toEqual([]);
  });
  it("defines unreadable and contradictory score cases without silently repairing them", () => {
    const unreadable = scoresheetCases.find(
      (c) => c.id === "ambiguous-home-final",
    )!.expected!;
    expect(unreadable.homeScore).toBeNull();
    expect(unreadable.warningPolicy).toBe("required");
    const conflict = scoresheetCases.find(
      (c) => c.id === "contradictory-period-total",
    )!.expected!;
    expect(conflict.homeScore).toBe(64);
    expect(conflict.periodSums?.home).toBe(62);
    expect(conflict.warningPolicy).toBe("required");
  });
  it("clearly marks generated images as synthetic and preserves a single-date patch case", () => {
    for (const c of scoresheetCases.filter((c) => c.artwork))
      expect(scoresheetSvg(c.artwork)).toContain("SYNTHETIC");
    const patch = patchedProofSvg();
    expect(patch).toContain("NOT A REAL ID");
    expect(patch).toContain("2015");
    expect(patch).not.toContain("2013");
  });
  it("preparation code does not load credentials or issue network/model requests", () => {
    const source = readFileSync("scripts/prepare-meta-evaluations.mjs", "utf8");
    expect(source).not.toMatch(
      /fetch\s*\(|https?:\/\/|MODEL_API_KEY|\.env|createClient\s*\(/,
    );
    expect(source).toContain("modelCallsMade: 0");
  });
});
