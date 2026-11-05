import { describe, expect, it } from "vitest";
import {
  fixtureState,
  gameCentre,
  leagueInitials,
  type PublicFixture,
} from "../src/lib/league-website";
const now = +new Date("2026-11-04T12:00Z");
const fixture = (
  starts_at: string,
  status = "pending",
  home_score: number | null = null,
  away_score: number | null = null,
): PublicFixture => ({
  starts_at,
  status,
  home_score,
  away_score,
  home: "Synthetic home",
  away: "Synthetic away",
  court: "Synthetic court",
  venue: "Synthetic centre",
});
describe("public game centre presentation", () => {
  it("never classifies a past unconfirmed game as upcoming or fabricates a score", () => {
    const past = fixture("2026-11-03T12:00Z");
    expect(fixtureState(past, now)).toBe("pending");
    expect(past.home_score).toBeNull();
    expect(fixtureState(fixture("2026-11-05T12:00Z"), now)).toBe("upcoming");
  });
  it("requires confirmed non-null scores for a final, preserving legitimate zeros", () => {
    expect(
      fixtureState(fixture("2026-11-03T12:00Z", "confirmed", 0, 43), now),
    ).toBe("final");
    expect(fixtureState(fixture("2026-11-05T12:00Z", "confirmed"), now)).toBe(
      "pending",
    );
  });
  it("features a bounded mix of genuine upcoming games and recent finals while keeping every fixture", () => {
    const upcoming = Array.from({ length: 4 }, (_, i) =>
      fixture(`2026-11-${String(5 + i).padStart(2, "0")}T12:00Z`),
    );
    const finals = Array.from({ length: 6 }, (_, i) =>
      fixture(`2026-10-${20 + i}T12:00Z`, "confirmed", 50 + i, 40),
    );
    const pending = fixture("2026-11-03T12:00Z");
    const input = [...finals, pending, ...upcoming],
      before = JSON.stringify(input);
    const result = gameCentre(input, now);
    expect(result.featured).toHaveLength(4);
    expect(
      result.featured.filter((f) => fixtureState(f, now) === "upcoming"),
    ).toHaveLength(2);
    expect(
      result.featured.filter((f) => fixtureState(f, now) === "final"),
    ).toHaveLength(2);
    expect(result.ordered).toHaveLength(11);
    expect(result.pending).toEqual([pending]);
    expect(result.final[0]).toBe(finals[5]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("supports result-only, pending-only and empty seasons without synthetic filler", () => {
    expect(gameCentre([], now).featured).toEqual([]);
    const pending = fixture("2026-11-01T12:00Z");
    expect(gameCentre([pending], now).featured).toEqual([pending]);
    expect(gameCentre([pending], now).upcoming).toEqual([]);
  });
  it("provides a short typographic fallback for long, accented and punctuation-only names", () => {
    expect(leagueInitials("Harbour Hoops League")).toBe("HH");
    expect(leagueInitials("  Équipe  Nord · Montréal")).toBe("ÉN");
    expect(leagueInitials("—")).toBe("L");
  });
});
