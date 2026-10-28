import { z } from "zod";
import type { Snapshot } from "./domain";
export const operationsTools = [
  {
    type: "function",
    name: "inspect_league",
    description:
      "Inspect team IDs, standings, verified results, pending approvals and confirmed court availability.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "inspect_team_history",
    description:
      "Investigate a possible mismatch: inspect the specified team’s last five verified games, margins, opponents and division.",
    parameters: {
      type: "object",
      properties: { team_id: { type: "string", format: "uuid" } },
      required: ["team_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "inspect_preseason_readiness",
    description:
      "Check team scheduling readiness and blockers. Returns progress counts only; never guardian identities, dates of birth or documents.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "propose_balance",
    description:
      "After investigating a team history, run deterministic evidence checks and save division proposals for human approval. Does not move a team.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "draft_schedule",
    description:
      "Prepare a feasible schedule using currently approved divisions and ready teams. Never applies unapproved division proposals or publishes.",
    parameters: {
      type: "object",
      properties: { round: { type: "integer", minimum: 0, maximum: 499 } },
      required: ["round"],
      additionalProperties: false,
    },
    strict: true,
  },
];
export type OperationDependencies = {
  snapshot: () => Promise<Snapshot>;
  propose: () => Promise<unknown>;
  draft: (round: number) => Promise<unknown>;
};
export async function executeOperationTool(
  name: string,
  argsText: string,
  used: Set<string>,
  deps: OperationDependencies,
) {
  if (!operationsTools.some((t) => t.name === name))
    throw new Error("Unknown or unauthorized tool");
  if (name !== "inspect_league" && !used.has("inspect_league"))
    throw new Error("Inspect the league successfully before using other tools");
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsText);
  } catch {
    throw new Error("Malformed tool arguments");
  }
  if (name === "inspect_team_history") {
    const { team_id } = z.object({ team_id: z.uuid() }).strict().parse(args),
      s = await deps.snapshot(),
      team = s.teams.find((t) => t.id === team_id);
    if (!team) throw new Error("Team not found in this league");
    const games = s.games
      .filter(
        (g) =>
          g.status === "confirmed" &&
          [g.home_team_id, g.away_team_id].includes(team_id),
      )
      .sort(
        (a, b) =>
          String(b.played_at).localeCompare(String(a.played_at)) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, 5);
    used.add(`inspect_team_history:${team_id}`);
    return {
      team: {
        id: team.id,
        name: team.name,
        rating: team.rating,
        division: s.divisions.find((d) => d.id === team.division_id)?.name,
      },
      verifiedGames: games.map((g) => ({
        id: g.id,
        played_at: g.played_at,
        opponent: s.teams.find(
          (t) =>
            t.id ===
            (g.home_team_id === team_id ? g.away_team_id : g.home_team_id),
        )?.name,
        pointsFor: g.home_team_id === team_id ? g.home_score : g.away_score,
        pointsAgainst: g.home_team_id === team_id ? g.away_score : g.home_score,
        margin:
          g.home_team_id === team_id
            ? g.home_score! - g.away_score!
            : g.away_score! - g.home_score!,
      })),
      readiness: s.readiness?.find((r) => r.team_id === team_id) ?? null,
    };
  }
  if (name === "draft_schedule") {
    const { round } = z
      .object({ round: z.number().int().min(0).max(499) })
      .strict()
      .parse(args);
    if (used.has(name)) throw new Error("This mutating tool already ran");
    used.add(name);
    return deps.draft(round);
  }
  z.object({}).strict().parse(args);
  if (name === "inspect_league") {
    const s = await deps.snapshot();
    used.add(name);
    return {
      teams: s.teams.map((t) => ({
        id: t.id,
        name: t.name,
        rating: t.rating,
        status: t.status,
        division: s.divisions.find((d) => d.id === t.division_id)?.name,
      })),
      verifiedResults: s.games.filter((g) => g.status === "confirmed"),
      confirmedSlots: s.availability.filter((a) => a.confirmed),
      pendingMoves: s.proposals.filter((p) => p.status === "pending"),
      publishedVersion:
        s.versions.find((v) => v.status === "published")?.number ?? 0,
      preseasonEnforced: s.league.preseason_enabled ?? false,
    };
  }
  if (name === "inspect_preseason_readiness") {
    const s = await deps.snapshot();
    used.add(name);
    return {
      enforced: s.league.preseason_enabled ?? false,
      teams: s.readiness ?? [],
    };
  }
  if (![...used].some((k) => k.startsWith("inspect_team_history:")))
    throw new Error(
      "Investigate verified team history before proposing competitive changes",
    );
  if (used.has(name)) throw new Error("This mutating tool already ran");
  used.add(name);
  await deps.propose();
  return (await deps.snapshot()).proposals.filter(
    (p) => p.status === "pending",
  );
}
