import { z } from "zod";
export const preseasonQuestionnaire = z.object({
  ageCategory: z.string().min(2).max(30),
  previousLeague: z.string().max(100),
  previousDivision: z.string().max(100),
  wins: z.number().int().min(0).max(100),
  losses: z.number().int().min(0).max(100),
  draws: z.number().int().min(0).max(100),
  winningMargin: z.number().min(0).max(60),
  losingMargin: z.number().min(0).max(60),
  returningPercent: z.number().min(0).max(100),
  competitivePlayers: z.number().int().min(0).max(20),
  experience: z.number().int().min(1).max(5),
  yearsTogether: z.number().int().min(0).max(15),
  practicesPerWeek: z.number().int().min(0).max(7),
  preferredTier: z.number().int().min(1).max(3),
  coachConfidence: z.number().min(0).max(100),
  notes: z.string().max(2000),
});
export type PreseasonQuestionnaire = z.infer<typeof preseasonQuestionnaire>;
/** Resolve local midnight without assuming a fixed Toronto UTC offset. */
export function seasonStartInstant(date: string, timeZone: string) {
  const target = Date.parse(date + "T00:00:00Z");
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const local = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const delta = target - local;
    guess += delta;
    if (!delta) break;
  }
  return new Date(guess).toISOString();
}
export const placementInterpretation = z.object({
  summary: z.string().max(2000),
  recommendedTier: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
  inconsistencies: z.array(z.string().max(500)).max(12),
  clarifyingQuestions: z.array(z.string().max(500)).max(8),
  evidence: z.array(z.string().max(500)).max(12),
});
export type Recommendation = {
  tier: number;
  rating: number;
  confidence: number;
  explanation: string;
  flags: string[];
  evidence: string[];
};
/** Preview only; private.preseason_recommend independently recomputes this in PostgreSQL. */
export function recommendPlacement(q: PreseasonQuestionnaire): Recommendation {
  const games = q.wins + q.losses + q.draws,
    decided = q.wins + q.losses;
  const record = games
    ? Math.round(((q.wins + q.draws * 0.5) / games - 0.5) * 180)
    : 0;
  const margin = decided
    ? Math.max(
        -25,
        Math.min(
          25,
          (q.wins * q.winningMargin - q.losses * q.losingMargin) / decided,
        ),
      )
    : 0;
  const rating = Math.max(
    700,
    Math.min(
      1600,
      Math.round(
        800 +
          q.experience * 75 +
          Math.min(q.yearsTogether, 4) * 25 +
          Math.min(q.practicesPerWeek, 4) * 15 +
          record +
          margin * 4 +
          Math.min(q.competitivePlayers, 12) * 8 +
          (q.returningPercent - 50) * 0.4,
      ),
    ),
  );
  const tier = rating >= 1150 ? 1 : rating >= 950 ? 2 : 3,
    flags: string[] = [];
  if (games < 4) flags.push("Limited previous-season game evidence.");
  if (!q.wins && q.winningMargin > 0)
    flags.push("Winning margin was supplied with no wins.");
  if (!q.losses && q.losingMargin > 0)
    flags.push("Losing margin was supplied with no losses.");
  if (q.returningPercent >= 80 && q.yearsTogether === 0)
    flags.push(
      "High returning percentage with zero years together needs clarification.",
    );
  if (Math.abs(q.preferredTier - tier) >= 2)
    flags.push(
      "Coach preference differs by two tiers from the evidence rubric.",
    );
  if (q.coachConfidence >= 80 && games < 4)
    flags.push(
      "High coach confidence is not supported by a substantial game history.",
    );
  if (q.experience === 1 && q.competitivePlayers >= 8)
    flags.push("New-team experience conflicts with many competitive players.");
  const confidence = Math.max(
    0.2,
    Math.min(
      0.9,
      0.4 +
        (games >= 6 ? 0.18 : games > 0 ? 0.06 : 0) +
        (q.previousLeague && q.previousDivision ? 0.12 : 0) +
        (q.returningPercent >= 60 ? 0.1 : 0) -
        flags.length * 0.08,
    ),
  );
  return {
    tier,
    rating,
    confidence: Math.round(confidence * 100) / 100,
    flags,
    evidence: [
      `${games} previous games; ${q.wins} wins, ${q.losses} losses, ${q.draws} draws.`,
      `${q.returningPercent}% returning; ${q.competitivePlayers} competitive players.`,
      `${q.yearsTogether} years together; ${q.practicesPerWeek} practices/week.`,
    ],
    explanation: `Evidence rubric recommends tier ${tier} at rating ${rating}. Self-reported record, margins, continuity and competitive experience inform the recommendation. Human placement approval is required.`,
  };
}
export const settingsSchema = z
  .object({
    enabled: z.boolean(),
    season_name: z.string().min(2).max(80),
    season_start: z.iso.date(),
    cutoff_date: z.iso.date(),
    registration_status: z.enum(["draft", "open", "closed"]),
    questionnaire_deadline: z.iso.datetime(),
    roster_deadline: z.iso.datetime(),
    verification_deadline: z.iso.datetime(),
    min_roster: z.number().int().min(1).max(20),
    max_roster: z.number().int().min(1).max(30),
    document_retention_days: z.number().int().min(1).max(30),
    allowed_document_types: z
      .array(z.enum(["birth_certificate", "passport", "government_id"]))
      .min(1)
      .max(3),
  })
  .refine((v) => v.min_roster <= v.max_roster, {
    message: "Minimum roster cannot exceed maximum",
  })
  .refine(
    (v) =>
      v.questionnaire_deadline <= v.roster_deadline &&
      v.roster_deadline <= v.verification_deadline,
    {
      message: "Deadlines must be in questionnaire, roster, verification order",
    },
  );
export type Readiness = {
  team_id: string;
  questionnaire_completed: boolean;
  placement_approved: boolean;
  roster_submitted: boolean;
  players: number;
  verified: number;
  eligible_for_scheduling: boolean;
  blockers: string[];
};
export type PreseasonData = {
  role: string;
  settings: Record<string, unknown>;
  divisions: {
    id: string;
    name: string;
    tier: number;
    min_age: number;
    max_age: number;
    age_category: string;
  }[];
  teams: {
    id: string;
    name: string;
    status: string;
    coach_id?: string;
    division_id: string | null;
    age_category: string;
  }[];
  questionnaires: {
    team_id: string;
    data: Partial<PreseasonQuestionnaire>;
    status: string;
    revision: number;
    recommendation: Recommendation | null;
    meta_analysis: z.infer<typeof placementInterpretation> | null;
  }[];
  players: {
    id: string;
    team_id: string;
    display_name: string;
    jersey: string;
    birth_date: string;
    guardian_consent: boolean;
    eligibility_status: string;
    verification_status: string;
    active: boolean;
    age: number;
    age_eligible: boolean;
    duplicate_identity: boolean;
  }[];
  documents: {
    id: string;
    player_id: string;
    document_type: string;
    status: string;
    created_at: string;
    retain_until: string;
    sha256: string | null;
    duplicate_document: boolean;
    guardian_name: string | null;
    relationship: string | null;
    consent_at: string | null;
    consent_version: string | null;
    confirmed_details: boolean;
  }[];
  invitations: {
    id: string;
    player_id: string;
    expires_at: string;
    revoked_at: string | null;
  }[];
  reviews: {
    id: string;
    player_id: string;
    decision: string;
    reason: string;
    created_at: string;
  }[];
  readiness: Readiness[];
};
