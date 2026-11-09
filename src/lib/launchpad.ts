import { z } from "zod";
import type { Availability, Snapshot } from "./domain";
import {
  defaultSportRules,
  sportSchema,
  sportRulesSchema,
  type Sport,
  type SportRules,
} from "./sports.ts";

const date = z.union([z.literal(""), z.iso.date()]);
const text = (max: number) => z.string().max(max);
export const setupSchema = z.object({
  // Omission by an older client must preserve an existing league's policy.
  sport: sportSchema.optional(),
  sportRules: sportRulesSchema.optional(),
  name: text(100),
  kind: z.enum(["competitive", "recreational", "tournament", "other"]),
  country: text(80),
  region: text(80),
  city: text(80),
  area: text(250),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone"),
  expectedTeams: z.number().int().min(2).max(1000),
  adminContact: z.union([z.literal(""), z.email().max(150)]),
  season: text(80),
  start: date,
  end: date,
  opening: date,
  cutoff: date,
  registrationDeadline: date,
  rosterDeadline: date,
  verificationDeadline: date,
  divisions: z
    .array(
      z.object({
        name: text(100),
        age_category: text(30),
        tier: z.number().int().min(1).max(3),
        min_age: z.number().int().min(0).max(20),
        max_age: z.number().int().min(5).max(20),
      }),
    )
    .min(1)
    .max(24),
  courts: z.array(z.object({ name: text(100), venue: text(180) })).max(30),
  minRoster: z.number().int().min(1).max(20),
  maxRoster: z.number().int().min(1).max(30),
  gamesPerTeam: z.number().int().min(1).max(40),
  retentionDays: z.number().int().min(1).max(30),
  proofRequired: z.boolean().default(true),
  allowedDocumentTypes: z
    .array(z.enum(["birth_certificate", "passport", "government_id"]))
    .max(3),
});
export type Setup = z.infer<typeof setupSchema>;
export type SetupDraft = {
  id: string;
  revision: number;
  base_revision?: number;
  data: Setup;
  league_id: string | null;
  updated_at: string;
  status: string;
};
export const websiteSchema = z.object({
  theme: z.enum(["courtside", "community", "arena"]),
  colour: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  headline: text(120),
  about: text(1800),
  rules: text(1800),
  contactEmail: z.union([z.literal(""), z.email().max(150)]),
  logo: z
    .string()
    .max(360000)
    .regex(/^(|data:image\/png;base64,[A-Za-z0-9+/=]+)$/),
});
export type Website = z.infer<typeof websiteSchema>;
export const emptyWebsite: Website = {
  theme: "courtside",
  colour: "#164d3b",
  accent: "#d5f58c",
  headline: "A place to play. A season to remember.",
  about: "",
  rules: "",
  contactEmail: "",
  logo: "",
};
export type SiteData = {
  config: Website;
  league: {
    sport?: Sport;
    sport_rules?: SportRules;
    id: string;
    name: string;
    slug: string;
    season: string;
    timezone: string;
    city: string;
    region: string;
    country: string;
    start: string;
    end: string;
    cutoff: string;
    registration: string;
    registrationDeadline: string;
    minRoster: number;
    maxRoster: number;
  };
  divisions: {
    name: string;
    age_category: string;
    tier: number;
    min_age: number;
    max_age: number;
  }[];
  teams: { id: string; name: string; division_id: string | null }[];
  fixtures: {
    decision?: import("./sports").Decision;
    home: string;
    away: string;
    court: string;
    venue: string;
    starts_at: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
  }[];
  standings: {
    overtimeLosses?: number;
    name: string;
    played: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    differential: number;
  }[];
  venues: { name: string; venue: string }[];
};
export function newSetup(): Setup {
  return {
    sport: "basketball",
    sportRules: defaultSportRules(),
    name: "",
    kind: "competitive",
    country: "Canada",
    region: "Ontario",
    city: "",
    area: "",
    timezone: "America/Toronto",
    expectedTeams: 10,
    adminContact: "",
    season: "",
    start: "",
    end: "",
    opening: "",
    cutoff: "",
    registrationDeadline: "",
    rosterDeadline: "",
    verificationDeadline: "",
    minRoster: 5,
    maxRoster: 20,
    gamesPerTeam: 1,
    retentionDays: 14,
    proofRequired: true,
    allowedDocumentTypes: [],
    divisions: ["Premier", "Competitive", "Development"].map((name, i) => ({
      name: `U14 · ${name}`,
      age_category: "U14",
      tier: i + 1,
      min_age: 0,
      max_age: 13,
    })),
    courts: [],
  };
}
export function setupBlockers(s: Setup) {
  const b: string[] = [];
  if (s.name.trim().length < 2) b.push("Add a league name.");
  if (!s.city.trim() || !s.country.trim())
    b.push("Choose the primary city and country.");
  if (s.season.trim().length < 2) b.push("Name the upcoming season.");
  for (const [key, label] of [
    ["start", "season start"],
    ["end", "season end"],
    ["opening", "opening day"],
    ["cutoff", "age cutoff"],
    ["registrationDeadline", "registration deadline"],
    ["rosterDeadline", "roster deadline"],
    ["verificationDeadline", "verification deadline"],
  ] as const)
    if (!s[key]) b.push(`Set the ${label}.`);
  if (s.start && s.end && s.end < s.start)
    b.push("Season end must follow its start.");
  if (
    (s.opening && s.start && s.opening < s.start) ||
    (s.opening && s.end && s.opening > s.end)
  )
    b.push("Opening day must fall within the season.");
  if (
    (s.registrationDeadline &&
      s.rosterDeadline &&
      s.registrationDeadline > s.rosterDeadline) ||
    (s.rosterDeadline &&
      s.verificationDeadline &&
      s.rosterDeadline > s.verificationDeadline)
  )
    b.push("Order deadlines: registration, roster, verification.");
  if (s.verificationDeadline && s.opening && s.verificationDeadline > s.opening)
    b.push("Verification must finish by opening day.");
  if (s.minRoster > s.maxRoster)
    b.push("Minimum roster cannot exceed maximum roster.");
  const keys = new Set<string>();
  for (const d of s.divisions) {
    const key = d.age_category.trim().toLowerCase() + ":" + d.tier;
    if (
      keys.has(key) ||
      d.name.trim().length < 2 ||
      d.age_category.trim().length < 2 ||
      d.min_age > d.max_age
    ) {
      b.push(
        "Give divisions unique age-category/tier pairs, names and valid age ranges.",
      );
      break;
    }
    keys.add(key);
  }
  if (
    s.courts.some((c) => !c.name.trim() || !c.venue.trim()) ||
    new Set(s.courts.map((c) => c.name.trim().toLowerCase())).size !==
      s.courts.length
  )
    b.push("Each court needs a unique name and venue/address.");
  if (s.proofRequired !== false && !s.allowedDocumentTypes.length)
    b.push("Select at least one accepted proof-of-age document.");
  return b;
}
/** Step ownership is shared by inline validation and the final review links. */
export function setupIssues(s: Setup): { message: string; step: number }[] {
  const issues = setupBlockers(s).map((message) => ({
    message,
    step: /league name|primary city/.test(message)
      ? 0
      : /court/.test(message)
        ? 2
        : /roster cannot|proof-of-age/.test(message)
          ? 3
          : 1,
  }));
  const parsed = setupSchema.safeParse(s);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      const step = [
        "minRoster",
        "maxRoster",
        "retentionDays",
        "allowedDocumentTypes",
        "proofRequired",
        "sportRules",
      ].includes(key)
        ? 3
        : key === "courts"
          ? 2
          : [
                "season",
                "start",
                "end",
                "opening",
                "cutoff",
                "registrationDeadline",
                "rosterDeadline",
                "verificationDeadline",
                "divisions",
              ].includes(key)
            ? 1
            : 0;
      const label =
        (
          {
            minRoster: "Minimum roster",
            maxRoster: "Maximum roster",
            retentionDays: "Document retention",
          } as Record<string, string>
        )[key] ?? key;
      issues.push({ message: `${label}: ${issue.message}`, step });
    }
  }
  return issues;
}
/** Date-only league settings must not shift a day in the viewer's timezone. */
export function formatLeagueDate(value: string, fallback = "To be announced") {
  if (!value) return fallback;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(+date)
    ? fallback
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
}
/** An upper bound, not a feasible-matchup promise. Merge overlaps per court. */
export function courtCapacity(
  availability: Availability[],
  notBefore: number,
  gameMinutes = 60,
) {
  const byCourt = new Map<string, [number, number][]>();
  for (const a of availability.filter((a) => a.confirmed)) {
    const start = Math.max(+new Date(a.starts_at), notBefore),
      end = +new Date(a.ends_at);
    if (!Number.isFinite(start) || end <= start) continue;
    const list = byCourt.get(a.court_id) ?? [];
    list.push([start, end]);
    byCourt.set(a.court_id, list);
  }
  let minutes = 0,
    slots = 0;
  for (const spans of byCourt.values()) {
    spans.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of spans) {
      const last = merged.at(-1);
      if (last && a <= last[1]) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    for (const [a, b] of merged) {
      minutes += (b - a) / 60000;
      slots += Math.floor((b - a) / (gameMinutes * 60000));
    }
  }
  return { minutes, slots };
}
export function launchState(s: Snapshot, registration: string) {
  if (s.versions.some((v) => v.status === "published"))
    return s.games.some((g) => g.status === "confirmed")
      ? "Active"
      : "Published";
  if (s.versions.some((v) => v.status === "draft")) return "Scheduling";
  if (s.teams.some((t) => t.status === "pending")) return "Placement";
  return registration === "open" ? "Registration open" : "Draft";
}
export function identityIdeas(name: string, city: string) {
  const base = name.trim() || `${city.trim() || "Community"} Basketball`;
  const ideas = launchIdentity(base);
  return {
    names: [
      base,
      `${city.trim() || "Community"} Hoops League`,
      `${city.trim() || "Community"} Basketball Collective`,
    ],
    domains: ideas.domains,
    handles: ideas.handles,
  };
}
export function socialKit(
  name: string,
  city: string,
  season: string,
  registrationOpen: boolean,
) {
  const league = name.trim() || "Our basketball league",
    place = city.trim() || "our community";
  return {
    bio: launchSocialKit(
      league,
      season,
      [],
      "[Add approved public website URL]",
    ).bio,
    description: `${league} brings youth basketball teams together in ${place}. Explore age groups, eligibility rules, confirmed venues and the approved schedule on our league website.`,
    posts: launchSocialKit(
      league,
      season,
      [],
      "[Add approved public website URL]",
    ).posts.map((post) => post.copy),
    registration: registrationOpen
      ? `${league} team registration is open. Check deadlines and age groups on our official website, then sign in to submit your team for league review.`
      : `${league} registration is being prepared. Follow our official website for the confirmed opening announcement.`,
    template:
      "[Confirmed date] · [Approved venue] · [Public website URL]. Check the website for the latest approved information.",
  };
}
export function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase();
  if (
    !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      domain,
    )
  )
    throw new Error("Enter a domain name without a URL or path.");
  return domain;
}
/** Resolve a wall time in the configured league zone; reject DST gaps/ambiguity. */
export function leagueLocalInstant(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Choose a valid date and time.");
  const target = Date.parse(value + ":00Z");
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wall = (at: number) => {
    const p = Object.fromEntries(
      format.formatToParts(at).map((v) => [v.type, v.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const delta = target - Date.parse(wall(guess) + ":00Z");
    guess += delta;
    if (!delta) break;
  }
  if (
    !Number.isFinite(guess) ||
    wall(guess) !== value ||
    wall(guess - 3600000) === value ||
    wall(guess + 3600000) === value
  )
    throw new Error(
      "This local time is missing or repeated during a daylight-saving change. Choose an unambiguous time.",
    );
  return new Date(guess).toISOString();
}

// Reused from PR #1 (43414f9); keep the schema-free starter API compatible.
/** Starter materials derived only from public league identity information. */
export function launchIdentity(name: string) {
  const root =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 25) || "basketballleague";
  const handles = [root, `${root}hoops`, `${root}basketball`].map((value) =>
    value.slice(0, 30),
  );
  return {
    handles: [...new Set(handles)],
    domains: [
      ...new Set([`${root}.com`, `${root}.ca`, `${root}basketball.com`]),
    ],
  };
}

export function launchSocialKit(
  name: string,
  season: string,
  divisionNames: string[],
  website: string,
) {
  const ageGroups = divisionNames.length
    ? `Divisions: ${divisionNames.join(", ")}.`
    : "Division details will be announced soon.";
  return {
    bio: `${name} | Youth basketball league. ${season}. Fixtures, standings and team registration: ${website}`,
    posts: [
      {
        title: "Introducing the league",
        copy: `Welcome to ${name}! We're getting ready for ${season}. Follow along for team updates, schedules and a season built around the game. ${website}`,
      },
      {
        title: "Season information",
        copy: `${season} is taking shape at ${name}. ${ageGroups} Find official league information at ${website}`,
      },
      {
        title: "Join the season",
        copy: `Coaches and teams: interested in ${name}? Visit our league portal for current registration information. Registration may not yet be open. ${website}`,
      },
    ],
  };
}
