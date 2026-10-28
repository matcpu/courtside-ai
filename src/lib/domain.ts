import { z } from "zod";

export const questionnaireSchema = z.object({
  yearsTogether: z.number().int().min(0).max(15),
  experience: z.number().int().min(1).max(5),
  practicesPerWeek: z.number().int().min(0).max(7),
  notes: z.string().max(2000),
});
export type Questionnaire = z.infer<typeof questionnaireSchema>;
export function initialRating(q: Questionnaire) {
  return Math.round(
    800 +
      q.experience * 75 +
      Math.min(q.yearsTogether, 4) * 25 +
      Math.min(q.practicesPerWeek, 4) * 15,
  );
}
export function divisionForRating(rating: number) {
  return rating >= 1150 ? 1 : rating >= 950 ? 2 : 3;
}
export function elo(
  home: number,
  away: number,
  homeScore: number,
  awayScore: number,
): [number, number] {
  const outcome = homeScore === awayScore ? 0.5 : homeScore > awayScore ? 1 : 0;
  const change = Math.round(
    32 * (outcome - 1 / (1 + 10 ** ((away - home) / 400))),
  );
  return [home + change, away - change];
}
export function ageOn(dob: string, cutoff: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff))
    throw new Error("Use ISO dates");
  const birth = new Date(dob + "T00:00:00Z"),
    date = new Date(cutoff + "T00:00:00Z");
  if (
    Number.isNaN(+birth) ||
    Number.isNaN(+date) ||
    birth.toISOString().slice(0, 10) !== dob ||
    date.toISOString().slice(0, 10) !== cutoff ||
    birth > date
  )
    throw new Error("Invalid birth date or cutoff");
  return (
    date.getUTCFullYear() -
    birth.getUTCFullYear() -
    Number(
      date.getUTCMonth() < birth.getUTCMonth() ||
        (date.getUTCMonth() === birth.getUTCMonth() &&
          date.getUTCDate() < birth.getUTCDate()),
    )
  );
}
export const playerStatSchema = z.object({
  jersey: z.string().max(4),
  team: z.enum(["home", "away"]),
  points: z.number().int().min(0).max(200).nullable(),
  rebounds: z.number().int().min(0).max(100).nullable(),
  assists: z.number().int().min(0).max(100).nullable(),
});
export const extractionSchema = z.object({
  homeTeam: z.string().nullable(),
  awayTeam: z.string().nullable(),
  homeScore: z.number().int().min(0).max(300).nullable(),
  awayScore: z.number().int().min(0).max(300).nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).max(30),
  players: z.array(playerStatSchema).max(40),
});
export type Extraction = z.infer<typeof extractionSchema>;
export function validateExtraction(e: Extraction, home: string, away: string) {
  const errors: string[] = [];
  if (e.homeScore === null || e.awayScore === null)
    errors.push("Both final scores must be reviewed and entered.");
  if (
    e.homeTeam?.trim().toLowerCase() !== home.trim().toLowerCase() ||
    e.awayTeam?.trim().toLowerCase() !== away.trim().toLowerCase()
  )
    errors.push("Team names must match the selected fixture.");
  if (e.confidence < 0.85)
    errors.push("Low confidence: inspect the original scoresheet.");
  const seen = new Set<string>();
  for (const p of e.players) {
    const key = p.team + ":" + p.jersey;
    if (seen.has(key)) errors.push("Duplicate jersey in player statistics.");
    seen.add(key);
  }
  for (const team of ["home", "away"] as const) {
    const players = e.players.filter((p) => p.team === team);
    const total = players.reduce((n, p) => n + (p.points ?? 0), 0);
    const score = team === "home" ? e.homeScore : e.awayScore;
    if (score !== null && total > score)
      errors.push("Recorded player points exceed team score.");
  }
  return errors;
}
export type Team = {
  id: string;
  name: string;
  division_id: string | null;
  recommended_division: number;
  rating: number;
  initial_rating: number;
  status: string;
  coach_id?: string;
  coach_email?: string;
  phone?: string;
  sms_consent?: boolean;
  assessment?: Questionnaire;
  assessment_explanation?: string;
};
export type Division = {
  id: string;
  name: string;
  tier: number;
  max_age: number;
};
export type Court = { id: string; name: string; venue: string };
export type Availability = {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  confirmed: boolean;
};
export type Game = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  played_at?: string;
};
export type Fixture = {
  id?: string;
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  version_id?: string;
};
export type Version = {
  id: string;
  number: number;
  status: string;
  explanation: string;
  base_revision: number;
  created_at: string;
};
export type Proposal = {
  id: string;
  team_id: string;
  from_division_id: string;
  to_division_id: string;
  reason: string;
  status: string;
  evidence: Record<string, unknown>;
};
export type Sheet = {
  id: string;
  game_id: string;
  status: string;
  extraction: Extraction;
  storage_path: string;
  sha256: string;
  source: string;
  created_at: string;
};
export type Notification = {
  id: string;
  team_id: string;
  recipient_id: string | null;
  read_at: string | null;
  body: string;
  channel: string;
  status: string;
  attempts: number;
  subject: string;
  last_error: string | null;
  created_at: string;
  provider_id?: string;
};
export type Audit = {
  id: string;
  action: string;
  created_at: string;
  detail: Record<string, unknown>;
};
export type Player = {
  id: string;
  team_id: string;
  display_name: string;
  jersey: string;
  birth_date: string;
  guardian_consent: boolean;
  eligibility_status: string;
};
export type Snapshot = {
  statistics: {
    game_id: string;
    team_id: string;
    jersey: string;
    points: number | null;
    rebounds: number | null;
    assists: number | null;
  }[];
  league: {
    id: string;
    name: string;
    slug: string;
    season_name: string;
    cutoff_date: string;
    revision: number;
    data_revision: number;
    is_demo: boolean;
    timezone: string;
  };
  role: string;
  teams: Team[];
  divisions: Division[];
  courts: Court[];
  availability: Availability[];
  games: Game[];
  fixtures: Fixture[];
  versions: Version[];
  proposals: Proposal[];
  scoresheets: Sheet[];
  notifications: Notification[];
  audit: Audit[];
  players: Player[];
};
export type Standing = {
  team: Team;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  for: number;
  against: number;
  points: number;
};
export function standings(teams: Team[], games: Game[]): Standing[] {
  return teams
    .filter((t) => t.status === "approved")
    .map((team) => {
      const row: Standing = {
        team,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        for: 0,
        against: 0,
        points: 0,
      };
      for (const g of games) {
        if (
          g.status !== "confirmed" ||
          g.home_score === null ||
          g.away_score === null ||
          ![g.home_team_id, g.away_team_id].includes(team.id)
        )
          continue;
        const h = g.home_team_id === team.id,
          a = h ? g.home_score : g.away_score,
          b = h ? g.away_score : g.home_score;
        row.played++;
        row.for += a;
        row.against += b;
        if (a > b) {
          row.wins++;
          row.points += 2;
        } else if (a === b) {
          row.draws++;
          row.points++;
        } else row.losses++;
      }
      return row;
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.for - b.against - (a.for - a.against) ||
        a.team.name.localeCompare(b.team.name),
    );
}

export type Slot = {
  court_id: string;
  starts_at: string;
  ends_at: string;
  confirmed: boolean;
};
const overlap = (
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string },
) =>
  +new Date(a.starts_at) < +new Date(b.ends_at) &&
  +new Date(b.starts_at) < +new Date(a.ends_at);
export function conflicts(
  fixtures: Fixture[],
  slots: Slot[],
  restMinutes = 30,
): string[] {
  const errors: string[] = [];
  for (let i = 0; i < fixtures.length; i++) {
    const a = fixtures[i];
    if (a.home_team_id === a.away_team_id)
      errors.push("A team cannot play itself");
    if (+new Date(a.ends_at) <= +new Date(a.starts_at))
      errors.push("Invalid game interval");
    if (
      !slots.some(
        (s) =>
          s.confirmed &&
          s.court_id === a.court_id &&
          +new Date(s.starts_at) <= +new Date(a.starts_at) &&
          +new Date(s.ends_at) >= +new Date(a.ends_at),
      )
    )
      errors.push("Fixture is outside confirmed court availability");
    for (const b of fixtures.slice(i + 1)) {
      if (a.court_id === b.court_id && overlap(a, b))
        errors.push("Court double-booking");
      const shared = [a.home_team_id, a.away_team_id].some((id) =>
        [b.home_team_id, b.away_team_id].includes(id),
      );
      if (
        shared &&
        overlap(
          {
            ...a,
            ends_at: new Date(
              +new Date(a.ends_at) + restMinutes * 60000,
            ).toISOString(),
          },
          {
            ...b,
            ends_at: new Date(
              +new Date(b.ends_at) + restMinutes * 60000,
            ).toISOString(),
          },
        )
      )
        errors.push("Team double-booking or insufficient rest");
      if (a.game_id === b.game_id) errors.push("Duplicate game");
    }
  }
  return errors;
}
/** Bounded deterministic greedy solver. Reports infeasibility; never invents availability. */
export function schedule(
  pairs: Omit<Fixture, "court_id" | "starts_at" | "ends_at">[],
  slots: Slot[],
  locked: Fixture[] = [],
  duration = 60,
  rest = 30,
  notBefore?: string,
): { fixtures: Fixture[]; unscheduled: string[] } {
  const fixtures = [...locked],
    unscheduled: string[] = [];
  if (conflicts(locked, slots, rest).length)
    throw new Error(
      "Locked fixtures violate confirmed availability or conflict constraints",
    );
  const bookings = locked.map((f) => ({
    ...f,
    start: +new Date(f.starts_at),
    end: +new Date(f.ends_at),
  }));
  const candidates = slots
    .filter((s) => s.confirmed)
    .flatMap((s) => {
      const c: { court_id: string; start: number; end: number }[] = [];
      for (
        let start = Math.max(
          +new Date(s.starts_at),
          notBefore ? Math.ceil(+new Date(notBefore) / 1800000) * 1800000 : 0,
        );
        start + duration * 60000 <= +new Date(s.ends_at);
        start += 30 * 60000
      )
        c.push({ court_id: s.court_id, start, end: start + duration * 60000 });
      return c;
    })
    .sort((a, b) => a.start - b.start || a.court_id.localeCompare(b.court_id));
  for (const pair of pairs) {
    let assigned = false;
    if (pair.home_team_id === pair.away_team_id) {
      unscheduled.push(pair.game_id);
      continue;
    }
    for (const c of candidates) {
      const blocked = bookings.some(
        (b) =>
          b.game_id === pair.game_id ||
          (b.court_id === c.court_id && c.start < b.end && b.start < c.end) ||
          ([pair.home_team_id, pair.away_team_id].some((id) =>
            [b.home_team_id, b.away_team_id].includes(id),
          ) &&
            c.start < b.end + rest * 60000 &&
            b.start < c.end + rest * 60000),
      );
      if (!blocked) {
        const f = {
          ...pair,
          court_id: c.court_id,
          starts_at: new Date(c.start).toISOString(),
          ends_at: new Date(c.end).toISOString(),
        };
        fixtures.push(f);
        bookings.push({ ...f, start: c.start, end: c.end });
        assigned = true;
        break;
      }
    }
    if (!assigned) unscheduled.push(pair.game_id);
  }
  return { fixtures, unscheduled };
}
export function roundRobin(teams: Team[], round = 0) {
  const result: { home_team_id: string; away_team_id: string }[] = [];
  for (const division of [...new Set(teams.map((t) => t.division_id))].sort()) {
    const ids = teams
      .filter((t) => t.status === "approved" && t.division_id === division)
      .map((t) => t.id)
      .sort();
    if (ids.length % 2) ids.push("BYE");
    if (ids.length < 2) continue;
    for (let n = 0; n < round % (ids.length - 1); n++)
      ids.splice(1, 0, ids.pop()!);
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i],
        b = ids[ids.length - 1 - i];
      if (a !== "BYE" && b !== "BYE")
        result.push(
          round % 2
            ? { home_team_id: b, away_team_id: a }
            : { home_team_id: a, away_team_id: b },
        );
    }
  }
  return result;
}
