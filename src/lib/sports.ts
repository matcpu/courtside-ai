import { z } from "zod";

/** League policies, not a claim that one governing body's rules fit every league. */
export const sportSchema = z.enum(["basketball", "hockey"]);
export type Sport = z.infer<typeof sportSchema>;
export const decisionSchema = z.enum(["regulation", "overtime", "shootout"]);
export type Decision = z.infer<typeof decisionSchema>;
export const sportRulesSchema = z
  .object({
    version: z.literal(1),
    winPoints: z.number().int().min(0).max(10),
    drawPoints: z.number().int().min(0).max(10),
    lossPoints: z.number().int().min(0).max(10),
    overtimeLossPoints: z.number().int().min(0).max(10),
    allowDraws: z.boolean(),
    allowOvertime: z.boolean(),
    allowShootout: z.boolean(),
    maxScore: z.number().int().min(1).max(300),
    gameMinutes: z.number().int().min(15).max(240),
    restMinutes: z.number().int().min(0).max(240),
    tieBreak: z.enum(["differential", "wins"]),
  })
  .strict();
export type SportRules = z.infer<typeof sportRulesSchema>;
export const sportProfiles = {
  basketball: {
    name: "Basketball",
    score: "points",
    facility: "court",
    facilityName: "Court",
    facilities: "Courts & gyms",
  },
  hockey: {
    name: "Hockey",
    score: "goals",
    facility: "rink",
    facilityName: "Rink",
    facilities: "Rinks & arenas",
  },
} as const;
export function defaultSportRules(sport: Sport = "basketball"): SportRules {
  return {
    version: 1,
    winPoints: 2,
    drawPoints: 1,
    lossPoints: 0,
    overtimeLossPoints: sport === "hockey" ? 1 : 0,
    allowDraws: true,
    allowOvertime: true,
    allowShootout: sport === "hockey",
    maxScore: sport === "hockey" ? 99 : 300,
    gameMinutes: 60,
    restMinutes: 30,
    tieBreak: "differential",
  };
}
export function leagueSport(league?: {
  sport?: Sport;
  sport_rules?: SportRules;
}) {
  const sport = league?.sport ?? "basketball";
  return {
    sport,
    rules: league?.sport_rules ?? defaultSportRules(sport),
    profile: sportProfiles[sport],
  };
}
export function resultErrors(
  home: number | null,
  away: number | null,
  decision: Decision,
  rules: SportRules,
): string[] {
  const errors: string[] = [];
  if (
    home === null ||
    away === null ||
    !Number.isInteger(home) ||
    !Number.isInteger(away) ||
    home < 0 ||
    away < 0 ||
    home > rules.maxScore ||
    away > rules.maxScore
  )
    errors.push(`Enter both final scores between 0 and ${rules.maxScore}.`);
  if (
    home !== null &&
    home === away &&
    (!rules.allowDraws || decision !== "regulation")
  )
    errors.push(
      "A tied result requires draws to be allowed and a regulation decision.",
    );
  if (decision === "overtime" && !rules.allowOvertime)
    errors.push("Overtime is not allowed by this league.");
  if (decision === "shootout" && !rules.allowShootout)
    errors.push("Shootouts are not allowed by this league.");
  if (
    decision === "shootout" &&
    home !== null &&
    away !== null &&
    Math.abs(home - away) !== 1
  )
    errors.push(
      "For a shootout, enter the tied score plus one deciding goal for the winner.",
    );
  return errors;
}
