import { describe, it, expect } from "vitest";
import {
  preseasonQuestionnaire,
  recommendPlacement,
  seasonStartInstant,
  settingsSchema,
  type PreseasonQuestionnaire,
} from "../src/lib/preseason";
const q: PreseasonQuestionnaire = {
  ageCategory: "U14",
  previousLeague: "Synthetic league",
  previousDivision: "Development",
  wins: 8,
  losses: 4,
  draws: 0,
  winningMargin: 12,
  losingMargin: 8,
  returningPercent: 70,
  competitivePlayers: 5,
  experience: 3,
  yearsTogether: 2,
  practicesPerWeek: 2,
  preferredTier: 2,
  coachConfidence: 70,
  notes: "Synthetic assessment",
};
describe("preseason evidence and age-policy boundary", () => {
  it("matches the independently tested database recommendation", () => {
    const r = recommendPlacement(q);
    expect(r.tier).toBe(1);
    expect(r.rating).toBe(1204);
    expect(r.confidence).toBe(0.8);
  });
  it("flags unsupported certainty, conflicting records and preference", () => {
    const r = recommendPlacement({
      ...q,
      wins: 0,
      losses: 0,
      draws: 0,
      coachConfidence: 100,
      preferredTier: 3,
      returningPercent: 90,
      yearsTogether: 0,
    });
    expect(r.flags).toContain("Winning margin was supplied with no wins.");
    expect(r.flags).toContain(
      "High coach confidence is not supported by a substantial game history.",
    );
    expect(r.flags).toContain(
      "High returning percentage with zero years together needs clarification.",
    );
    expect(r.confidence).toBeLessThan(0.5);
  });
  it("does not let coach confidence override evidence rating", () => {
    expect(recommendPlacement({ ...q, coachConfidence: 100 }).rating).toBe(
      recommendPlacement({ ...q, coachConfidence: 0 }).rating,
    );
  });
  it("accepts an incomplete draft but rejects it as final submission", () => {
    expect(
      preseasonQuestionnaire.partial().safeParse({ experience: 3 }).success,
    ).toBe(true);
    expect(preseasonQuestionnaire.safeParse({ experience: 3 }).success).toBe(
      false,
    );
  });
  it("rejects impossible records and roster experience", () => {
    expect(preseasonQuestionnaire.safeParse({ ...q, wins: -1 }).success).toBe(
      false,
    );
    expect(
      preseasonQuestionnaire.safeParse({ ...q, competitivePlayers: 21 })
        .success,
    ).toBe(false);
  });
  it("resolves opening weekend in Eastern daylight and standard time", () => {
    expect(seasonStartInstant("2026-10-31", "America/Toronto")).toBe(
      "2026-10-31T04:00:00.000Z",
    );
    expect(seasonStartInstant("2026-11-07", "America/Toronto")).toBe(
      "2026-11-07T05:00:00.000Z",
    );
  });
  it("handles the daylight-saving transition midnight correctly", () => {
    expect(seasonStartInstant("2026-11-01", "America/Toronto")).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(seasonStartInstant("2026-03-08", "America/Toronto")).toBe(
      "2026-03-08T05:00:00.000Z",
    );
  });
  it("rejects inconsistent deadlines and roster requirements", () => {
    const settings = {
      enabled: true,
      season_name: "Test",
      season_start: "2026-11-07",
      cutoff_date: "2026-09-01",
      registration_status: "open",
      questionnaire_deadline: "2026-11-03T00:00:00Z",
      roster_deadline: "2026-11-02T00:00:00Z",
      verification_deadline: "2026-11-04T00:00:00Z",
      min_roster: 6,
      max_roster: 5,
      document_retention_days: 14,
      allowed_document_types: ["passport"],
    };
    expect(settingsSchema.safeParse(settings).success).toBe(false);
  });
});
