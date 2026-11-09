import { leagueSport } from "@/lib/sports";
import type { CSSProperties } from "react";
import { LeagueConnections } from "./league-connections";
import { emptyWebsite, formatLeagueDate, type SiteData } from "@/lib/launchpad";
import {
  fixtureState,
  gameCentre,
  leagueInitials,
  publicVenueName,
  type PublicFixture,
} from "@/lib/league-website";

export function colourText(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}
function BasketballDetail() {
  return (
    <svg
      className="site-basketball-detail"
      viewBox="0 0 360 200"
      fill="none"
      aria-hidden="true"
    >
      <path d="M-10 196a190 190 0 0 1 380 0v4H-10Z" fill="currentColor" />
      <g stroke="var(--site-paper)" strokeWidth="3">
        <path d="M180 8v192M-8 196h376M22 90c90 80 226 80 316 0M68 36c14 74 18 113-14 164M292 36c-14 74-18 113 14 164" />
      </g>
    </svg>
  );
}
export function LeagueWebsite({
  data,
  preview = false,
}: {
  data: SiteData;
  preview?: boolean;
}) {
  const { config: c, league: l } = data,
    Root = preview ? "div" : "main";
  const { sport, profile } = leagueSport(l);
  const headline = c.headline === emptyWebsite.headline ? "" : c.headline;
  const open =
    l.registration === "open" && +new Date(l.registrationDeadline) > Date.now();
  const registrationStatus = open ? "Registration open" : "Registration closed";
  const location = [
    ...new Set([l.city, l.region, l.country].filter(Boolean)),
  ].join(", ");
  const groups = [...new Set(data.divisions.map((d) => d.age_category))];
  const venues = [...new Set(data.venues.map((v) => v.venue))].map((venue) => ({
    venue,
    courts: data.venues.filter((v) => v.venue === venue),
  }));
  const now = Date.now(),
    games = gameCentre(data.fixtures, now),
    hasFixtures = games.ordered.length > 0;
  const hasStandings = data.standings.some((t) => t.played > 0);
  const demo = /synthetic|fictional/i.test(`${l.name} ${l.season} ${c.about}`);
  const stamp = (v: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: l.timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(v));
  const matchDate = (v: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: l.timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(v));
  const matchTime = (v: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: l.timezone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(v));
  const style = {
    "--site-brand": c.colour,
    "--site-accent": c.accent,
    "--site-brand-text": colourText(c.colour),
    "--site-accent-text": colourText(c.accent),
  } as CSSProperties;
  const emblem = c.logo ? (
    <img src={c.logo} alt={`${l.name} logo`} width={64} height={64} />
  ) : (
    <span className="site-monogram" aria-hidden="true">
      {leagueInitials(l.name)}
    </span>
  );
  const action = (
    <a
      className="site-cta"
      href={
        open ? "#registration" : hasFixtures ? "#schedule" : "#registration"
      }
    >
      {open
        ? "Register your team"
        : hasFixtures
          ? "Explore the games"
          : "Registration details"}
      <span aria-hidden="true">↗</span>
    </a>
  );
  const dates = (
    <>
      {formatLeagueDate(l.start)} <span aria-hidden="true">–</span>{" "}
      {formatLeagueDate(l.end)}
    </>
  );
  const seasonCard = (
    <aside className="site-season-card" aria-label="Season at a glance">
      <div className="site-season-heading">
        <span className="site-eyebrow">Season guide</span>
        <span className="site-season-sport">{profile.name}</span>
      </div>
      <h2>{l.season}</h2>
      <dl>
        <div>
          <dt>Season dates</dt>
          <dd>{dates}</dd>
        </div>
        {location && (
          <div>
            <dt>Home base</dt>
            <dd>{location}</dd>
          </div>
        )}
        <div>
          <dt>Team registration</dt>
          <dd className="site-registration-state">{registrationStatus}</dd>
        </div>
      </dl>
      {sport === "basketball" && c.theme === "community" && (
        <BasketballDetail />
      )}
    </aside>
  );
  const divisions = data.divisions.length > 0 && (
    <section id="divisions" className="site-section site-divisions">
      <div className="site-section-heading">
        <div>
          <span className="site-eyebrow">The competition</span>
          <h2>Find your division.</h2>
        </div>
        <a href="#rules" className="site-text-link">
          Age eligibility ↗
        </a>
      </div>
      <div className="site-division-grid">
        {groups.map((group) => (
          <article key={group}>
            <div className="site-division-title">
              <span className="site-group">{group}</span>
              <span>{profile.name}</span>
            </div>
            <ul>
              {data.divisions
                .filter((d) => d.age_category === group)
                .map((d) => (
                  <li key={`${group}-${d.tier}`}>
                    <h3>{d.name}</h3>
                    <p>
                      Ages {d.min_age}–{d.max_age}
                    </p>
                  </li>
                ))}
            </ul>
            <p className="site-division-cutoff">
              Age on {formatLeagueDate(l.cutoff)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
  const registration = (
    <section id="registration" className="site-registration">
      <div>
        <span className="site-eyebrow">{l.season} registration</span>
        <h2>
          {open
            ? `Bring your team to the ${profile.facility}.`
            : "Follow the season."}
        </h2>
        <p>
          {open
            ? `Team registration closes ${stamp(l.registrationDeadline)}. Review divisions and eligibility before applying.`
            : `Registration for ${l.season} is currently closed.`}
        </p>
        <a href="#rules" className="site-text-link">
          Rules & eligibility ↗
        </a>
      </div>
      {open && !preview ? (
        <a className="site-cta" href={`/league/${l.slug}/register`}>
          Start team registration <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span className="site-status">
          {open ? "Registration open · private preview" : registrationStatus}
        </span>
      )}
    </section>
  );
  const fixtureCard = (f: PublicFixture, i: number) => {
    const state = fixtureState(f, now),
      final = state === "final";
    return (
      <article
        key={`${f.starts_at}-${i}`}
        className={`site-game site-game-${state}`}
        data-fixture-state={state}
      >
        <div className="site-game-heading">
          <span className={`site-game-status status-${state}`}>
            {final
              ? `Final${f.decision === "overtime" ? " · OT" : f.decision === "shootout" ? " · SO" : ""}`
              : state === "upcoming"
                ? "Upcoming"
                : "Result pending"}
          </span>
          <time dateTime={f.starts_at}>{matchDate(f.starts_at)}</time>
        </div>
        <div
          className="site-matchup"
          role="group"
          aria-label={`${f.home} vs ${f.away}${final ? `: ${f.home_score} – ${f.away_score}` : ""}`}
        >
          <div>
            <strong>{f.home}</strong>
            <span className="site-score">{final ? f.home_score : "—"}</span>
          </div>
          <div>
            <strong>{f.away}</strong>
            <span className="site-score">{final ? f.away_score : "—"}</span>
          </div>
        </div>
        <div className="site-game-footer">
          <span>{matchTime(f.starts_at)}</span>
          <p>
            {[f.court, publicVenueName(f.venue, demo)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </article>
    );
  };
  const fixtures = hasFixtures && (
    <section id="schedule" className="site-section site-schedule">
      <div className="site-section-heading">
        <div>
          <span className="site-eyebrow">Around the league</span>
          <h2>
            {c.theme === "courtside"
              ? "Game centre."
              : `On the ${profile.facility}.`}
          </h2>
        </div>
        <p>
          {games.upcoming.length > 0 && (
            <span>{games.upcoming.length} upcoming</span>
          )}
          {games.final.length > 0 && <span>{games.final.length} final</span>}
          {games.pending.length > 0 && (
            <span>
              {games.pending.length} result
              {games.pending.length === 1 ? "" : "s"} pending
            </span>
          )}
        </p>
      </div>
      <div className="site-featured-games">
        {games.featured.map(fixtureCard)}
      </div>
      <details className="site-all-games">
        <summary>
          All {games.ordered.length} fixtures & results{" "}
          <span aria-hidden="true">↗</span>
        </summary>
        <p className="site-archive-note">
          Published fixtures · Times in {l.timezone}. Past unconfirmed games
          remain result pending.
        </p>
        <div className="site-fixtures">{games.ordered.map(fixtureCard)}</div>
      </details>
    </section>
  );
  const standingsTable = (compact: boolean) => (
    <div
      className="site-table-wrap"
      role="region"
      aria-label={compact ? "Standings snapshot" : "Complete standings table"}
      tabIndex={0}
    >
      <table>
        <caption>
          {compact
            ? `League snapshot · ${Math.min(6, data.standings.length)} of ${data.standings.length} teams`
            : "League-approved teams · Confirmed results only"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            {!compact && <th scope="col">Played</th>}
            <th scope="col">W</th>
            <th scope="col">L (all)</th>
            {sport === "hockey" && <th scope="col">OT/SO L</th>}
            {!compact && <th scope="col">D</th>}
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {(compact ? data.standings.slice(0, 6) : data.standings).map((t) => (
            <tr key={t.name}>
              <th scope="row">{t.name}</th>
              {!compact && <td>{t.played}</td>}
              <td>{t.wins}</td>
              <td>{t.losses}</td>
              {sport === "hockey" && <td>{t.overtimeLosses ?? 0}</td>}
              {!compact && <td>{t.draws}</td>}
              <td>
                <b>{t.points}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const table = hasStandings && (
    <section id="standings" className="site-section site-standings">
      <div className="site-section-heading">
        <div>
          <span className="site-eyebrow">The season so far</span>
          <h2>Standings.</h2>
        </div>
      </div>
      {standingsTable(true)}
      <details className="site-all-standings">
        <summary>Full standings · {data.standings.length} teams</summary>
        {standingsTable(false)}
      </details>
    </section>
  );
  const places = venues.length > 0 && (
    <section id="venues" className="site-section site-venues">
      <div className="site-section-heading">
        <div>
          <span className="site-eyebrow">Home {profile.facility}s</span>
          <h2>Where we play.</h2>
        </div>
        <p>
          {venues.length} {venues.length === 1 ? "venue" : "venues"} ·{" "}
          {data.venues.length}{" "}
          {data.venues.length === 1 ? profile.facility : `${profile.facility}s`}
        </p>
      </div>
      <div className="site-venue-grid">
        {venues.map(({ venue, courts }) => (
          <article key={venue}>
            <h3>{publicVenueName(venue, demo)}</h3>
            <p>{courts.map((v) => v.name).join(" · ")}</p>
            <small>Game times appear in published fixtures.</small>
          </article>
        ))}
      </div>
    </section>
  );
  const about = c.about && (
    <section id="about" className="site-section site-about">
      <span className="site-eyebrow">Our league</span>
      <h2>
        {profile.name}
        {l.city ? ` in ${l.city}` : ""}.
      </h2>
      <p>{c.about}</p>
    </section>
  );
  const sections =
    c.theme === "community"
      ? [about, divisions, fixtures, table, places, registration]
      : c.theme === "arena"
        ? [fixtures, divisions, registration, table, places, about]
        : [fixtures, table, divisions, places, registration, about];
  const navigation = [
    ...(c.theme === "courtside"
      ? [
          ["schedule", "Games", hasFixtures],
          ["standings", "Standings", hasStandings],
          ["divisions", "Divisions", data.divisions.length > 0],
        ]
      : [
          ["divisions", "Divisions", data.divisions.length > 0],
          ["schedule", "Games", hasFixtures],
          ["standings", "Standings", hasStandings],
        ]),
    ["venues", "Venues", venues.length > 0],
    ["rules", "Rules", true],
    ["contact", "Contact", Boolean(c.contactEmail)],
  ] as [string, string, boolean][];
  return (
    <Root className={`league-website site-${c.theme}`} style={style}>
      <a href="#site-main" className="site-skip">
        Skip to league information
      </a>
      {preview && (
        <div className="site-preview-banner">
          Private preview · Unsaved changes are not public
        </div>
      )}
      <header className="site-header">
        <a
          className="site-back-link"
          href="/"
          target={preview ? "_blank" : undefined}
          rel={preview ? "noreferrer" : undefined}
        >
          ← Back to Courtside AI
        </a>
        <a className="site-brand" href="#home">
          {emblem}
          <span>
            {l.name}
            <small>
              {l.season} · {profile.name}
            </small>
          </span>
        </a>
        <nav aria-label="League website">
          <LeagueConnections leagueId={l.id} header preview={preview} />
          {navigation
            .filter(([, , visible]) => visible)
            .map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          <a className="site-nav-registration" href="#registration">
            Registration <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      {demo && (
        <aside
          className="site-demo-disclosure"
          aria-label="Demo league disclosure"
        >
          <p>
            <strong>Demo league</strong> · All teams, venues and results are
            fictional.
          </p>
        </aside>
      )}
      <section id="home" className="site-hero">
        <div className="site-hero-identity">
          <p className="site-eyebrow">
            <span className="site-season-tag">{l.season}</span>
            {location && <span>{location}</span>}
          </p>
          <h1>{l.name}</h1>
          {headline && <p className="site-hero-headline">{headline}</p>}
          <div className="site-hero-actions">
            {action}
            <span className="site-hero-registration">{registrationStatus}</span>
          </div>
        </div>
        {seasonCard}
      </section>
      {c.theme === "arena" && (
        <div className="site-season-line">
          <span>Youth {profile.name.toLowerCase()}</span>
          <span>{l.season}</span>
          {groups.length > 0 && <span>{groups.join(" / ")}</span>}
          {l.city && <span>{l.city}</span>}
        </div>
      )}
      <div id="site-main" className="site-content" tabIndex={-1}>
        {sections.map(
          (section, i) =>
            section && (
              <div className="site-module" key={i}>
                {section}
              </div>
            ),
        )}
        <section id="rules" className="site-section site-rules">
          <details>
            <summary>
              Rules & eligibility{" "}
              <span>Age cutoff · Roster requirements · League rules</span>
            </summary>
            <div className="site-rules-content">
              {c.rules && <p>{c.rules}</p>}
              <ul>
                <li>
                  Age is calculated on {formatLeagueDate(l.cutoff)} using the
                  configured division ranges above.
                </li>
                <li>
                  Active rosters: {l.minRoster}–{l.maxRoster} players. League
                  eligibility approval is required before scheduling.
                </li>
                <li>
                  Submit any required guardian documents privately through your
                  league invitation.
                </li>
              </ul>
            </div>
          </details>
        </section>
        {c.contactEmail && (
          <section id="contact" className="site-section site-contact">
            <div>
              <span className="site-eyebrow">League office</span>
              <h2>Let’s talk {profile.name.toLowerCase()}.</h2>
            </div>
            <a
              className="site-cta"
              href={`mailto:${encodeURIComponent(c.contactEmail)}`}
            >
              Email the league <span aria-hidden="true">↗</span>
            </a>
          </section>
        )}
      </div>
      <footer className="site-footer">
        <div>
          <strong>{l.name}</strong>
          <p>
            {l.season}
            {location && ` · ${location}`}
          </p>
        </div>
        <div>
          {demo && <p>Demonstration league · Synthetic data</p>}
          <LeagueConnections leagueId={l.id} preview={preview} />
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </Root>
  );
}
