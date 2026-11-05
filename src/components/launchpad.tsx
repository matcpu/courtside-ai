"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Globe,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { LeagueWebsite } from "./league-website";
import { launchCommand, type LaunchApi } from "./organizer-setup";
import {
  courtCapacity,
  emptyWebsite,
  identityIdeas,
  launchState,
  socialKit,
  type Setup,
  type SetupDraft,
  type SiteData,
  type Website,
} from "@/lib/launchpad";
import type { Snapshot } from "@/lib/domain";
import type { PreseasonData } from "@/lib/preseason";
import { seasonStartInstant } from "@/lib/preseason";
type Workspace = {
  setup: Setup | null;
  setup_revision: number;
  site: Website | null;
  site_revision: number;
  site_published: boolean;
  published_revision: number | null;
  preferred_domain: string | null;
  preseason: PreseasonData;
  invites: {
    id: string;
    email: string;
    role: string;
    team_id: string | null;
    expires_at: string;
    revoked_at: string | null;
    accepted_at: string | null;
  }[];
};
type Props = {
  snapshot: Snapshot;
  api: LaunchApi;
  onChanged: () => Promise<void>;
  onNavigate: (
    view: "Preseason Onboarding" | "Courts & gyms" | "Schedule" | "Settings",
  ) => void;
  onSetup: (draft?: SetupDraft) => void;
};
const tabs = [
  "Launch overview",
  "League website",
  "Brand & domain",
  "Social starter kit",
] as const;
export function Launchpad({
  snapshot: s,
  api,
  onChanged,
  onNavigate,
  onSetup,
}: Props) {
  const league = s.league.id;
  const [w, setW] = useState<Workspace | null>(null),
    [siteData, setSiteData] = useState<SiteData | null>(null),
    [site, setSite] = useState<Website>(emptyWebsite),
    [tab, setTab] = useState<(typeof tabs)[number]>("Launch overview"),
    [width, setWidth] = useState("desktop"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [approved, setApproved] = useState(false);
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("coach"),
    [team, setTeam] = useState(""),
    [invitation, setInvitation] = useState(""),
    [domain, setDomain] = useState(""),
    [lookup, setLookup] = useState<{
      domain: string;
      registered: boolean;
      purchaseAvailability: string;
      checkedAt: string;
      source: string;
      note: string;
    } | null>(null);
  const load = useCallback(
    async (resetSite = false) => {
      const [workspace, preview] = await Promise.all([
        api(`/api/launchpad?league=${league}`),
        launchCommand(api, "site_preview", { league_id: league }),
      ]);
      setW(workspace);
      setSiteData(preview);
      if (resetSite) {
        setSite(workspace.site ?? emptyWebsite);
        setDomain(workspace.preferred_domain ?? "");
      }
    },
    [api, league],
  );
  useEffect(() => {
    let live = true;
    Promise.all([
      api(`/api/launchpad?league=${league}`),
      launchCommand(api, "site_preview", { league_id: league }),
    ])
      .then(([workspace, preview]) => {
        if (live) {
          setW(workspace);
          setSiteData(preview);
          setSite(workspace.site ?? emptyWebsite);
          setDomain(workspace.preferred_domain ?? "");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, league]);
  const act = async (
    fn: () => Promise<any>,
    message: string,
    resetSite = false,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fn();
      await load(resetSite);
      await onChanged();
      setNotice(message);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const cmd = (action: string, p: Record<string, unknown> = {}) =>
    launchCommand(api, action, { league_id: league, ...p });
  const ideas = useMemo(
    () => identityIdeas(s.league.name, w?.setup?.city ?? ""),
    [s.league.name, w?.setup?.city],
  );
  const kit = useMemo(
    () =>
      socialKit(
        s.league.name,
        w?.setup?.city ?? "",
        s.league.season_name,
        w?.preseason.settings.registration_status === "open",
      ),
    [
      s.league.name,
      s.league.season_name,
      w?.setup?.city,
      w?.preseason.settings.registration_status,
    ],
  );
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied privately. Review before sharing or publishing.");
    } catch {
      setError(
        "Clipboard unavailable. Select and copy the displayed text manually.",
      );
    }
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 6000000
    ) {
      setError("Choose a PNG, JPEG or WebP logo below 6 MB.");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 16000000)
          throw Error("Use a logo below 16 megapixels.");
        const canvas = document.createElement("canvas"),
          scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Image preview is unavailable.");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const logo = canvas.toDataURL("image/png");
        if (logo.length > 350000)
          throw Error("Use a simpler logo below 250 KB after resizing.");
        setSite((v) => ({ ...v, logo }));
        setApproved(false);
      } finally {
        bitmap.close();
      }
    } catch (e) {
      setError((e as Error).message || "The logo could not be decoded.");
    } finally {
      setBusy(false);
    }
  };
  const editSetup = async () => {
    const d = await act(
      () => cmd("begin_edit"),
      "Private configuration draft created from current league records.",
    );
    if (d) onSetup(d);
  };
  if (!w)
    return (
      <section className="panel launch-loading">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button
              variant="secondary"
              onClick={() => void load(true).catch((e) => setError(e.message))}
            >
              Retry Launchpad
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" /> Loading your launch workspace…
          </>
        )}
      </section>
    );
  const ready = w.preseason.readiness.filter(
      (r) => r.eligible_for_scheduling,
    ).length,
    pending = w.preseason.players.filter(
      (p) => p.verification_status === "pending",
    ).length;
  const capacity = courtCapacity(
    s.availability.filter((a) => s.courts.some((c) => c.id === a.court_id)),
    Math.max(
      Date.now(),
      w.setup?.opening
        ? +new Date(seasonStartInstant(w.setup.opening, s.league.timezone))
        : Date.now(),
    ),
  );
  const expectedGames = w.setup
    ? Math.ceil((w.setup.expectedTeams * w.setup.gamesPerTeam) / 2)
    : null;
  const activeInvites = w.invites.filter(
    (i) =>
      !i.accepted_at && !i.revoked_at && +new Date(i.expires_at) > Date.now(),
  ).length;
  const dirty = JSON.stringify(site) !== JSON.stringify(w.site ?? emptyWebsite);
  return (
    <div className="launchpad">
      <header className="launch-header">
        <div>
          <span className="launch-eyebrow">COURTSIDE LAUNCHPAD</span>
          <h2>From an idea to opening day.</h2>
          <p>
            {s.league.name} · {s.league.season_name}
            {w.setup?.city ? ` · ${w.setup.city}` : ""}
          </p>
        </div>
        <span className="launch-state">
          {launchState(s, String(w.preseason.settings.registration_status))}
        </span>
      </header>
      <nav className="launch-tabs" aria-label="Launchpad sections">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p className="launch-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="launch-notice" role="status">
          {notice}
        </p>
      )}
      {tab === "Launch overview" && (
        <>
          <div className="launch-metrics">
            <article>
              <span>Registered / expected teams</span>
              <strong>
                {s.teams.length} / {w.setup?.expectedTeams ?? "—"}
              </strong>
              <small>{ready} meet scheduling readiness</small>
            </article>
            <article>
              <span>Private invitations</span>
              <strong>{activeInvites} pending</strong>
              <small>
                {w.invites.filter((i) => i.accepted_at).length} accepted
              </small>
            </article>
            <article>
              <span>Age document review</span>
              <strong>{pending} pending</strong>
              <small>Authorized humans decide eligibility</small>
            </article>
            <article>
              <span>Confirmed court capacity</span>
              <strong>{capacity.slots} slots</strong>
              <small>
                60-minute upper bound · {expectedGames ?? "?"} planned games
              </small>
            </article>
          </div>
          <div className="launch-dashboard-grid">
            <section className="panel launch-checklist">
              <h3>Your next steps</h3>
              {[
                [
                  !!w.setup,
                  "Shape the season",
                  w.setup
                    ? `${w.setup.start} → ${w.setup.end} · ${s.league.timezone}`
                    : "Complete guided setup to save the league identity and plan.",
                  () => void editSetup(),
                ],
                [
                  s.divisions.length > 0,
                  "Review divisions & eligibility",
                  `${s.divisions.length} configured divisions. Age policy and roster rules remain editable.`,
                  () => onNavigate("Preseason Onboarding"),
                ],
                [
                  s.courts.length > 0 && capacity.slots > 0,
                  "Confirm court availability",
                  `${s.courts.length} courts, ${capacity.slots} merged confirmed slots. ${capacity.slots ? "Rest, age groups and readiness may reduce feasible games." : "Add genuine dated availability; a court name is not a booking."}`,
                  () => onNavigate("Courts & gyms"),
                ],
                [
                  w.site_published,
                  "Prepare your league website",
                  w.site_published
                    ? `Published revision ${w.published_revision}. Draft edits remain private until approved.`
                    : w.site_revision > 0
                      ? `Private draft revision ${w.site_revision}. Review before publication.`
                      : "Choose a theme and save public copy privately.",
                  () => setTab("League website"),
                ],
                [
                  w.preseason.settings.registration_status === "open",
                  "Open team registration",
                  "Separate from website publication. No invitations or outgoing messages are sent automatically.",
                  () =>
                    document
                      .getElementById("launch-registration")
                      ?.scrollIntoView({ block: "center" }),
                ],
                [
                  s.teams.length > 0 && ready === s.teams.length,
                  "Resolve team readiness",
                  `${w.preseason.questionnaires.filter((q) => q.status === "submitted").length} questionnaires submitted · ${pending} pending document reviews · ${ready}/${s.teams.length} teams ready.`,
                  () => onNavigate("Preseason Onboarding"),
                ],
                [
                  s.versions.some((v) => v.status === "published"),
                  "Prepare the opening schedule",
                  "Draft first. Deterministic constraints and human publication approval stay in control.",
                  () => onNavigate("Schedule"),
                ],
              ].map(([done, title, detail, action]) => (
                <button key={String(title)} onClick={action as () => void}>
                  <span className={done ? "check-done" : "check-todo"}>
                    {done ? <Check size={17} /> : <ArrowUpRight size={17} />}
                  </span>
                  <span>
                    <strong>{String(title)}</strong>
                    <small>{String(detail)}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </section>
            <div className="launch-side">
              <section className="panel">
                <h3>Launch identity</h3>
                <dl>
                  <div>
                    <dt>Website</dt>
                    <dd>
                      {w.site_published
                        ? "Published"
                        : w.site_revision
                          ? "Private draft"
                          : "Not started"}
                    </dd>
                  </div>
                  <div>
                    <dt>Domain</dt>
                    <dd>
                      {w.preferred_domain
                        ? `${w.preferred_domain} · Suggested / not connected`
                        : "No preferred domain"}
                    </dd>
                  </div>
                  <div>
                    <dt>Social accounts</dt>
                    <dd>Manual setup · no accounts connected</dd>
                  </div>
                </dl>
                <p className="form-note">
                  Suggestions are not registrations or ownership checks. The
                  site works at its existing COURTSIDE URL.
                </p>
              </section>
              <section id="launch-registration" className="panel">
                <h3>Team registration</h3>
                <p>
                  Currently{" "}
                  <strong>
                    {String(w.preseason.settings.registration_status)}
                  </strong>
                  . Eligible teams still need questionnaires, placement, roster
                  and human document review.
                </p>
                <Button
                  disabled={
                    busy ||
                    !w.setup ||
                    w.preseason.settings.registration_status === "open"
                  }
                  onClick={() =>
                    void act(
                      () => cmd("open_registration"),
                      "Registration opened. Website visibility and outgoing messages are unchanged.",
                    )
                  }
                >
                  Open registration
                </Button>
                <button
                  className="text-link"
                  onClick={() => onNavigate("Preseason Onboarding")}
                >
                  Review deadlines / close registration →
                </button>
              </section>
            </div>
          </div>
          <section className="panel launch-invitations">
            <div className="panel-heading">
              <div>
                <h3>Invite your coaches & team staff</h3>
                <p>
                  No account needed yet. They must sign in with the invited,
                  confirmed email to accept. One invitation can assign both
                  league access and an existing team.
                </p>
              </div>
            </div>
            <form
              className="launch-invite-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setInvitation("");
                const r = await act(
                  () =>
                    cmd("invite", {
                      email,
                      role,
                      team_id: role === "coach" ? team || null : null,
                    }),
                  "Private invitation created. No email sent.",
                );
                if (r) setInvitation(window.location.origin + r.invitation);
              }}
            >
              <label className="field">
                <span>Invited email</span>
                <input
                  type="email"
                  required
                  maxLength={150}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>League role</span>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setTeam("");
                  }}
                >
                  <option value="coach">Coach</option>
                  <option value="scorekeeper">Scorekeeper</option>
                  <option value="referee">Referee</option>
                </select>
              </label>
              {role === "coach" && (
                <label className="field">
                  <span>Assign existing team (optional)</span>
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                  >
                    <option value="">Coach will register a team</option>
                    {s.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button disabled={busy}>Create private invitation</Button>
            </form>
            {invitation && (
              <div className="launch-private-link">
                <ShieldCheck size={18} />
                <p>
                  Link ready. Expires in 72 hours. Share privately with the
                  intended person.
                </p>
                <input
                  aria-label="Private member invitation"
                  type="password"
                  readOnly
                  value={invitation}
                />
                <Button
                  variant="secondary"
                  onClick={() => void copyText(invitation)}
                >
                  <Copy size={15} /> Copy private link
                </Button>
              </div>
            )}
            <ul className="launch-invite-list">
              {w.invites.map((i) => (
                <li key={i.id}>
                  <span>
                    <strong>{i.email}</strong>
                    <small>
                      {i.role} ·{" "}
                      {i.accepted_at
                        ? "Accepted"
                        : i.revoked_at
                          ? "Revoked"
                          : +new Date(i.expires_at) <= Date.now()
                            ? "Expired"
                            : `Pending until ${new Date(i.expires_at).toLocaleString()}`}
                    </small>
                  </span>
                  {!i.accepted_at && !i.revoked_at && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setInvitation("");
                        void act(
                          () => cmd("revoke_invite", { id: i.id }),
                          "Invitation revoked.",
                        );
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="form-note">
              Email delivery is not expanded. Copying a private link never sends
              a message.
            </p>
          </section>
        </>
      )}
      {tab === "League website" &&
        (!w.setup ? (
          <section className="panel">
            <h3>Give your website a season to describe.</h3>
            <p>
              Finish league setup first. Existing public reference pages remain
              unchanged.
            </p>
            <Button disabled={busy} onClick={() => void editSetup()}>
              Configure this league
            </Button>
          </section>
        ) : (
          <>
            <div className="website-builder">
              <section className="panel site-editor">
                <h3>Your public identity</h3>
                <p>
                  Drafts stay private. Approved teams, published fixtures and
                  confirmed results stay synchronized automatically.
                </p>
                <label className="field">
                  <span>Website theme</span>
                  <select
                    value={site.theme}
                    onChange={(e) => {
                      setSite({
                        ...site,
                        theme: e.target.value as Website["theme"],
                      });
                      setApproved(false);
                    }}
                  >
                    <option value="courtside">
                      Scoreboard · clean & modern
                    </option>
                    <option value="community">
                      Clubhouse · community editorial
                    </option>
                    <option value="arena">Arena · bold competition</option>
                  </select>
                </label>
                <div className="setup-fields">
                  <label className="field">
                    <span>Brand colour</span>
                    <input
                      type="color"
                      value={site.colour}
                      onChange={(e) => {
                        setSite({ ...site, colour: e.target.value });
                        setApproved(false);
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Accent colour</span>
                    <input
                      type="color"
                      value={site.accent}
                      onChange={(e) => {
                        setSite({ ...site, accent: e.target.value });
                        setApproved(false);
                      }}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>League logo</span>
                  <input
                    aria-label="League logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      void uploadLogo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <small>
                    Brand artwork only. Never upload children’s documents or
                    photos here.
                  </small>
                </label>
                {site.logo && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSite({ ...site, logo: "" });
                      setApproved(false);
                    }}
                  >
                    Remove logo from draft
                  </Button>
                )}
                {(["headline", "about", "rules", "contactEmail"] as const).map(
                  (key) => (
                    <label className="field" key={key}>
                      <span>
                        {
                          {
                            headline: "Public headline",
                            about: "About the league",
                            rules: "Additional public league rules",
                            contactEmail: "Public contact email (optional)",
                          }[key]
                        }
                      </span>
                      {key === "about" || key === "rules" ? (
                        <textarea
                          maxLength={1800}
                          rows={4}
                          value={site[key]}
                          onChange={(e) => {
                            setSite({ ...site, [key]: e.target.value });
                            setApproved(false);
                          }}
                        />
                      ) : (
                        <input
                          type={key === "contactEmail" ? "email" : "text"}
                          maxLength={key === "headline" ? 120 : 150}
                          value={site[key]}
                          onChange={(e) => {
                            setSite({ ...site, [key]: e.target.value });
                            setApproved(false);
                          }}
                        />
                      )}
                    </label>
                  ),
                )}
                <p className="form-note">
                  Only the explicit public contact above appears on the website.
                  Private administrator/coach/guardian contacts are excluded.
                </p>
                <Button
                  disabled={busy || !dirty}
                  onClick={() =>
                    void act(
                      () =>
                        cmd("site_save", { site, revision: w.site_revision }),
                      "Website draft saved privately. Published content is unchanged.",
                      true,
                    )
                  }
                >
                  <SaveIcon /> Save website draft
                </Button>
              </section>
              <section className="site-preview-panel">
                <header>
                  <h3>Live draft preview</h3>
                  <div role="group" aria-label="Website preview size">
                    <button
                      aria-pressed={width === "desktop"}
                      onClick={() => setWidth("desktop")}
                    >
                      Desktop
                    </button>
                    <button
                      aria-pressed={width === "mobile"}
                      onClick={() => setWidth("mobile")}
                    >
                      Mobile
                    </button>
                  </div>
                </header>
                <div
                  className={`site-preview-frame ${width === "mobile" ? "preview-mobile" : ""}`}
                >
                  {siteData && (
                    <LeagueWebsite
                      data={{ ...siteData, config: site }}
                      preview
                    />
                  )}
                </div>
              </section>
            </div>
            <section className="panel site-publication">
              <div>
                <h3>
                  {w.site_published
                    ? "Website is published"
                    : "Publish only when you’re ready"}
                </h3>
                <p>
                  {w.site_published
                    ? `Published revision ${w.published_revision}. Current saved draft ${w.site_revision}.`
                    : "Saving a draft does not make it public or open registration."}
                </p>
                {w.site_published && (
                  <a
                    className="text-link"
                    href={`/league/${s.league.slug}/website`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View public website <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />{" "}
                I reviewed the saved public copy/logo and confirm it contains no
                private youth data, documents or invitations.
              </label>
              <div className="settings-actions">
                <Button
                  disabled={busy || dirty || !approved || w.site_revision < 1}
                  onClick={() =>
                    void act(
                      () =>
                        cmd("site_publish", {
                          revision: w.site_revision,
                          approved_public: true,
                        }),
                      "Website published by your explicit approval. Registration, schedule publication and notifications are unchanged.",
                    )
                  }
                >
                  Publish saved website
                </Button>
                {w.site_published && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => cmd("site_unpublish"),
                        "Website unpublished. History and private records are retained.",
                      )
                    }
                  >
                    Unpublish website
                  </Button>
                )}
              </div>
              {dirty && (
                <p className="form-note">
                  Save the current draft before approving publication.
                </p>
              )}
            </section>
          </>
        ))}
      {tab === "Brand & domain" && (
        <div className="launch-brand-grid">
          <section className="panel">
            <span className="launch-eyebrow">NAMING IDEAS · RULES BASED</span>
            <h3>Make the league recognizable.</h3>
            <p>
              Ideas use the saved league name and city. No Meta inference or
              trademark clearance.
            </p>
            <ul className="launch-ideas">
              {ideas.names.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <h4>Domain suggestions</h4>
            {ideas.domains.map((d) => (
              <button
                className="launch-domain-idea"
                key={d}
                onClick={() => {
                  setDomain(d);
                  setLookup(null);
                }}
              >
                <span>{d}</span>
                <small>Suggested · not checked</small>
              </button>
            ))}
            <p className="form-note">
              Before choosing a name, manually check local league directories,
              business/trademark registries and possible confusion with existing
              organizations.
            </p>
            <a
              className="text-link"
              href="https://ised-isde.canada.ca/cipo/trademark-search/srch"
              target="_blank"
              rel="noreferrer"
            >
              Open official Canadian trademark search ↗
            </a>
          </section>
          <section className="panel">
            <h3>Preferred domain</h3>
            <label className="field">
              <span>Domain name</span>
              <input
                maxLength={253}
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setLookup(null);
                }}
                placeholder="yourleague.com"
              />
            </label>
            <div className="settings-actions">
              <Button
                disabled={busy || !w.setup || !domain.trim()}
                onClick={() =>
                  void act(
                    () => cmd("domain_save", { domain }),
                    "Preferred domain saved as a suggestion. Nothing purchased or connected.",
                  )
                }
              >
                Save preferred domain
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !domain.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setLookup(null);
                  try {
                    setLookup(await cmd("domain_lookup", { domain }));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={15} /> Check .com registration
              </Button>
            </div>
            {lookup && (
              <div className="setup-guidance">
                <strong>Registration lookup completed</strong>
                <p>
                  {lookup.domain}:{" "}
                  {lookup.registered
                    ? "registration record found"
                    : "no registration record returned"}
                  .
                </p>
                <p>
                  Purchase availability:{" "}
                  <strong>{lookup.purchaseAvailability}</strong>.
                </p>
                <small>
                  Checked {new Date(lookup.checkedAt).toLocaleString()} ·
                  official Verisign RDAP · current view only
                </small>
                <p>{lookup.note}</p>
                <a
                  className="text-link"
                  href={lookup.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Registry response ↗
                </a>
              </div>
            )}
            <ol className="launch-domain-states">
              <li>Suggested: naming idea only.</li>
              <li>
                Registration lookup completed: a timestamped registry
                observation.
              </li>
              <li>
                Purchase availability confirmed: requires an authorized
                registrar quote; not implemented.
              </li>
              <li>
                Purchased: requires owner authorization and purchase evidence.
              </li>
              <li>
                Connected: requires domain ownership/DNS verification after
                submission.
              </li>
            </ol>
            <p className="form-note">
              No domain purchase, DNS change, paid service or custom-domain
              connection is performed by this preview.
            </p>
          </section>
        </div>
      )}
      {tab === "Social starter kit" && (
        <>
          <section className="panel">
            <span className="launch-eyebrow">
              EDITABLE STARTER COPY · RULES BASED
            </span>
            <h3>Introduce your league.</h3>
            <p>
              Prepared from saved league facts, with no Meta call. Review dates,
              permissions and public links before using. No social account is
              connected and nothing is posted.
            </p>
            <div className="launch-social-grid">
              <article>
                <h4>Instagram username ideas</h4>
                {ideas.handles.map((h) => (
                  <p key={h}>@{h} · availability unverified</p>
                ))}
                <small>
                  Confirm manually through Instagram’s supported account
                  interface. No scraping or availability claim.
                </small>
              </article>
              <article>
                <h4>Facebook Page name ideas</h4>
                {ideas.names.map((n) => (
                  <p key={n}>{n}</p>
                ))}
                <small>
                  Owner creates/claims the Page and reviews naming conflicts
                  manually.
                </small>
              </article>
            </div>
          </section>
          {[
            ["Instagram bio", kit.bio],
            ["League description", kit.description],
            ...kit.posts.map((post, i) => [`Launch post ${i + 1}`, post]),
            ["Registration announcement", kit.registration],
            ["Reusable content template", kit.template],
          ].map(([title, copy]) => (
            <section className="panel social-copy" key={title}>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <Button variant="secondary" onClick={() => void copyText(copy)}>
                <Copy size={15} /> Copy draft
              </Button>
            </section>
          ))}
          <section className="panel">
            <h3>Connect the public presence manually</h3>
            <p>
              After approved website publication, use{" "}
              <strong>{`/league/${s.league.slug}/website`}</strong> in the
              league’s social bio. Add only verified, owner-controlled social
              links. Future publishing requires account connection, scoped
              permissions and owner approval.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
function SaveIcon() {
  return <Globe size={16} />;
}
