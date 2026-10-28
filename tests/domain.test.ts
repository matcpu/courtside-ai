import { describe, it, expect } from "vitest";
import {
  ageOn,
  conflicts,
  divisionForRating,
  elo,
  extractionSchema,
  initialRating,
  roundRobin,
  schedule,
  standings,
  validateExtraction,
  type Extraction,
  type Fixture,
  type Team,
} from "../src/lib/domain";
const team = (id: string, division_id = "d"): Team => ({
  id,
  name: id,
  division_id,
  status: "approved",
  rating: 1000,
  initial_rating: 1000,
  recommended_division: 2,
});
const slot = {
  court_id: "c",
  starts_at: "2026-11-01T14:00:00Z",
  ends_at: "2026-11-01T20:00:00Z",
  confirmed: true,
};
const f = (
  id = "g",
  h = "a",
  a = "b",
  start = "2026-11-01T14:00:00Z",
): Fixture => ({
  game_id: id,
  home_team_id: h,
  away_team_id: a,
  court_id: "c",
  starts_at: start,
  ends_at: new Date(+new Date(start) + 3600000).toISOString(),
});
describe("schedule constraints", () => {
  it("rejects court double booking", () =>
    expect(conflicts([f(), f("g2", "c", "d")], [slot])).toContain(
      "Court double-booking",
    ));
  it("rejects team conflicts across different courts", () =>
    expect(
      conflicts(
        [f(), { ...f("g2", "a", "c"), court_id: "c2" }],
        [slot, { ...slot, court_id: "c2" }],
      ),
    ).toContain("Team double-booking or insufficient rest"));
  it("enforces 30 minute rest between games", () =>
    expect(
      conflicts([f(), f("g2", "a", "c", "2026-11-01T15:00:00Z")], [slot]),
    ).toContain("Team double-booking or insufficient rest"));
  it("allows rest boundary and adjacent court use", () =>
    expect(
      conflicts([f(), f("g2", "a", "c", "2026-11-01T15:30:00Z")], [slot]),
    ).toEqual([]));
  it("never invents gym availability", () =>
    expect(
      schedule([{ game_id: "a", home_team_id: "a", away_team_id: "b" }], [])
        .unscheduled,
    ).toEqual(["a"]));
  it("rejects unconfirmed availability", () =>
    expect(conflicts([f()], [{ ...slot, confirmed: false }])).toContain(
      "Fixture is outside confirmed court availability",
    ));
  it("retains locked completed games", () => {
    const result = schedule(
      [{ game_id: "n", home_team_id: "a", away_team_id: "c" }],
      [slot],
      [f()],
    );
    expect(result.fixtures[0]).toEqual(f());
    expect(conflicts(result.fixtures, [slot])).toEqual([]);
  });
  it("reports unscheduled fixtures under constrained capacity", () => {
    const result = schedule(
      [{ game_id: "n", home_team_id: "x", away_team_id: "y" }],
      [{ ...slot, ends_at: "2026-11-01T15:00:00Z" }],
      [f()],
    );
    expect(result.unscheduled).toEqual(["n"]);
  });
  it("regenerates future games while preserving past completed fixtures", () => {
    const result = schedule(
      [{ game_id: "n", home_team_id: "a", away_team_id: "c" }],
      [
        slot,
        {
          ...slot,
          starts_at: "2026-11-03T14:00:00Z",
          ends_at: "2026-11-03T20:00:00Z",
        },
      ],
      [f()],
      60,
      30,
      "2026-11-03T12:00:00Z",
    );
    expect(result.unscheduled).toEqual([]);
    expect(result.fixtures[0]).toEqual(f());
    expect(result.fixtures[1].starts_at).toBe("2026-11-03T14:00:00.000Z");
  });
  it("schedules a 500-team round with sufficient confirmed capacity", () => {
    const teams = Array.from({ length: 500 }, (_, i) => team("team-" + i));
    const pairs = roundRobin(teams).map((p, i) => ({
      ...p,
      game_id: "game-" + i,
    }));
    const slots = Array.from({ length: 25 }, (_, i) => ({
      ...slot,
      court_id: "court-" + i,
      ends_at: "2026-11-02T00:00:00Z",
    }));
    const result = schedule(pairs, slots);
    expect(result.fixtures).toHaveLength(250);
    expect(result.unscheduled).toEqual([]);
    expect(conflicts(result.fixtures, slots)).toEqual([]);
  });
  it("round robin gives each team one game with no self matches", () => {
    const games = roundRobin([team("a"), team("b"), team("c"), team("d")], 1);
    expect(games).toHaveLength(2);
    expect(
      new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id])).size,
    ).toBe(4);
  });
  it("does not pair across divisions and handles byes", () => {
    expect(
      roundRobin([team("a"), team("b"), team("c"), team("e", "e")]),
    ).toHaveLength(1);
  });
  it("rotates every pairing over the cycle", () => {
    const ts = ["a", "b", "c", "d"].map((id) => team(id));
    const pairs = new Set(
      [0, 1, 2]
        .flatMap((r) => roundRobin(ts, r))
        .map((g) => [g.home_team_id, g.away_team_id].sort().join(":")),
    );
    expect(pairs.size).toBe(6);
  });
});
describe("eligibility and placement", () => {
  it("checks exact birthday cutoff", () => {
    expect(ageOn("2012-09-02", "2026-09-01")).toBe(13);
    expect(ageOn("2012-09-01", "2026-09-01")).toBe(14);
  });
  it("handles leap day birthdays", () =>
    expect(ageOn("2012-02-29", "2026-02-28")).toBe(13));
  it("rejects malformed and future dates", () => {
    expect(() => ageOn("2026-02-30", "2026-09-01")).toThrow();
    expect(() => ageOn("2027-01-01", "2026-09-01")).toThrow();
  });
  it("uses questionnaire facts for deterministic initial placement", () => {
    expect(
      initialRating({
        experience: 3,
        yearsTogether: 2,
        practicesPerWeek: 2,
        notes: "",
      }),
    ).toBe(1105);
    expect(divisionForRating(1150)).toBe(1);
    expect(divisionForRating(949)).toBe(3);
  });
});
describe("verified results", () => {
  it("updates ratings with zero-sum Elo", () => {
    expect(elo(1000, 1000, 60, 40)).toEqual([1016, 984]);
    expect(elo(1000, 1000, 40, 40)).toEqual([1000, 1000]);
  });
  it("can replay corrections from initial ratings", () => {
    expect(elo(1000, 1000, 40, 60)).toEqual([984, 1016]);
  });
  it("ignores unconfirmed results", () => {
    const rows = standings(
      [team("a"), team("b")],
      [
        {
          id: "x",
          home_team_id: "a",
          away_team_id: "b",
          status: "scheduled",
          home_score: null,
          away_score: null,
        },
      ],
    );
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
  it("standings count wins, draws and differential from verified scores", () => {
    const rows = standings(
      [team("a"), team("b")],
      [
        {
          id: "x",
          home_team_id: "a",
          away_team_id: "b",
          status: "confirmed",
          home_score: 61,
          away_score: 40,
        },
      ],
    );
    expect(rows[0].points).toBe(2);
    expect(rows[0].for - rows[0].against).toBe(21);
  });
});
describe("structured extraction boundaries", () => {
  const base: Extraction = {
    homeTeam: "A",
    awayTeam: "B",
    homeScore: 50,
    awayScore: 40,
    confidence: 0.95,
    warnings: [],
    players: [],
  };
  it("keeps missing statistics missing", () =>
    expect(extractionSchema.parse(base).players).toEqual([]));
  it("rejects invalid numeric scores", () =>
    expect(extractionSchema.safeParse({ ...base, homeScore: -1 }).success).toBe(
      false,
    ));
  it("surfaces unreadable scores and uncertain names", () => {
    const errors = validateExtraction(
      { ...base, homeScore: null, homeTeam: null, confidence: 0.2 },
      "A",
      "B",
    );
    expect(errors).toHaveLength(3);
  });
  it("rejects fabricated player point totals", () => {
    const e = {
      ...base,
      players: [
        {
          jersey: "7",
          team: "home" as const,
          points: 60,
          rebounds: null,
          assists: null,
        },
      ],
    };
    expect(validateExtraction(e, "A", "B")).toContain(
      "Recorded player points exceed team score.",
    );
  });
  it("identifies duplicate player lines", () => {
    const p = {
      jersey: "7",
      team: "home" as const,
      points: 10,
      rebounds: null,
      assists: null,
    };
    expect(
      validateExtraction({ ...base, players: [p, p] }, "A", "B"),
    ).toContain("Duplicate jersey in player statistics.");
  });
});
