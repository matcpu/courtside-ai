import type { CSSProperties } from "react";
import type { SiteData } from "@/lib/launchpad";
export function colourText(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}
export function LeagueWebsite({
  data,
  preview = false,
}: {
  data: SiteData;
  preview?: boolean;
}) {
  const { config: c, league: l } = data;
  const stamp = (v: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: l.timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(v));
  const open =
    l.registration === "open" && +new Date(l.registrationDeadline) > Date.now();
  const groups = [...new Set(data.divisions.map((d) => d.age_category))];
  const style = {
    "--site-brand": c.colour,
    "--site-accent": c.accent,
    "--site-brand-text": colourText(c.colour),
    "--site-accent-text": colourText(c.accent),
  } as CSSProperties;
  return (
    <main className={`league-website site-${c.theme}`} style={style}>
      <a href="#site-main" className="site-skip">
        Skip to league information
      </a>
      {preview && (
        <div className="site-preview-banner">
          PRIVATE PREVIEW · Draft copy · No website publication or messages
        </div>
      )}
      <header className="site-header">
        <a className="site-brand" href="#home">
          {c.logo ? (
            <img src={c.logo} alt={`${l.name} logo`} width={52} height={52} />
          ) : (
            <span className="site-monogram" aria-hidden="true">
              {l.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span>
            {l.name}
            <small>{l.season}</small>
          </span>
        </a>
        <nav aria-label="League website">
          <a href="#about">About</a>
          <a href="#divisions">Divisions</a>
          <a href="#schedule">Schedule</a>
          <a href="#standings">Standings</a>
          <a href="#venues">Venues</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>
      <section id="home" className="site-hero">
        <div>
          <span className="site-eyebrow">
            YOUTH BASKETBALL · {[l.city, l.region].filter(Boolean).join(", ")}
          </span>
          <h1>{c.headline || l.name}</h1>
          <p>
            {l.name} · {l.season}. Find your competition, prepare your team and
            follow the season.
          </p>
          <a className="site-cta" href="#registration">
            {open ? "Register your team" : "Explore the season"}{" "}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="site-court-art" aria-hidden="true">
          <span />
          <b>
            {groups.length}
            <small>AGE {groups.length === 1 ? "GROUP" : "GROUPS"}</small>
          </b>
        </div>
      </section>
      <div id="site-main" className="site-content">
        <section id="about" className="site-section site-about">
          <div>
            <span className="site-eyebrow">BELONG ON COURT</span>
            <h2>
              Built around the game.
              <br />
              Rooted in the community.
            </h2>
          </div>
          <div>
            <p className="site-copy">
              {c.about ||
                `${l.name} brings youth basketball teams together in ${l.city || "our community"}. Explore the configured divisions and eligibility requirements before registering.`}
            </p>
            <dl className="site-facts">
              <div>
                <dt>Season</dt>
                <dd>
                  {l.start || "To be announced"} — {l.end || "To be announced"}
                </dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>
                  {[l.city, l.region, l.country].filter(Boolean).join(", ") ||
                    "To be confirmed"}
                </dd>
              </div>
              <div>
                <dt>Registered, approved teams</dt>
                <dd>{data.teams.length}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section id="divisions" className="site-section">
          <span className="site-eyebrow">FIND YOUR COMPETITION</span>
          <h2>Age groups & divisions</h2>
          <div className="site-division-grid">
            {groups.map((group) => (
              <article key={group}>
                <span className="site-number">{group}</span>
                <h3>{group} competition</h3>
                <ul>
                  {data.divisions
                    .filter((d) => d.age_category === group)
                    .map((d) => (
                      <li key={`${group}-${d.tier}`}>
                        <strong>{d.name}</strong>
                        <span>
                          Ages {d.min_age}–{d.max_age} on {l.cutoff}
                        </span>
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section id="registration" className="site-registration">
          <div>
            <span className="site-eyebrow">YOUR SEASON STARTS HERE</span>
            <h2>
              {open ? "Bring your team." : "Registration is being prepared."}
            </h2>
            <p>
              {open
                ? `Coach questionnaires are accepted until ${stamp(l.registrationDeadline)} (${l.timezone}). Teams remain subject to league placement and eligibility review.`
                : "The league will announce registration when it is ready. Saving or publishing this website does not open registration."}
            </p>
          </div>
          {open && !preview ? (
            <a className="site-cta" href={`/league/${l.slug}/register`}>
              Start team registration ↗
            </a>
          ) : (
            <span className="site-status">
              {open
                ? "Registration open · preview only"
                : "Registration closed"}
            </span>
          )}
        </section>
        <section id="schedule" className="site-section">
          <span className="site-eyebrow">ON COURT</span>
          <h2>Approved schedule & results</h2>
          <p className="site-muted">
            {l.timezone} · Only published fixtures and confirmed results appear
            here.
          </p>
          {data.fixtures.length ? (
            <div className="site-fixtures">
              {data.fixtures.map((f, i) => (
                <article key={`${f.starts_at}-${i}`}>
                  <time dateTime={f.starts_at}>{stamp(f.starts_at)}</time>
                  <div>
                    <strong>{f.home}</strong>
                    <span>
                      {f.status === "confirmed"
                        ? `${f.home_score} — ${f.away_score}`
                        : "vs"}
                    </span>
                    <strong>{f.away}</strong>
                  </div>
                  <small>
                    {f.court} · {f.venue}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="site-empty">
              The league has not published a schedule yet. Draft fixtures remain
              private.
            </p>
          )}
        </section>
        <section id="standings" className="site-section">
          <span className="site-eyebrow">THE SEASON SO FAR</span>
          <h2>Official standings</h2>
          {data.standings.length ? (
            <div className="site-table-wrap">
              <table>
                <caption>Approved teams · confirmed results only</caption>
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Played</th>
                    <th scope="col">W</th>
                    <th scope="col">L</th>
                    <th scope="col">D</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((t) => (
                    <tr key={t.name}>
                      <th scope="row">{t.name}</th>
                      <td>{t.played}</td>
                      <td>{t.wins}</td>
                      <td>{t.losses}</td>
                      <td>{t.draws}</td>
                      <td>{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="site-empty">
              Standings will appear as teams are approved and official results
              are confirmed.
            </p>
          )}
        </section>
        <section id="venues" className="site-section">
          <span className="site-eyebrow">WHERE WE PLAY</span>
          <h2>Venues & locations</h2>
          {data.venues.length ? (
            <div className="site-venue-grid">
              {data.venues.map((v) => (
                <article key={v.name}>
                  <span aria-hidden="true">↗</span>
                  <h3>{v.name}</h3>
                  <p>{v.venue}</p>
                  <small>
                    Check the published schedule for confirmed game times.
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="site-empty">
              Venues and confirmed availability are still being arranged.
            </p>
          )}
        </section>
        <section id="rules" className="site-section site-rules">
          <div>
            <span className="site-eyebrow">FAIR PLAY, FROM DAY ONE</span>
            <h2>Rules & eligibility</h2>
            <p className="site-copy">
              {c.rules ||
                "Coaches submit team assessments. Guardians provide proof of age privately. Authorized league reviewers inspect documents and make eligibility decisions before teams become ready for scheduling."}
            </p>
          </div>
          <ul>
            <li>
              Age is calculated on {l.cutoff} using the division ranges above.
            </li>
            <li>
              Active rosters: {l.minRoster}–{l.maxRoster} players; guardian
              consent and human document review required.
            </li>
            <li>
              Only league-approved results and schedule changes become official.
            </li>
            <li>
              Never send children’s identity documents through public contact
              channels.
            </li>
          </ul>
        </section>
        <section id="contact" className="site-section site-contact">
          <div>
            <span className="site-eyebrow">LET’S PLAY</span>
            <h2>Talk to the league.</h2>
            <p>Questions about registration, divisions or your next game?</p>
          </div>
          {c.contactEmail ? (
            <a
              className="site-cta"
              href={`mailto:${encodeURIComponent(c.contactEmail)}`}
            >
              Email the league ↗
            </a>
          ) : (
            <p>
              Public contact details have not been published. Existing teams can
              contact their league administrator privately.
            </p>
          )}
        </section>
      </div>
      <footer className="site-footer">
        <strong>{l.name}</strong>
        <p>{l.season} · Powered by COURTSIDE AI</p>
        <a href="#home">Back to top ↑</a>
      </footer>
    </main>
  );
}
