"use client";
import { useState } from "react";
import { workspaceHref, type ProductDemo } from "@/lib/product-navigation";
import type { LocalPreviewSession } from "@/lib/local-demo-client";
export type LeagueChoice = {
  id: string;
  name: string;
  slug: string;
  is_demo: boolean;
  season_name?: string;
  role?: string;
};
export function ProductEntry({
  demo,
  signedIn,
  ready,
  leagues,
  denied,
  privateRequest,
  notice,
  onSignIn,
  onCreate,
  onSignOut,
  localPreview,
  onExplore,
}: {
  demo?: ProductDemo | null;
  signedIn: boolean;
  ready: boolean;
  leagues: LeagueChoice[];
  denied: boolean;
  privateRequest: boolean;
  notice?: { text: string; error: boolean } | null;
  onSignIn: () => void;
  onCreate: () => void;
  onSignOut: () => void;
  localPreview?: LocalPreviewSession | null;
  onExplore?: () => void;
}) {
  const [filter, setFilter] = useState("");
  const choices = leagues
    .filter((l) =>
      `${l.name} ${l.season_name ?? ""} ${l.slug}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((a, b) => Number(b.id === demo?.id) - Number(a.id === demo?.id));
  return (
    <div className="product-entry">
      <a className="product-skip" href="#product-main">
        Skip to content
      </a>
      <header className="product-header">
        <a className="product-wordmark" href="/" aria-label="Courtside AI home">
          courtside<span>AI</span>
          <small>League operations, connected.</small>
        </a>
        <nav aria-label="Product navigation">
          {demo && (
            <a
              href={demo.href}
              onClick={(event) => {
                if (
                  onExplore &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  onExplore();
                }
              }}
            >
              Explore demo
            </a>
          )}
          {localPreview ? (
            <a className="product-demo-dashboard" href={localPreview.dashboard}>
              Open demo dashboard ↗
            </a>
          ) : signedIn ? (
            <button onClick={onSignOut}>Sign out</button>
          ) : (
            <button onClick={onSignIn}>Sign in</button>
          )}
          <button className="product-button" onClick={onCreate}>
            Create a league ↗
          </button>
        </nav>
      </header>
      <main id="product-main" className="product-main" tabIndex={-1}>
        {notice && (
          <p
            className={`product-notice ${notice.error ? "product-error" : ""}`}
            role="status"
          >
            {notice.text}
          </p>
        )}
        {denied ? (
          <section className="product-access" role="alert">
            <span className="product-kicker">Private league workspace</span>
            <h1>League access required.</h1>
            <p>
              Your account does not have access to this league. Ask its
              administrator for an invitation, or choose one of your own leagues
              below.
            </p>
          </section>
        ) : privateRequest && !signedIn ? (
          <section className="product-access">
            <span className="product-kicker">Private league workspace</span>
            <h1>Sign in to your league.</h1>
            <p>
              Your league’s management workspace is private. Sign in with an
              authorized account to continue.
            </p>
            <button className="product-button" onClick={onSignIn}>
              Sign in to continue
            </button>
          </section>
        ) : signedIn && !localPreview ? (
          <section className="product-access">
            <span className="product-kicker">Your workspace</span>
            <h1>Choose your league.</h1>
            <p>Open a league you belong to, or create your next season.</p>
          </section>
        ) : (
          <section className="product-hero">
            <div>
              <span className="product-kicker">
                {localPreview
                  ? "Local interactive demo · Synthetic data only"
                  : "Built for the people behind the game"}
              </span>
              <h1>
                Run the league.
                <br />
                Keep the game moving.
              </h1>
              <p>
                Bring team onboarding, fair placement, scheduling and game
                results together. Courtside AI helps with the work; your league
                keeps control of the decisions.
              </p>
              <div className="product-actions">
                {demo && (
                  <a
                    className="product-button"
                    href={demo.href}
                    onClick={(event) => {
                      if (
                        onExplore &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        onExplore();
                      }
                    }}
                  >
                    Explore a working demo league ↗
                  </a>
                )}
                <button className="product-secondary" onClick={onCreate}>
                  Create a league
                </button>
                {!localPreview && demo?.publicDashboard && (
                  <a className="product-secondary" href={demo.publicDashboard}>
                    Open public demo dashboard ↗
                  </a>
                )}
                {localPreview && (
                  <a
                    className="product-secondary"
                    href={localPreview.dashboard}
                  >
                    Open demo dashboard ↗
                  </a>
                )}
              </div>
              <p className="product-fine">
                {localPreview
                  ? "Explore publicly. Manage your league securely."
                  : "Explore the demo without signing in. League setup and management require secure sign-in."}
              </p>
            </div>
            <aside className="product-season">
              <span className="product-kicker">
                From preseason to the final buzzer
              </span>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <h2>Start the season ready.</h2>
                    <p>
                      Coach assessments, guardian verification and
                      league-approved placement.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h2>Keep the fixtures moving.</h2>
                    <p>
                      Court availability, team readiness and approved schedule
                      changes.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h2>Make every result count.</h2>
                    <p>
                      Reviewed scoresheets, official standings and visible AI
                      activity.
                    </p>
                  </div>
                </li>
              </ol>
              {demo && (
                <a className="product-demo-link" href={demo.href}>
                  <span>
                    {demo.name}
                    <small>{demo.season} · Scoreboard demo</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </aside>
          </section>
        )}
        {signedIn && (
          <section className="product-leagues" aria-label="Your leagues">
            {!ready ? (
              <p role="status">Loading your authorized leagues…</p>
            ) : leagues.length ? (
              <>
                <label className="product-search">
                  Find your league
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    type="search"
                    placeholder="League or season name"
                  />
                </label>
                <div className="product-league-grid">
                  {choices.map((l) => (
                    <a
                      key={l.id}
                      className="product-league-card"
                      href={workspaceHref(l.id)}
                    >
                      <span>
                        {l.role === "admin"
                          ? "League organizer"
                          : l.role === "coach"
                            ? "Coach workspace"
                            : "League member"}
                      </span>
                      <h2>{l.name}</h2>
                      <p>{l.season_name ?? "Your league workspace"}</p>
                      {demo?.id === l.id && <b>Scoreboard demo workspace</b>}
                      <small>Open dashboard ↗</small>
                    </a>
                  ))}
                </div>
                {!choices.length && (
                  <p>No matching leagues. Try another name.</p>
                )}
              </>
            ) : (
              <div className="product-empty">
                <h2>No league memberships yet.</h2>
                <p>
                  Accept a league invitation or create a league. Public demo
                  access does not grant administration rights.
                </p>
                <button className="product-button" onClick={onCreate}>
                  Create a league ↗
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="product-footer">
        <strong>Courtside AI</strong>
        <span>
          One league workspace. Human decisions. More time for basketball.
        </span>
      </footer>
    </div>
  );
}
