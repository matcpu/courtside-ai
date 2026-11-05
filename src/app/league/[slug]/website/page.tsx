import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { standings, type Snapshot } from "@/lib/domain";
import { db } from "@/lib/server";
import { LeagueWebsite as ConfiguredWebsite } from "@/components/league-website";
import { LeagueConnections } from "@/components/league-connections";
import type { SiteData } from "@/lib/launchpad";
import "./website.css";

export const dynamic = "force-dynamic";

export default async function LeagueWebsite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (process.env.ORGANIZER_SETUP_ENABLED === "true") {
    const { data, error } = await db().rpc("public_launch_site", {
      p_slug: slug,
    });
    if (!error && data) return <ConfiguredWebsite data={data as SiteData} />;
  }
  // Public data comes exclusively from the existing redacted, approved-league
  // database snapshot. No authenticated session or service key is used here.
  const client = db();
  const { data: directory, error: directoryError } =
    await client.rpc("public_leagues");
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
  const {
    league: details,
    teams,
    divisions,
    courts,
    fixtures,
    games,
  } = snapshot;
  const approvedTeams = teams.filter((team) => team.status === "approved");
  const teamNames = new Map(approvedTeams.map((team) => [team.id, team.name]));
  const courtNames = new Map(courts.map((court) => [court.id, court.venue]));
  const officialGames = games.filter((game) => game.status === "confirmed");
  const results = standings(approvedTeams, officialGames);
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
    <div className="launchpad-legacy-site">
      <header className="launchpad-legacy-site-header">
        <Link className="site-back-link" href="/">
          ← Back to Courtside AI
        </Link>
        <Link
          href={`/league/${slug}/website`}
          className="launchpad-legacy-site-brand"
        >
          <span className="launchpad-legacy-site-emblem">
            <Trophy size={21} />
          </span>
          <span>
            {details.name}
            <small>{details.season_name}</small>
          </span>
        </Link>
        <nav aria-label="Public league website">
          <a href="#divisions">Divisions</a>
          <a href="#schedule">Schedule</a>
          <a href="#standings">Standings</a>
          <Link
            href={`/league/${slug}`}
            className="launchpad-legacy-site-nav-action"
          >
            League portal <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="launchpad-legacy-site-hero">
          <div className="launchpad-legacy-site-hero-copy">
            <span className="launchpad-legacy-site-eyebrow">
              A SEASON BUILT FOR THE GAME
            </span>
            <h1>{details.name}</h1>
            <p>
              Find your division, follow the schedule and check confirmed
              results—all in one place.
            </p>
            <div className="launchpad-legacy-site-hero-actions">
              <Link
                href={`/league/${slug}`}
                className="launchpad-legacy-site-primary-action"
              >
                Register or sign in <ArrowRight size={17} />
              </Link>
              <a
                href="#schedule"
                className="launchpad-legacy-site-secondary-action"
              >
                See the schedule
              </a>
            </div>
            <p className="launchpad-legacy-site-help">
              Team registration is managed through the secure COURTSIDE portal.
            </p>
          </div>
          <div className="launchpad-legacy-site-court" aria-hidden="true">
            <div className="launchpad-legacy-site-court-circle" />
            <span>THE NEXT GAME STARTS HERE.</span>
          </div>
        </section>
        <section
          className="launchpad-legacy-site-stats"
          aria-label="League summary"
        >
          <div>
            <Users size={22} />
            <strong>{approvedTeams.length}</strong>
            <span>Approved teams</span>
          </div>
          <div>
            <Trophy size={22} />
            <strong>{divisions.length}</strong>
            <span>Divisions</span>
          </div>
          <div>
            <MapPin size={22} />
            <strong>{courts.length}</strong>
            <span>Courts</span>
          </div>
          <div>
            <CalendarDays size={22} />
            <strong>{officialGames.length}</strong>
            <span>Official results</span>
          </div>
        </section>
        <section className="launchpad-legacy-site-section" id="divisions">
          <div className="launchpad-legacy-site-section-heading">
            <span className="launchpad-legacy-site-eyebrow">COMPETITION</span>
            <h2>Find your division.</h2>
            <p>Teams and divisions are shown only after league approval.</p>
          </div>
          <div className="launchpad-legacy-site-divisions">
            {divisions.map((division) => (
              <article
                key={division.id}
                className="launchpad-legacy-site-division"
              >
                <span>DIVISION {division.tier}</span>
                <h3>{division.name}</h3>
                <p>
                  {
                    approvedTeams.filter(
                      (team) => team.division_id === division.id,
                    ).length
                  }{" "}
                  approved teams
                </p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="launchpad-legacy-site-section launchpad-legacy-site-muted"
          id="schedule"
        >
          <div className="launchpad-legacy-site-section-heading">
            <span className="launchpad-legacy-site-eyebrow">UPCOMING</span>
            <h2>Next on the court.</h2>
            <p>Only fixtures from the published schedule appear here.</p>
          </div>
          {upcoming.length ? (
            <div className="launchpad-legacy-site-match-list">
              {upcoming.map((fixture) => (
                <article
                  key={fixture.id ?? fixture.game_id}
                  className="launchpad-legacy-site-match"
                >
                  <div>
                    <strong>
                      {teamNames.get(fixture.home_team_id) ?? "Team"} vs.{" "}
                      {teamNames.get(fixture.away_team_id) ?? "Team"}
                    </strong>
                    <span>
                      {courtNames.get(fixture.court_id) ??
                        "Venue to be confirmed"}
                    </span>
                  </div>
                  <time dateTime={fixture.starts_at}>
                    {formatDate(fixture.starts_at)}
                  </time>
                </article>
              ))}
            </div>
          ) : (
            <p className="launchpad-legacy-site-empty">
              No future fixtures are published yet. Check back for the next
              round.
            </p>
          )}
        </section>
        <section className="launchpad-legacy-site-section" id="standings">
          <div className="launchpad-legacy-site-section-heading">
            <span className="launchpad-legacy-site-eyebrow">
              THE SEASON SO FAR
            </span>
            <h2>Every result counts.</h2>
            <p>Standings reflect confirmed results only.</p>
          </div>
          {results.length ? (
            <div className="launchpad-legacy-site-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">P</th>
                    <th scope="col">W</th>
                    <th scope="col">L</th>
                    <th scope="col">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.team.id}>
                      <th scope="row">{row.team.name}</th>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td>{row.for}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="launchpad-legacy-site-empty">
              Standings will appear after the first official results.
            </p>
          )}
        </section>
      </main>
      <footer className="launchpad-legacy-site-footer">
        <div>
          <strong>{details.name}</strong>
          <span>{details.season_name}</span>
        </div>
        <LeagueConnections leagueId={details.id} />
      </footer>
    </div>
  );
}
