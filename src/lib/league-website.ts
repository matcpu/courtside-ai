import type { SiteData } from "./launchpad";
export type PublicFixture = SiteData["fixtures"][number];
export type FixtureState = "upcoming" | "final" | "pending";
/** Legacy synthetic annotation moves to the visible page disclosure, never real venue names. */
export function publicVenueName(venue: string, demo: boolean) {
  if (!demo) return venue;
  return venue.replace(/\s*·\s*Fictional venue\s*$/i, "").trim() || venue;
}
export function fixtureState(
  fixture: PublicFixture,
  now: number,
): FixtureState {
  if (fixture.status === "confirmed") {
    return fixture.home_score !== null && fixture.away_score !== null
      ? "final"
      : "pending";
  }
  const start = +new Date(fixture.starts_at);
  return Number.isFinite(start) && start >= now ? "upcoming" : "pending";
}
/** Presentation only: never changes an official score, standing or fixture. */
export function gameCentre(fixtures: PublicFixture[], now: number) {
  const upcoming = fixtures
    .filter((f) => fixtureState(f, now) === "upcoming")
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const final = fixtures
    .filter((f) => fixtureState(f, now) === "final")
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  const pending = fixtures
    .filter((f) => fixtureState(f, now) === "pending")
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  const ordered = [...upcoming, ...final, ...pending];
  const selected = new Set([...upcoming.slice(0, 2), ...final.slice(0, 2)]);
  for (const fixture of ordered) {
    if (selected.size >= 4) break;
    selected.add(fixture);
  }
  return {
    upcoming,
    final,
    pending,
    ordered,
    featured: ordered.filter((f) => selected.has(f)),
  };
}
export function leagueInitials(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toLocaleUpperCase("en-CA") || "L"
  );
}
