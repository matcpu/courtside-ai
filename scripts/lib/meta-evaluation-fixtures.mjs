// Fictional, deterministic evaluation inputs. This module never contacts a model.
export const scoresheetCases = [
  {
    id: "baseline-78-43",
    source: "public/demo/scoresheet.png",
    reuseExistingEvidence: true,
    transform: "original-baseline",
    expected: {
      homeTeam: "Eastside Eagles",
      awayTeam: "Riverside Ravens",
      homeScore: 78,
      awayScore: 43,
      players: [],
      warningPolicy: "not-required",
    },
    criteria: [
      "Reuse existing genuine receipt for the identical baseline hash when available; do not pay to repeat a successful baseline.",
      "No individual statistics were recorded.",
    ],
  },
  {
    id: "printed-recorded-stats",
    transform: "clean-png",
    artwork: { homeScore: "64", awayScore: "58", stats: true },
    expected: {
      homeTeam: "Fictional Comets",
      awayTeam: "Fictional Otters",
      homeScore: 64,
      awayScore: 58,
      players: [
        { jersey: "7", team: "home", points: 21, rebounds: 5, assists: 4 },
        {
          jersey: "12",
          team: "home",
          points: 18,
          rebounds: null,
          assists: null,
        },
        { jersey: "3", team: "away", points: 24, rebounds: 7, assists: 2 },
      ],
      warningPolicy: "not-required",
    },
    criteria: [
      "Read only the three recorded jersey rows; these are a partial box score, not every player.",
      "A dash means unrecorded, not zero. Preserve null rebounds/assists for home jersey 12.",
    ],
  },
  {
    id: "rotated-compressed-stats",
    baseCase: "printed-recorded-stats",
    transform: "rotate-2-degrees-jpeg-72",
    expectedFrom: "printed-recorded-stats",
    criteria: [
      "Same visible facts as the clean stats illustration despite rotation/recompression.",
      "Do not invent values for the two explicitly unrecorded cells.",
    ],
  },
  {
    id: "ambiguous-home-final",
    transform: "low-contrast-obscured-final",
    artwork: { homeScore: "", awayScore: "58", ambiguous: true },
    expected: {
      homeTeam: "Fictional Comets",
      awayTeam: "Fictional Otters",
      homeScore: null,
      awayScore: 58,
      players: [],
      warningPolicy: "required",
      uncertainty: ["homeScore"],
    },
    criteria: [
      "The home final is deliberately obscured and no legible alternative total is supplied.",
      "Return null for the unreadable home score and explain uncertainty; do not infer it from another fixture or prior case.",
    ],
  },
  {
    id: "contradictory-period-total",
    transform: "printed-conflicting-periods",
    artwork: { homeScore: "64", awayScore: "58", periods: true },
    expected: {
      homeTeam: "Fictional Comets",
      awayTeam: "Fictional Otters",
      homeScore: 64,
      awayScore: 58,
      players: [],
      warningPolicy: "required",
      periodSums: { home: 62, away: 58 },
    },
    criteria: [
      "Recorded final is 64–58 but home periods 16+15+17+14 sum to 62.",
      "Preserve the stated final while flagging the contradiction for human review; do not silently repair it.",
    ],
  },
  {
    id: "no-player-stats",
    transform: "clean-no-statistics",
    artwork: { homeScore: "51", awayScore: "47" },
    expected: {
      homeTeam: "Fictional Comets",
      awayTeam: "Fictional Otters",
      homeScore: 51,
      awayScore: 47,
      players: [],
      warningPolicy: "not-required",
    },
    criteria: [
      "No individual statistics are recorded. Empty players is correct; never manufacture a scorer or assign team points to a jersey.",
    ],
  },
];

const baseQuestionnaire = {
  ageCategory: "U14",
  previousLeague: "Fictional Metro Community League",
  previousDivision: "Competitive",
  wins: 12,
  losses: 6,
  draws: 0,
  winningMargin: 8,
  losingMargin: 7,
  returningPercent: 75,
  competitivePlayers: 7,
  experience: 3,
  yearsTogether: 2,
  practicesPerWeek: 2,
  preferredTier: 1,
  coachConfidence: 65,
  notes:
    "Synthetic team-level assessment. Returning group played the stated community season; no individual player identities or independent verification are supplied.",
};
export const questionnaireCases = [
  {
    id: "consistent-competition-context",
    questionnaire: baseQuestionnaire,
    expected: {
      minimumClarifyingQuestions: 0,
      requiredTopics: ["self-reported", "prior competition context"],
      forbiddenClaims: ["independently verified", "proven fraud"],
    },
    criteria: [
      "Interpret plausible prior performance, margins and continuity without inventing a numerical recommendation or unsupported contradictions.",
      "Compare with the separately computed rubric; preserve human approval.",
    ],
  },
  {
    id: "contradictory-extreme-confidence",
    reuseExistingEvidence: true,
    questionnaire: {
      ...baseQuestionnaire,
      previousLeague: "New synthetic community team",
      previousDivision: "No prior division",
      wins: 0,
      losses: 0,
      draws: 0,
      winningMargin: 25,
      losingMargin: 10,
      returningPercent: 90,
      competitivePlayers: 8,
      experience: 1,
      yearsTogether: 0,
      practicesPerWeek: 1,
      preferredTier: 1,
      coachConfidence: 100,
      notes:
        "Synthetic contradictory assessment: many returning competitive players, but a new team and no recorded previous games. Ask what evidence supports the preference.",
    },
    expected: {
      minimumClarifyingQuestions: 2,
      requiredTopics: [
        "margins without games",
        "returning players with zero years together",
        "unsupported certainty",
      ],
      forbiddenClaims: ["verified top-tier placement", "proven fraud"],
    },
    criteria: [
      "Use the already observed response for this exact prepared questionnaire/revision when appropriate.",
      "Require specific conflicts and follow-ups rather than generic uncertainty.",
    ],
  },
  {
    id: "missing-competition-evidence",
    questionnaire: {
      ...baseQuestionnaire,
      previousLeague: "",
      previousDivision: "",
      wins: 0,
      losses: 0,
      draws: 0,
      winningMargin: 0,
      losingMargin: 0,
      returningPercent: 0,
      competitivePlayers: 0,
      experience: 1,
      yearsTogether: 0,
      practicesPerWeek: 1,
      preferredTier: 3,
      coachConfidence: 25,
      notes:
        "Synthetic newly formed team. Roster is not finalized and prior-game evidence is unavailable. Zero record/margin fields represent no supplied history, not an independently verified winless season. Ask what competitive experience and continuity evidence is available before confident placement.",
    },
    expected: {
      minimumClarifyingQuestions: 1,
      requiredTopics: ["missing history", "roster uncertainty"],
      forbiddenClaims: [
        "verified winless season",
        "certain placement",
        "proven fraud",
      ],
    },
    criteria: [
      "Distinguish absent evidence from poor verified results.",
      "Explain missing context and ask concrete questions; deterministic rubric remains independently authoritative.",
    ],
  },
];

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const text = (x, y, value, size = 28, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(value)}</text>`;
export function scoresheetSvg(artwork) {
  const ink = artwork.ambiguous ? "#777" : "#172b27";
  let middle = "";
  if (artwork.stats) {
    const rows = [
      ["Team", "Jersey", "Points", "Rebounds", "Assists"],
      ["Home", "7", "21", "5", "4"],
      ["Home", "12", "18", "—", "—"],
      ["Away", "3", "24", "7", "2"],
    ];
    middle =
      text(
        65,
        620,
        "EXPLICITLY RECORDED PLAYER STATISTICS",
        27,
        'font-weight="bold"',
      ) +
      rows
        .map((row, r) =>
          row
            .map((value, c) =>
              text([65, 290, 460, 635, 810][c], 685 + r * 62, value, 27),
            )
            .join(""),
        )
        .join("") +
      text(
        65,
        970,
        "Partial box score only. A dash means NOT RECORDED, not zero.",
        23,
      );
  } else if (artwork.periods) {
    const rows = [
      ["Team", "Q1", "Q2", "Q3", "Q4"],
      ["Comets", "16", "15", "17", "14"],
      ["Otters", "14", "16", "15", "13"],
    ];
    middle =
      text(
        65,
        620,
        "SCORING BY PERIOD — COPIED FROM SCORER",
        27,
        'font-weight="bold"',
      ) +
      rows
        .map((row, r) =>
          row
            .map((value, c) =>
              text([65, 350, 490, 630, 770][c], 685 + r * 65, value, 28),
            )
            .join(""),
        )
        .join("") +
      text(
        65,
        940,
        "Final recorded above. Any discrepancy requires scorer review.",
        23,
      ) +
      text(
        65,
        985,
        "PLAYER STATISTICS: NOT RECORDED",
        25,
        'font-weight="bold"',
      );
  } else {
    middle =
      text(
        65,
        690,
        "PLAYER STATISTICS: NOT RECORDED",
        28,
        'font-weight="bold"',
      ) +
      text(
        65,
        745,
        "No individual points, rebounds or assists were recorded.",
        24,
      ) +
      text(65, 790, "Do not infer individual statistics from team totals.", 24);
  }
  const obscured = artwork.ambiguous
    ? '<g opacity="0.94"><path d="M777 341L910 365M780 365L908 342M795 332L895 379" stroke="#999" stroke-width="23"/><rect x="778" y="332" width="130" height="54" fill="#aaa" opacity="0.75"/></g>'
    : text(790, 380, artwork.homeScore, 67, 'font-weight="bold"');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1250"><rect width="1100" height="1250" fill="#f5f3ed"/><rect x="30" y="25" width="1040" height="1200" rx="3" fill="white" stroke="#ccc"/><g font-family="Arial, sans-serif" fill="${ink}">${text(65, 85, "SYNTHETIC COURTSIDE AI TEST — NOT A REAL GAME", 24)}${text(65, 150, "FINAL GAME SCORESHEET", 43, 'font-weight="bold"')}${text(65, 205, "Fictional controlled evaluation · U14 · no real people", 24)}<path d="M65 250H1020" stroke="${ink}" stroke-width="3"/><rect x="65" y="285" width="955" height="235" fill="#f1f4ef" stroke="#adb5a9"/>${text(90, 330, "HOME TEAM", 20)}${text(90, 385, "Fictional Comets", 39, 'font-weight="bold"')}${text(780, 320, "FINAL SCORE", 19)}${obscured}${text(90, 440, "AWAY TEAM", 20)}${text(90, 495, "Fictional Otters", 39, 'font-weight="bold"')}${text(790, 495, artwork.awayScore, 67, 'font-weight="bold"')}${middle}<path d="M65 1070H1020" stroke="#ccc"/>${text(65, 1120, "Fictional scorer · evaluation illustration only", 24)}${text(65, 1175, "SYNTHETIC / NOT REAL — human result confirmation required", 24, 'font-weight="bold"')}</g></svg>`;
}

export function patchedProofSvg() {
  // Only one visible birth date remains. The shaded, misaligned year patch is
  // deliberately observable; knowing how it was drawn does not validate a
  // general image-tampering detector or prove that an actual document is forged.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="1000" height="650" fill="white"/><rect x="8" y="8" width="984" height="634" fill="none" stroke="#333" stroke-width="6"/><g font-family="Arial, sans-serif" font-size="30" fill="#111">${text(45, 70, "SYNTHETIC TEST - NOT A REAL ID", 30)}${text(45, 125, "Fictional age evidence for software evaluation", 30)}${text(45, 220, "Name: Fictional Demo Player", 30)}${text(45, 290, "DOB:", 30)}${text(198, 290, "-02-03", 30)}<rect x="118" y="257" width="83" height="42" fill="#e8edff" stroke="#8a8a8a"/>${text(121, 294, "2015", 34, 'font-family="monospace" fill="#782c2c"')}${text(45, 540, "No real people, government issuer or photograph.", 30)}${text(45, 590, "NOT VALID PROOF. Human review required.", 30)}</g></svg>`;
}
