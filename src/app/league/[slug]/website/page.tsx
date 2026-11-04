import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { standings, type Snapshot } from "@/lib/domain";
import { db } from "@/lib/server";
import "./website.css";

export const dynamic = "force-dynamic";

export default async function LeagueWebsite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Public data comes exclusively from the existing redacted, approved-league
  // database snapshot. No authenticated session or service key is used here.
  const client = db();
  const { data: directory, error: directoryError } = await client.rpc(
    "public_leagues",
  );
  if (directoryError) notFound();
  const league = (directory as { id: string; slug: string }[]).find(
    (entry) => entry.slug === slug,
  );
  if (!league) notFound();
  const { data, error } = await client.rpc("league_snapshot", {
    p_league: league.id,
    p_public: true,
  });
  if (error || !data) notFound();
  const snapshot = data as Snapshot;
  const { league: details, teams, divisions, courts, fixtures, games } =
    snapshot;
  const approvedTeams = teams.filter((team) => team.status === "approved");
  const teamNames = new Map(approvedTeams.map((team) => [team.id, team.name]));
  const courtNames = new Map(courts.map((court) => [court.id, court.venue]));
  const officialGames = games.filter((game) => game.status === "confirmed");
  const results = standings(approvedTeams, officialGames).sort(
    (a, b) => b.wins - a.wins || b.points - a.points || b.for - a.for,
  );
  const upcoming = fixtures
    .filter((fixture) => new Date(fixture.starts_at) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    .slice(0, 6);
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: details.timezone,
    }).format(new Date(date));

  return (
    <div className="league-website">
      <header className="league-website-header">
        <Link href={`/league/${slug}/website`} className="league-website-brand">
          <span className="league-website-emblem"><Trophy size={21} /></span>
          <span>{details.name}<small>{details.season_name}</small></span>
        </Link>
        <nav aria-label="Public league website">
          <a href="#divisions">Divisions</a>
          <a href="#schedule">Schedule</a>
          <a href="#standings">Standings</a>
          <Link href={`/league/${slug}`} className="league-website-nav-action">
            League portal <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="league-website-hero">
          <div className="league-website-hero-copy">
            <span className="league-website-eyebrow">A SEASON BUILT FOR THE GAME</span>
            <h1>{details.name}</h1>
            <p>
              Find your division, follow the schedule and check confirmed
              results—all in one place.
            </p>
            <div className="league-website-hero-actions">
              <Link href={`/league/${slug}`} className="league-website-primary-action">
                Register or sign in <ArrowRight size={17} />
              </Link>
              <a href="#schedule" className="league-website-secondary-action">
                See the schedule
              </a>
            </div>
            <p className="league-website-help">
              Team registration is managed through the secure COURTSIDE portal.
            </p>
          </div>
          <div className="league-website-court" aria-hidden="true">
            <div className="league-website-court-circle" />
            <span>THE NEXT GAME STARTS HERE.</span>
          </div>
        </section>
        <section className="league-website-stats" aria-label="League summary">
          <div><Users size={22} /><strong>{approvedTeams.length}</strong><span>Approved teams</span></div>
          <div><Trophy size={22} /><strong>{divisions.length}</strong><span>Divisions</span></div>
          <div><MapPin size={22} /><strong>{courts.length}</strong><span>Courts</span></div>
          <div><CalendarDays size={22} /><strong>{officialGames.length}</strong><span>Official results</span></div>
        </section>
        <section className="league-website-section" id="divisions">
          <div className="league-website-section-heading">
            <span className="league-website-eyebrow">COMPETITION</span>
            <h2>Find your division.</h2>
            <p>Teams and divisions are shown only after league approval.</p>
          </div>
          <div className="league-website-divisions">
            {divisions.map((division) => (
              <article key={division.id} className="league-website-division">
                <span>DIVISION {division.tier}</span>
                <h3>{division.name}</h3>
                <p>{approvedTeams.filter((team) => team.division_id === division.id).length} approved teams</p>
              </article>
            ))}
          </div>
        </section>
        <section className="league-website-section league-website-muted" id="schedule">
          <div className="league-website-section-heading">
            <span className="league-website-eyebrow">UPCOMING</span>
            <h2>Next on the court.</h2>
            <p>Only fixtures from the published schedule appear here.</p>
          </div>
          {upcoming.length ? (
            <div className="league-website-match-list">
              {upcoming.map((fixture) => (
                <article key={fixture.id ?? fixture.game_id} className="league-website-match">
                  <div><strong>{teamNames.get(fixture.home_team_id) ?? "Team"} vs. {teamNames.get(fixture.away_team_id) ?? "Team"}</strong><span>{courtNames.get(fixture.court_id) ?? "Venue to be confirmed"}</span></div>
                  <time dateTime={fixture.starts_at}>{formatDate(fixture.starts_at)}</time>
                </article>
              ))}
            </div>
          ) : <p className="league-website-empty">No future fixtures are published yet. Check back for the next round.</p>}
        </section>
        <section className="league-website-section" id="standings">
          <div className="league-website-section-heading">
            <span className="league-website-eyebrow">THE SEASON SO FAR</span>
            <h2>Every result counts.</h2>
            <p>Standings reflect confirmed results only.</p>
          </div>
          {results.length ? (
            <div className="league-website-table-wrap">
              <table>
                <thead><tr><th scope="col">Team</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">PF</th></tr></thead>
                <tbody>{results.map((row) => <tr key={row.team.id}><th scope="row">{row.team.name}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.for}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="league-website-empty">Standings will appear after the first official results.</p>}
        </section>
      </main>
      <footer className="league-website-footer">
        <div><strong>{details.name}</strong><span>{details.season_name}</span></div>
        <p>Powered by COURTSIDE AI · Public league information only</p>
      </footer>
    </div>
  );
}
