import { describe, expect, it } from "vitest";
import {
  defaultSportRules,
  resultErrors,
  sportRulesSchema,
  sportSchema,
} from "../src/lib/sports";
import {
  extractionSchema,
  standings,
  validateExtraction,
  schedule,
  type Game,
  type Team,
} from "../src/lib/domain";
import { courtCapacity, newSetup, setupSchema } from "../src/lib/launchpad";
const teams: Team[] = ["Alpha", "Beta"].map((id) => ({
  id,
  name: id,
  status: "approved",
  division_id: "d",
  recommended_division: 2,
  rating: 1000,
  initial_rating: 1000,
}));
const game = (
  home: number,
  away: number,
  decision?: Game["decision"],
): Game => ({
  id: crypto.randomUUID(),
  home_team_id: "Alpha",
  away_team_id: "Beta",
  home_score: home,
  away_score: away,
  status: "confirmed",
  decision,
});
describe("versioned sport policies", () => {
  it("keeps existing basketball's 2/1/0 policy and alphabetic final tiebreak", () => {
    const table = standings(teams, [game(78, 43), game(45, 45)]);
    expect(
      table.map((r) => [r.team.name, r.points, r.wins, r.draws, r.losses]),
    ).toEqual([
      ["Alpha", 3, 1, 1, 0],
      ["Beta", 1, 0, 1, 1],
    ]);
    expect(standings(teams.toReversed(), []).map((r) => r.team.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });
  it.each(["overtime", "shootout"] as const)(
    "awards the hockey %s loser point without inventing a draw",
    (decision) => {
      const table = standings(
        teams,
        [game(4, 3, decision)],
        defaultSportRules("hockey"),
      );
      expect(
        table.map((r) => [r.points, r.losses, r.overtimeLosses, r.draws]),
      ).toEqual([
        [2, 0, 0, 0],
        [1, 1, 1, 0],
      ]);
    },
  );
  it("uses configurable win, draw and regulation-loss points", () => {
    const rules = {
      ...defaultSportRules("hockey"),
      winPoints: 3,
      drawPoints: 2,
      lossPoints: 1,
    };
    expect(
      standings(teams, [game(2, 1), game(0, 0)], rules).map((r) => r.points),
    ).toEqual([5, 3]);
  });
  it("excludes unconfirmed results and unapproved teams", () => {
    expect(
      standings(
        [...teams, { ...teams[0], id: "pending", status: "pending" }],
        [{ ...game(4, 1), status: "scheduled" }],
      ).map((r) => r.played),
    ).toEqual([0, 0]);
  });
  it("uses the selected tiebreaker and locale-independent final name order", () => {
    const games = [game(0, 1), game(0, 1), game(0, 1), game(10, 0)];
    const rules = { ...defaultSportRules(), winPoints: 0 };
    expect(standings(teams, games, rules)[0].team.name).toBe("Alpha");
    expect(
      standings(teams, games, { ...rules, tieBreak: "wins" })[0].team.name,
    ).toBe("Beta");
    const names = ["Éclair", "Zulu", "Åland", "🏀 Team"];
    expect(
      standings(
        names.map((name) => ({ ...teams[0], id: name, name })),
        [],
      ).map((r) => r.team.name),
    ).toEqual(["Zulu", "Åland", "Éclair", "🏀 Team"]);
  });
  it("rejects forbidden draws, overtime, shootouts and out-of-range scores", () => {
    const rules = {
      ...defaultSportRules("hockey"),
      allowDraws: false,
      allowOvertime: false,
      allowShootout: false,
    };
    expect(resultErrors(2, 2, "regulation", rules)).not.toEqual([]);
    expect(resultErrors(2, 1, "overtime", rules)).not.toEqual([]);
    expect(resultErrors(2, 1, "shootout", rules)).not.toEqual([]);
    expect(resultErrors(100, 1, "regulation", rules)).not.toEqual([]);
    expect(
      resultErrors(2, 2, "shootout", defaultSportRules("hockey")),
    ).not.toEqual([]);
  });
  it("does not reinterpret basketball player points as hockey goals", () => {
    const e = extractionSchema.parse({
      homeTeam: "Alpha",
      awayTeam: "Beta",
      homeScore: 4,
      awayScore: 3,
      decision: "overtime",
      confidence: 1,
      warnings: [],
      players: [
        { team: "home", jersey: "7", points: 1, rebounds: null, assists: null },
      ],
    });
    expect(
      validateExtraction(
        e,
        "Alpha",
        "Beta",
        defaultSportRules("hockey"),
        "hockey",
      ).join(" "),
    ).toContain("team scores only");
  });
  it("retains old extraction payloads as regulation", () => {
    expect(
      extractionSchema.parse({
        homeTeam: "Alpha",
        awayTeam: "Beta",
        homeScore: 78,
        awayScore: 43,
        confidence: 1,
        warnings: [],
        players: [],
      }).decision,
    ).toBeUndefined();
  });
  it("makes unsupported sports unavailable rather than borrowing basketball rules", () => {
    for (const sport of ["soccer", "volleyball", "recreational"])
      expect(sportSchema.safeParse(sport).success).toBe(false);
    expect(
      sportRulesSchema.safeParse({ ...defaultSportRules(), version: 2 })
        .success,
    ).toBe(false);
    expect(
      sportRulesSchema.safeParse({ ...defaultSportRules(), unknown: true })
        .success,
    ).toBe(false);
  });
  it("keeps pre-migration setup drafts basketball-compatible", () => {
    const old: Record<string, unknown> = { ...newSetup() };
    delete old.sport;
    delete old.sportRules;
    expect(setupSchema.parse(old).sport).toBeUndefined();
    expect(defaultSportRules().winPoints).toBe(2);
  });
  it("uses the configured game slot for both capacity and scheduling", () => {
    const slot = {
      id: "slot",
      court_id: "rink",
      starts_at: "2099-01-01T12:00:00Z",
      ends_at: "2099-01-01T15:00:00Z",
      confirmed: true,
    };
    expect(courtCapacity([slot], 0, 90).slots).toBe(2);
    const generated = schedule(
      [{ game_id: "g", home_team_id: "Alpha", away_team_id: "Beta" }],
      [slot],
      [],
      90,
      45,
    );
    expect(
      +new Date(generated.fixtures[0].ends_at) -
        +new Date(generated.fixtures[0].starts_at),
    ).toBe(90 * 60000);
  });
});
