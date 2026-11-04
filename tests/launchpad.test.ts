import { describe, expect, it } from "vitest";
import {
  courtCapacity,
  identityIdeas,
  leagueLocalInstant,
  newSetup,
  normalizeDomain,
  setupBlockers,
  setupSchema,
  socialKit,
  websiteSchema,
} from "../src/lib/launchpad";
describe("launch planning boundaries", () => {
  it("counts merged confirmed intervals without double counting overlap or partial hours", () => {
    const slot = (
      id: string,
      start: string,
      end: string,
      confirmed = true,
    ) => ({
      id,
      court_id: "court-a",
      starts_at: start,
      ends_at: end,
      confirmed,
    });
    const result = courtCapacity(
      [
        slot("1", "2099-01-01T10:00Z", "2099-01-01T12:00Z"),
        slot("2", "2099-01-01T11:00Z", "2099-01-01T13:30Z"),
        slot("3", "2099-01-01T14:00Z", "2099-01-01T14:45Z"),
        slot("4", "2099-01-01T15:00Z", "2099-01-01T20:00Z", false),
      ],
      +new Date("2099-01-01T11:00Z"),
    );
    expect(result).toEqual({ slots: 2, minutes: 195 });
  });
  it("accepts incomplete drafts and identifies real missing setup fields", () => {
    const draft = newSetup();
    expect(setupSchema.safeParse(draft).success).toBe(true);
    expect(setupBlockers(draft)).toContain("Set the age cutoff.");
  });
  it("rejects impossible age pairs and duplicated competition keys before finish", () => {
    const d = newSetup();
    d.divisions[1] = { ...d.divisions[0], min_age: 15, max_age: 13 };
    expect(setupBlockers(d).join(" ")).toContain("unique age-category/tier");
  });
  it("does not turn unavailable domain information into availability claims", () => {
    expect(normalizeDomain(" LeagueExample.COM ")).toBe("leagueexample.com");
    for (const v of [
      "https://example.com",
      "example.com/x",
      "127.0.0.1",
      "x.com?x=1",
      "-bad.com",
    ])
      expect(() => normalizeDomain(v)).toThrow();
    expect(identityIdeas("Test League", "Toronto").domains).toContain(
      "testleague.com",
    );
  });
  it("keeps generated registration copy closed until actual registration opens", () => {
    expect(
      socialKit("League", "Toronto", "Spring", false).registration,
    ).toContain("being prepared");
    expect(
      socialKit("League", "Toronto", "Spring", true).registration,
    ).toContain("registration is open");
  });
  it("permits only supported logo data, theme and colour values", () => {
    const base = {
      theme: "arena",
      colour: "#123456",
      accent: "#ffffff",
      headline: "",
      about: "",
      rules: "",
      contactEmail: "",
      logo: "",
    };
    expect(websiteSchema.safeParse(base).success).toBe(true);
    expect(
      websiteSchema.safeParse({ ...base, logo: "data:image/svg+xml,<svg>" })
        .success,
    ).toBe(false);
    expect(
      websiteSchema.safeParse({ ...base, colour: "url(https://evil.invalid)" })
        .success,
    ).toBe(false);
  });
  it("uses the configured zone and rejects daylight-saving gaps or repeated wall times", () => {
    expect(leagueLocalInstant("2025-01-10T10:00", "America/Vancouver")).toBe(
      "2025-01-10T18:00:00.000Z",
    );
    expect(leagueLocalInstant("2026-07-10T10:00", "America/Toronto")).toBe(
      "2026-07-10T14:00:00.000Z",
    );
    expect(() =>
      leagueLocalInstant("2026-03-08T02:30", "America/Toronto"),
    ).toThrow();
    expect(() =>
      leagueLocalInstant("2026-11-01T01:30", "America/Toronto"),
    ).toThrow();
  });
});
