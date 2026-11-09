import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeagueWebsite, colourText } from "../src/components/league-website";
import { defaultSportRules } from "../src/lib/sports";
import {
  emptyWebsite,
  formatLeagueDate,
  newSetup,
  setupIssues,
  type SiteData,
} from "../src/lib/launchpad";

export const site: SiteData = {
  config: { ...emptyWebsite, headline: "Harbour basketball, Spring 2099" },
  league: {
    id: "test",
    name: "Harbour League",
    slug: "test",
    season: "Spring 2099",
    timezone: "America/Toronto",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    start: "2099-03-01",
    end: "2099-06-30",
    cutoff: "2099-01-01",
    registration: "closed",
    registrationDeadline: "2099-02-01T12:00:00Z",
    minRoster: 5,
    maxRoster: 12,
  },
  divisions: [
    {
      name: "U14 · Premier",
      age_category: "U14",
      tier: 1,
      min_age: 0,
      max_age: 13,
    },
  ],
  teams: [],
  fixtures: [],
  standings: [],
  venues: [
    { name: "Court A", venue: "Harbour Centre" },
    { name: "Court B", venue: "Harbour Centre" },
  ],
};
const render = (data: SiteData) =>
  renderToStaticMarkup(createElement(LeagueWebsite, { data }));

it.each(["arena", "community", "courtside"] as const)(
  "%s presents hockey without basketball copy or invented player data",
  (theme) => {
    const html = render({
      ...site,
      config: { ...site.config, theme, headline: "Synthetic hockey season" },
      league: {
        ...site.league,
        sport: "hockey",
        sport_rules: defaultSportRules("hockey"),
      },
      venues: [{ name: "Synthetic Rink", venue: "Synthetic Arena" }],
      fixtures: [
        {
          home: "Synthetic Alpha",
          away: "Synthetic Beta",
          court: "Synthetic Rink",
          venue: "Synthetic Arena",
          starts_at: "2026-11-01T12:00:00Z",
          status: "confirmed",
          home_score: 4,
          away_score: 3,
          decision: "overtime",
        },
      ],
      standings: [
        {
          name: "Synthetic Alpha",
          played: 1,
          wins: 1,
          losses: 0,
          draws: 0,
          overtimeLosses: 0,
          points: 2,
          differential: 1,
        },
      ],
    });
    expect(html).toContain("Hockey");
    expect(html).toContain("1 rink");
    expect(html).toContain("Final · OT");
    expect(html).toContain("OT/SO L");
    expect(html).not.toContain("Basketball");
    expect(html).not.toContain('class="site-basketball-detail"');
    for (const field of ["birth_date", "guardian_email", "document_path"])
      expect(html).not.toContain(field);
  },
);
describe("public league presentation", () => {
  it.each(["arena", "community", "courtside"] as const)(
    "%s suppresses empty competition and contact modules without hiding eligibility",
    (theme) => {
      const html = render({ ...site, config: { ...site.config, theme } });
      for (const id of ["schedule", "standings", "contact"]) {
        expect(html).not.toContain(`id="${id}"`);
        expect(html).not.toContain(`href="#${id}"`);
      }
      expect(html).not.toContain("0 teams");
      expect(html).toContain("1 venue · 2 courts");
      expect(html).toContain("Ages 0–13");
      expect(html).toContain("January 1, 2099");
      expect(html).toContain("Rules &amp; eligibility");
      expect(html).not.toContain("site-court-art");
    },
  );
  it("shows real published fixtures and final scores without manufacturing pending scores", () => {
    const data = {
      ...site,
      fixtures: [
        {
          home: "Falcons",
          away: "Ravens",
          court: "Court A",
          venue: "Harbour Centre",
          starts_at: "2099-03-07T16:00Z",
          home_score: 78,
          away_score: 43,
          status: "confirmed",
        },
        {
          home: "Falcons",
          away: "Owls",
          court: "Court B",
          venue: "Harbour Centre",
          starts_at: "2099-03-08T16:00Z",
          home_score: null,
          away_score: null,
          status: "scheduled",
        },
      ],
      standings: [
        {
          name: "Falcons",
          played: 1,
          wins: 1,
          losses: 0,
          draws: 0,
          points: 2,
          differential: 35,
        },
      ],
    };
    const html = render(data);
    expect(html).toContain("78 – 43");
    expect(html).toContain('id="schedule"');
    expect(html).toContain('id="standings"');
    expect(html).not.toContain("null");
  });
  it("does not sell zero-game standings as an active competition", () => {
    expect(
      render({
        ...site,
        standings: [
          {
            name: "Falcons",
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            points: 0,
            differential: 0,
          },
        ],
      }),
    ).not.toContain('id="standings"');
  });
  it("keeps the league identity primary and escapes approved public copy", () => {
    const html = render({
      ...site,
      config: { ...site.config, headline: "<script>alert(1)</script>" },
    });
    expect(html).toContain("Harbour League</h1>");
    expect(html).not.toContain("<script>");
  });
  it("offers safe readable foregrounds for very light and very dark custom colours", () => {
    expect(colourText("#ffffff")).toBe("#000000");
    expect(colourText("#000000")).toBe("#ffffff");
    expect(colourText("#123b35")).toBe("#ffffff");
    expect(colourText("#d4f58a")).toBe("#000000");
  });
});
it("formats date-only configuration without browser timezone drift", () => {
  expect(formatLeagueDate("2027-03-01")).toBe("March 1, 2027");
  expect(formatLeagueDate("")).toBe("To be announced");
});
it("maps facilities and document-policy blockers to their correction steps", () => {
  const draft = { ...newSetup(), courts: [{ name: "", venue: "" }] };
  expect(setupIssues(draft)).toContainEqual({
    message: "Each court needs a unique name and venue/address.",
    step: 2,
  });
  expect(setupIssues(draft)).toContainEqual({
    message: "Select at least one accepted proof-of-age document.",
    step: 3,
  });
  expect(
    setupIssues({ ...draft, retentionDays: 31 }).some(
      (issue) =>
        issue.step === 3 && issue.message.startsWith("Document retention:"),
    ),
  ).toBe(true);
  expect(
    setupIssues({ ...draft, proofRequired: false }).some((issue) =>
      issue.message.includes("proof-of-age"),
    ),
  ).toBe(false);
});
import { publicVenueName } from "../src/lib/league-website";
it("moves only the legacy demo venue suffix into a page disclosure", () => {
  expect(
    publicVenueName("Northstar Community Centre · Fictional venue", true),
  ).toBe("Northstar Community Centre");
  expect(
    publicVenueName("Northstar Community Centre · Fictional venue", false),
  ).toBe("Northstar Community Centre · Fictional venue");
  expect(
    publicVenueName("Fictional Harbour Community Centre · Toronto", true),
  ).toBe("Fictional Harbour Community Centre · Toronto");
});
it.each(["arena", "community", "courtside"] as const)(
  "%s displays configured ages and replaces repeated venue disclosure with an accessible page notice",
  (theme) => {
    const data: SiteData = {
      ...site,
      config: {
        ...site.config,
        theme,
        about: "This demonstration league uses synthetic teams and results.",
      },
      league: { ...site.league, cutoff: "2026-09-01" },
      divisions: site.divisions.map((d) => ({
        ...d,
        min_age: 12,
        max_age: 13,
      })),
      fixtures: [
        {
          home: "Synthetic home",
          away: "Synthetic away",
          court: "North Court",
          venue: "Northstar Community Centre · Fictional venue",
          starts_at: "2026-11-03T14:00Z",
          status: "pending",
          home_score: null,
          away_score: null,
        },
      ],
    };
    const html = render(data);
    expect(html).toContain('aria-label="Demo league disclosure"');
    expect(html.replace(/<[^>]+>/g, "")).toContain(
      "Demo league · All teams, venues and results are fictional.",
    );
    expect(html.indexOf('class="site-demo-disclosure"')).toBeLessThan(
      html.indexOf('id="home"'),
    );
    expect(html).toContain("Demonstration league · Synthetic data");
    expect(html).toContain("Ages 12–13");
    expect(html).not.toContain("Ages 0–13");
    expect(html).toContain("September 1, 2026");
    expect(html).not.toContain("Fictional venue");
    expect(html).toContain("Northstar Community Centre");
    expect(html).toContain("Result pending");
  },
);
it("does not label undeclared real league copy as a fictional demo", () => {
  expect(render(site)).not.toContain('class="site-demo-disclosure"');
});

it.each(["arena", "community", "courtside"] as const)(
  "%s keeps a direct product-home link in the public header",
  (theme) => {
    const html = render({ ...site, config: { ...site.config, theme } });
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    expect(header).toContain('class="site-back-link" href="/"');
    expect(header).toContain("← Back to Courtside AI");
    expect(header).toContain('class="site-brand"');
    expect(html).toContain("Powered by Courtside AI");
  },
);
