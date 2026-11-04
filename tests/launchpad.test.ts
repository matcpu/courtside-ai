import { describe, expect, it } from "vitest";
import { launchIdentity, launchSocialKit } from "../src/lib/launchpad";

describe("league launch starter materials", () => {
  it("creates safe, bounded, distinct handle ideas", () => {
    const ideas = launchIdentity("Étoiles du Nord Youth Basketball & Friends");
    expect(ideas.handles.length).toBeGreaterThan(0);
    expect(new Set(ideas.handles).size).toBe(ideas.handles.length);
    for (const handle of ideas.handles) {
      expect(handle.length).toBeLessThanOrEqual(30);
      expect(handle).toMatch(/^[a-z0-9]+$/);
    }
    expect(ideas.domains).toContain("etoilesdunordyouthbasketb.com");
  });

  it("uses neutral defaults when league name is not alphanumeric", () => {
    const ideas = launchIdentity("🏀🏀");
    expect(ideas.handles[0]).toBe("basketballleague");
  });

  it("does not invent registration or available-name claims", () => {
    const kit = launchSocialKit(
      "Northstar Youth League",
      "Winter 2027",
      ["U12 Competitive"],
      "https://example.test/league/league-id/website",
    );
    expect(kit.bio).toContain("Northstar Youth League");
    expect(kit.posts).toHaveLength(3);
    expect(kit.posts[1].copy).toContain("U12 Competitive");
    expect(kit.posts[2].copy).toContain("Registration may not yet be open");
  });
});
