"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileImage,
  Flag,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase";
import {
  standings,
  validateExtraction,
  type Extraction,
  type Snapshot,
  type Sheet,
  type Team,
} from "@/lib/domain";
import { Button } from "./ui/button";

type View =
  | "Overview"
  | "Teams & rosters"
  | "Schedule"
  | "Scoresheets"
  | "Standings"
  | "Competitive balance"
  | "Courts & gyms"
  | "Notifications"
  | "Settings";
type LeagueChoice = {
  id: string;
  name: string;
  slug: string;
  is_demo: boolean;
};
const nav: [View, typeof Activity][] = [
  ["Overview", LayoutDashboard],
  ["Teams & rosters", Users],
  ["Schedule", CalendarDays],
  ["Scoresheets", FileImage],
  ["Standings", Trophy],
  ["Competitive balance", ChartNoAxesCombined],
  ["Courts & gyms", MapPin],
  ["Notifications", Bell],
];
const time = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(s));
const date = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "America/Toronto",
  }).format(new Date(s));
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "orange" | "neutral" | "blue";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Flag size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Form({
  children,
  onSubmit,
  submit,
  busy = false,
}: {
  children: ReactNode;
  onSubmit: (f: FormData) => Promise<void>;
  submit: string;
  busy?: boolean;
}) {
  return (
    <form
      className="form-grid"
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        await onSubmit(new FormData(form));
      }}
    >
      {children}
      <div className="form-actions">
        <Button disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plus size={16} />
          )}{" "}
          {submit}
        </Button>
      </div>
    </form>
  );
}
function CourtArt() {
  return (
    <svg className="court-art" viewBox="0 0 600 300" aria-hidden="true">
      <defs>
        <pattern
          id="court-grid"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".035"
          />
        </pattern>
      </defs>
      <rect width="600" height="300" fill="url(#court-grid)" />
      <g
        transform="translate(80,34) rotate(-18,220,110)"
        fill="none"
        stroke="#c6eac4"
        strokeWidth="1.5"
        opacity=".32"
      >
        <rect x="15" y="5" width="430" height="230" rx="4" />
        <path d="M230 5v230" />
        <circle cx="230" cy="120" r="38" />
        <path d="M15 65h76v110H15M445 65h-76v110h76" />
        <path d="M91 65a55 55 0 0 1 0 110M369 65a55 55 0 0 0 0 110" />
        <path d="M15 28a125 125 0 0 1 0 184M445 28a125 125 0 0 0 0 184" />
        <circle cx="41" cy="120" r="9" />
        <circle cx="419" cy="120" r="9" />
      </g>
      <g fill="#d5f58c">
        <circle cx="260" cy="85" r="5" />
        <circle cx="442" cy="145" r="5" />
        <circle cx="351" cy="200" r="5" />
      </g>
      <path
        d="M260 85l91 115 91-55"
        stroke="#d5f58c"
        strokeWidth="1"
        strokeDasharray="4 5"
        fill="none"
        opacity=".6"
      />
    </svg>
  );
}

export function LeagueApp({ publicSlug }: { publicSlug?: string }) {
  const supabase = useMemo(() => {
    try {
      return browserSupabase();
    } catch {
      return null;
    }
  }, []);
  const [session, setSession] = useState<Session | null>(null),
    [view, setView] = useState<View>("Overview"),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [leagues, setLeagues] = useState<LeagueChoice[]>([]),
    [publicLeagues, setPublicLeagues] = useState<LeagueChoice[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [modal, setModal] = useState<
      | "auth"
      | "team"
      | "court"
      | "availability"
      | "league"
      | "player"
      | "agent"
      | null
    >(null),
    [authMode, setAuthMode] = useState<"signin" | "signup">("signin"),
    [health, setHealth] = useState<{
      database: boolean;
      meta: boolean;
      email: boolean;
      sms: boolean;
    } | null>(null),
    [menu, setMenu] = useState(false),
    [teamFilter, setTeamFilter] = useState(""),
    [round, setRound] = useState(0),
    [sheet, setSheet] = useState<Sheet | null>(null),
    [extraction, setExtraction] = useState<Extraction | null>(null),
    [reviewed, setReviewed] = useState(false),
    [correction, setCorrection] = useState(""),
    [imageUrl, setImageUrl] = useState(""),
    [agentResult, setAgentResult] = useState<{
      message: string;
      trace: { tool: string; outcome: unknown }[];
    } | null>(null);
  const notify = (text: string, error = false) => setNotice({ text, error });
  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const fresh = supabase
        ? (await supabase.auth.getSession()).data.session
        : null;
      const res = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(fresh ? { Authorization: `Bearer ${fresh.access_token}` } : {}),
          ...options.headers,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      return data;
    },
    [supabase],
  );
  const mine = leagues.some((l) => l.id === selected) && !publicSlug;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await api(`/api/league?id=${selected}&public=${!mine}`);
      if (selectedRef.current === selected) setSnapshot(data);
    } catch (e) {
      if (selectedRef.current === selected) {
        setNotice({ text: (e as Error).message, error: true });
        setSnapshot(null);
      }
    } finally {
      if (selectedRef.current === selected) setLoading(false);
    }
  }, [api, selected, mine]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    return () => subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    (async () => {
      try {
        const pubs = (await api("/api/league?public=true")) as LeagueChoice[];
        setPublicLeagues(pubs);
        let own: LeagueChoice[] = [];
        if (session) own = await api("/api/league");
        setLeagues(own);
        setSelected((current) => {
          if (publicSlug)
            return pubs.find((l) => l.slug === publicSlug)?.id ?? "";
          if (current && [...own, ...pubs].some((l) => l.id === current))
            return current;
          return own[0]?.id ?? pubs[0]?.id ?? "";
        });
      } catch (e) {
        notify((e as Error).message, true);
      } finally {
        setLoading(false);
      }
    })();
  }, [api, session, publicSlug]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      const result = await fn();
      notify(success);
      await load();
      return result;
    } catch (e) {
      notify((e as Error).message, true);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const cmd = (action: string, payload: unknown = {}) =>
    api("/api/league", {
      method: "POST",
      body: JSON.stringify({ league: selected, action, payload }),
    });
  const s = snapshot,
    isAdmin = s?.role === "admin",
    canWrite = mine && !!session,
    canScore =
      canWrite && ["admin", "scorekeeper", "coach"].includes(s?.role ?? "");
  const teamName = (id: string) =>
    s?.teams.find((t) => t.id === id)?.name ?? "Unknown team";
  const divisionName = (id: string | null) =>
    s?.divisions.find((d) => d.id === id)?.name ?? "Awaiting placement";
  const published = s?.versions.find((v) => v.status === "published"),
    drafts = s?.versions.filter((v) => v.status === "draft") ?? [],
    pendingTeams = s?.teams.filter((t) => t.status === "pending") ?? [],
    pendingSheets = s?.scoresheets.filter((f) => f.status === "review") ?? [],
    pendingProposals = s?.proposals.filter((p) => p.status === "pending") ?? [];
  const officialFixtures =
      s?.fixtures.filter((f) => f.version_id === published?.id) ?? [],
    upcoming = officialFixtures.filter(
      (f) =>
        +new Date(f.starts_at) >= Date.now() &&
        s?.games.find((g) => g.id === f.game_id)?.status !== "confirmed",
    ),
    verified = s?.games.filter((g) => g.status === "confirmed") ?? [],
    table = s ? standings(s.teams, s.games) : [];
  const changeView = (v: View) => {
    setView(v);
    setMenu(false);
  };
  async function openSheet(item: Sheet) {
    setSheet(item);
    setExtraction(structuredClone(item.extraction));
    setReviewed(false);
    setCorrection("");
    setImageUrl("");
    if (supabase) {
      const { data, error } = await supabase.storage
        .from("scoresheets")
        .createSignedUrl(item.storage_path, 300);
      if (error) notify("Unable to preview the private scoresheet", true);
      else setImageUrl(data.signedUrl);
    }
  }
  const createDemo = () =>
    act(async () => {
      const result = await api("/api/demo", { method: "POST", body: "{}" });
      const own = await api("/api/league");
      setLeagues(own);
      setSelected(result.id);
      setModal(null);
    }, "Your private synthetic demo league is ready.");
  const refreshChoices = async (id: string) => {
    const own = await api("/api/league");
    setLeagues(own);
    setSelected(id);
    setModal(null);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <a className="brand" href="/" aria-label="Courtside AI home">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M4 16h24M16 4v24M8 7c9 4 9 14 0 18M24 7c-9 4-9 14 0 18"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>
          <span>
            courtside<span className="brand-ai">AI</span>
            <small>LEAGUE OPERATIONS</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">N</span>
          <div>
            <b>{s?.league.name ?? "Your league"}</b>
            <small>{s?.league.season_name ?? "Basketball operations"}</small>
          </div>
          <ChevronDown size={15} />
          <select
            aria-label="Switch league"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {[
              ...leagues,
              ...publicLeagues.filter(
                (p) => !leagues.some((l) => l.id === p.id),
              ),
            ].map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.is_demo ? " · Demo" : ""}
              </option>
            ))}
          </select>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map(([title, Icon]) => (
            <button
              key={title}
              className={view === title ? "active" : ""}
              onClick={() => changeView(title)}
            >
              <Icon size={18} />
              <span>{title}</span>
              {title === "Scoresheets" && pendingSheets.length > 0 && (
                <span className="nav-count">{pendingSheets.length}</span>
              )}
              {title === "Competitive balance" &&
                pendingProposals.length > 0 && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-card">
            <div>
              <span className="live-dot" />
              <b>League intelligence</b>
              <Sparkles size={14} />
            </div>
            <p>
              {health?.meta
                ? "Muse Spark is connected. Ready to coordinate your next workflow."
                : "Connect Meta to unlock your league operations agent."}
            </p>
            <button
              onClick={() =>
                canWrite && isAdmin ? setModal("agent") : changeView("Settings")
              }
            >
              {health?.meta
                ? "Open operations agent"
                : "View connection status"}{" "}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-setting"
            onClick={() => changeView("Settings")}
          >
            <Settings2 size={17} /> Settings & access
          </button>
          <div className="profile">
            <span className="profile-avatar">{session ? "ME" : "D"}</span>
            <div>
              <b>{session ? "Your workspace" : "Demo visitor"}</b>
              <small>{canWrite ? s?.role : "Public, read-only access"}</small>
            </div>
            <button
              aria-label={session ? "Sign out" : "Sign in"}
              onClick={() =>
                session ? void supabase?.auth.signOut() : setModal("auth")
              }
            >
              {session ? <LogOut size={17} /> : <LogIn size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{view}</b>
          </div>
          <div className="topbar-actions">
            <span className="season-pill">
              <span className="live-dot" />
              {s?.league.season_name ?? "Fall 2026"}
            </span>
            {s && (
              <a
                href={`/league/${s.league.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Public site <ArrowUpRight size={14} />
              </a>
            )}
            <button onClick={() => void load()} aria-label="Refresh league">
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
            <button
              aria-label="Notification history"
              onClick={() => changeView("Notifications")}
            >
              <Bell size={18} />
            </button>
          </div>
        </header>
        <main>
          {notice && (
            <div
              role="status"
              className={`notice ${notice.error ? "notice-error" : ""}`}
            >
              <span>
                {notice.error ? <CircleHelp size={17} /> : <Check size={17} />}{" "}
                {notice.text}
              </span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {s?.league.is_demo && (
            <div className="demo-strip">
              <ShieldCheck size={15} />
              <span>FICTIONAL DEMO LEAGUE</span>
              <p>
                {canWrite
                  ? "Your isolated sandbox. All records are synthetic."
                  : "Explore real database records with safe, read-only access."}
              </p>
              {!session && (
                <button onClick={() => setModal("auth")}>
                  Create your workspace <ArrowRight size={14} />
                </button>
              )}
              {session && !canWrite && (
                <button onClick={() => void createDemo()} disabled={busy}>
                  Create private demo <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {s?.league.name ?? "COURTSIDE AI"} <span>/</span>{" "}
                {isAdmin
                  ? "LEAGUE ADMINISTRATION"
                  : canWrite
                    ? "COACH PORTAL"
                    : "LEAGUE EXPLORER"}
              </div>
              <h1>{view === "Overview" ? "Your league. In sync." : view}</h1>
              <p>
                {
                  {
                    Overview: "Less administration. More time on the court.",
                    "Teams & rosters":
                      "Every team, in the right place. Built on verified information.",
                    Schedule:
                      "Confirmed courts. Conflict-free fixtures. One source of truth.",
                    Scoresheets: "From the final buzzer to a verified result.",
                    Standings:
                      "The season so far, from confirmed results only.",
                    "Competitive balance":
                      "Better matchups start with evidence. Every move stays in your control.",
                    "Courts & gyms":
                      "Your schedule starts with confirmed space.",
                    Notifications:
                      "Every update, with a traceable delivery state.",
                    Settings:
                      "Connections, league configuration, and who can do what.",
                  }[view]
                }
              </p>
            </div>
            <div className="heading-actions">
              {view === "Overview" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => changeView("Schedule")}
                  >
                    <CalendarDays size={16} /> View schedule
                  </Button>
                  <Button
                    onClick={() =>
                      canScore ? changeView("Scoresheets") : setModal("auth")
                    }
                  >
                    <Upload size={16} /> Upload scoresheet
                  </Button>
                </>
              )}
              {view === "Teams & rosters" && (
                <Button
                  onClick={() =>
                    (session && !s?.league.is_demo) || canWrite
                      ? setModal("team")
                      : setModal("auth")
                  }
                >
                  <Plus size={16} /> Register team
                </Button>
              )}
              {view === "Courts & gyms" && isAdmin && (
                <Button onClick={() => setModal("court")}>
                  <Plus size={16} /> Add court
                </Button>
              )}
            </div>
          </div>
          {loading && !s ? (
            <div className="loading-state">
              <LoaderCircle className="spin" /> Loading your league…
            </div>
          ) : !s ? (
            <Panel
              title="Welcome to Courtside AI"
              subtitle="The league that learns as it plays."
            >
              <Empty
                title={
                  health?.database
                    ? "Your next season starts here"
                    : "Connect the league database"
                }
              >
                {health?.database
                  ? "Sign in to create a league or start an isolated demo workspace."
                  : "Configure the Supabase environment to connect the app. Setup details are in SETUP.md."}
              </Empty>
              <div className="center-actions">
                <Button onClick={() => setModal(session ? "league" : "auth")}>
                  {session ? "Create a league" : "Sign in / create account"}
                </Button>
                {session && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void createDemo()}
                  >
                    Create private demo
                  </Button>
                )}
              </div>
            </Panel>
          ) : (
            <>
              {view === "Overview" && (
                <>
                  <section className="hero">
                    <div className="hero-content">
                      <span className="hero-label">
                        <Sparkles size={14} /> THE LEAGUE THAT LEARNS AS IT
                        PLAYS
                      </span>
                      <h2>
                        A better game.
                        <br />
                        For every team.
                      </h2>
                      <p>
                        Bring your season together. Turn verified results into
                        <br className="desktop-br" /> fairer competition, with
                        you in control.
                      </p>
                      <button onClick={() => changeView("Competitive balance")}>
                        Explore league intelligence <ArrowRight size={16} />
                      </button>
                    </div>
                    <CourtArt />
                    <div className="hero-footnote">
                      <ShieldCheck size={13} /> Human approved. Always.
                    </div>
                  </section>
                  <div className="stats-grid">
                    <Stat
                      label="REGISTERED TEAMS"
                      value={s.teams.length}
                      icon={Users}
                      detail={`${s.teams.filter((t) => t.status === "approved").length} approved for competition`}
                      color="green"
                    />
                    <Stat
                      label="GAMES THIS SEASON"
                      value={officialFixtures.length}
                      icon={CalendarDays}
                      detail={`${verified.length} results confirmed`}
                      color="blue"
                    />
                    <Stat
                      label="COMPETITIVE DIVISIONS"
                      value={s.divisions.length}
                      icon={ChartNoAxesCombined}
                      detail="Placement backed by evidence"
                      color="purple"
                    />
                    <Stat
                      label="NEEDS YOUR REVIEW"
                      value={
                        pendingTeams.length +
                        pendingSheets.length +
                        pendingProposals.length +
                        drafts.length
                      }
                      icon={ClipboardCheck}
                      detail={
                        s.role === "public"
                          ? "Sign in to view approval queues"
                          : "Your decisions keep the league moving"
                      }
                      color="orange"
                    />
                  </div>
                  <div className="dashboard-grid">
                    <div className="dashboard-main">
                      <Panel
                        title="Coming up on court"
                        subtitle="Your published schedule · Eastern Time"
                        action={
                          <button
                            className="text-link"
                            onClick={() => changeView("Schedule")}
                          >
                            Full schedule <ArrowUpRight size={14} />
                          </button>
                        }
                      >
                        {upcoming.length ? (
                          <div className="fixture-list">
                            {upcoming.slice(0, 4).map((f) => (
                              <div className="fixture-row" key={f.game_id}>
                                <div className="fixture-date">
                                  <b>
                                    {new Date(f.starts_at).toLocaleDateString(
                                      "en-CA",
                                      {
                                        day: "2-digit",
                                        timeZone: "America/Toronto",
                                      },
                                    )}
                                  </b>
                                  <small>
                                    {new Date(f.starts_at)
                                      .toLocaleDateString("en-CA", {
                                        month: "short",
                                        timeZone: "America/Toronto",
                                      })
                                      .toUpperCase()}
                                  </small>
                                </div>
                                <div className="fixture-match">
                                  <span>
                                    <TeamMark name={teamName(f.home_team_id)} />
                                    {teamName(f.home_team_id)}
                                  </span>
                                  <small>vs</small>
                                  <span>
                                    <TeamMark name={teamName(f.away_team_id)} />
                                    {teamName(f.away_team_id)}
                                  </span>
                                </div>
                                <div className="fixture-meta">
                                  <b>
                                    {new Date(f.starts_at).toLocaleTimeString(
                                      "en-CA",
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        timeZone: "America/Toronto",
                                      },
                                    )}
                                  </b>
                                  <small>
                                    <MapPin size={11} />
                                    {
                                      s.courts.find((c) => c.id === f.court_id)
                                        ?.name
                                    }
                                  </small>
                                </div>
                                <Badge tone="green">Scheduled</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty title="The next round is yours">
                            Approve team placements and confirm gym time, then
                            generate a schedule.
                          </Empty>
                        )}
                      </Panel>
                      <Panel
                        title="League standings"
                        subtitle="Only verified results count"
                        action={
                          <button
                            className="text-link"
                            onClick={() => changeView("Standings")}
                          >
                            View all <ArrowUpRight size={14} />
                          </button>
                        }
                      >
                        <StandingsTable rows={table.slice(0, 5)} />
                      </Panel>
                    </div>
                    <div className="dashboard-side">
                      <Panel
                        title="The next best move"
                        subtitle="LEAGUE INTELLIGENCE"
                        className="intelligence-panel"
                      >
                        <div className="intelligence-icon">
                          <Sparkles size={23} />
                        </div>
                        <h3>
                          {pendingProposals.length
                            ? `${pendingProposals.length} competitive adjustments to review`
                            : "Keep competition moving forward"}
                        </h3>
                        <p>
                          {pendingProposals.length
                            ? "Recent verified results indicate a sustained mismatch. Review the evidence before making a division change."
                            : "The engine looks for sustained mismatches across three verified games. No decision is made from a single result."}
                        </p>
                        <div className="evidence-line">
                          <ShieldCheck size={15} /> Grounded in confirmed game
                          data
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => changeView("Competitive balance")}
                        >
                          Review league balance <ArrowRight size={15} />
                        </Button>
                      </Panel>
                      <Panel
                        title="Operations checklist"
                        subtitle="A clear path from setup to tipoff"
                      >
                        <div className="checklist">
                          {[
                            [
                              s.teams.some((t) => t.status === "approved"),
                              "Approve team placements",
                              "Teams & rosters",
                            ],
                            [
                              s.availability.some((a) => a.confirmed) ||
                                !!published,
                              "Confirm gym availability",
                              "Courts & gyms",
                            ],
                            [
                              !!published,
                              "Publish your game schedule",
                              "Schedule",
                            ],
                            [
                              verified.length > 0,
                              "Confirm game results",
                              "Scoresheets",
                            ],
                          ].map(([done, title, v]) => (
                            <button
                              key={String(title)}
                              onClick={() => changeView(v as View)}
                            >
                              <span
                                className={
                                  done ? "check-circle done" : "check-circle"
                                }
                              >
                                {done ? <Check size={12} /> : <span />}
                              </span>
                              <span>{title as string}</span>
                              <ChevronRight size={14} />
                            </button>
                          ))}
                        </div>
                      </Panel>
                    </div>
                  </div>
                  <div className="trust-footer">
                    <span>
                      <span className="live-dot" /> Connected to your league
                      database
                    </span>
                    <span>
                      Verified results <i>·</i> Deterministic scheduling{" "}
                      <i>·</i> Human approval
                    </span>
                    <b>COURTSIDE AI</b>
                  </div>
                </>
              )}
              {view === "Teams & rosters" && (
                <>
                  <div className="toolbar">
                    <input
                      placeholder="Search teams…"
                      aria-label="Search teams"
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value)}
                    />
                    <span>
                      {s.teams.length} teams · {pendingTeams.length} awaiting
                      approval
                    </span>
                  </div>
                  <div className="team-grid">
                    {s.teams
                      .filter((t) =>
                        t.name.toLowerCase().includes(teamFilter.toLowerCase()),
                      )
                      .map((t) => (
                        <Panel
                          key={t.id}
                          title={t.name}
                          subtitle={divisionName(t.division_id)}
                          action={<TeamMark name={t.name} />}
                        >
                          <div className="team-details">
                            <Badge
                              tone={
                                t.status === "approved" ? "green" : "orange"
                              }
                            >
                              {t.status}
                            </Badge>
                            <span>
                              Rating <b>{t.rating}</b>
                            </span>
                          </div>
                          <p className="team-explanation">
                            {t.assessment_explanation ??
                              "Rating and placement are based on the team questionnaire and verified game results."}
                          </p>
                          {t.status === "pending" && (
                            <p className="small-muted">
                              Recommended:{" "}
                              {
                                s.divisions.find(
                                  (d) => d.tier === t.recommended_division,
                                )?.name
                              }
                            </p>
                          )}
                          {isAdmin && t.status === "pending" && (
                            <div className="inline-actions">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void act(
                                    () =>
                                      cmd("approve_team", { team_id: t.id }),
                                    "Team placement approved.",
                                  )
                                }
                              >
                                <Check size={14} /> Approve placement
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void act(
                                    () => cmd("reject_team", { team_id: t.id }),
                                    "Team registration rejected.",
                                  )
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          <div className="roster-preview">
                            <h4>
                              Roster{" "}
                              <span>
                                {
                                  s.players.filter((p) => p.team_id === t.id)
                                    .length
                                }
                              </span>
                            </h4>
                            {s.players
                              .filter((p) => p.team_id === t.id)
                              .map((p) => (
                                <div className="roster-row" key={p.id}>
                                  <span>
                                    #{p.jersey} {p.display_name}
                                  </span>
                                  <Badge
                                    tone={
                                      p.eligibility_status === "verified"
                                        ? "green"
                                        : "orange"
                                    }
                                  >
                                    {p.eligibility_status}
                                  </Badge>
                                  {isAdmin &&
                                    p.eligibility_status === "pending" && (
                                      <button
                                        className="text-link"
                                        disabled={busy}
                                        onClick={() =>
                                          void act(
                                            () =>
                                              cmd("verify_player", {
                                                player_id: p.id,
                                              }),
                                            "Age eligibility and guardian consent checked.",
                                          )
                                        }
                                      >
                                        Verify
                                      </button>
                                    )}
                                </div>
                              ))}
                            {!canWrite && (
                              <p className="small-muted">
                                Player details are private.
                              </p>
                            )}
                            {canWrite &&
                              (isAdmin || t.coach_id === session?.user.id) && (
                                <button
                                  className="text-link"
                                  onClick={() => setModal("player")}
                                >
                                  <Plus size={14} /> Add player
                                </button>
                              )}
                          </div>
                        </Panel>
                      ))}
                  </div>
                  {!s.teams.length && (
                    <Empty title="Meet your first team">
                      Register a team and complete the coach questionnaire.
                    </Empty>
                  )}
                </>
              )}
              {view === "Schedule" && (
                <>
                  <div className="schedule-toolbar">
                    <div className="inline-actions">
                      <Badge tone="green">
                        {published
                          ? `Published · v${published.number}`
                          : "No published schedule"}
                      </Badge>
                      <span className="small-muted">
                        All times Eastern · 60-minute games · 30-minute rest
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="inline-actions">
                        <Field label="Round">
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={round + 1}
                            onChange={(e) =>
                              setRound(Math.max(0, Number(e.target.value) - 1))
                            }
                          />
                        </Field>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () =>
                                api("/api/schedule", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    league: selected,
                                    round,
                                    useMeta: health?.meta ?? false,
                                  }),
                                }),
                              "Schedule draft saved. Review before publishing.",
                            )
                          }
                        >
                          <Sparkles size={16} /> Generate next round
                        </Button>
                      </div>
                    )}
                  </div>
                  {drafts.map((v) => (
                    <Panel
                      key={v.id}
                      title={`Draft schedule · version ${v.number}`}
                      subtitle={v.explanation}
                      action={<Badge tone="orange">Approval required</Badge>}
                    >
                      <FixtureTable s={s} version={v.id} />
                      <div className="approval-bar">
                        <p>
                          <ShieldCheck size={15} /> Publishing replaces all
                          future fixtures in the current schedule and queues
                          coach notifications.
                        </p>
                        <div className="inline-actions">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("reject_schedule", { version_id: v.id }),
                                "Draft rejected. The published schedule is unchanged.",
                              )
                            }
                          >
                            Reject draft
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("publish_schedule", { version_id: v.id }),
                                "Schedule published. Coach notifications are queued.",
                              )
                            }
                          >
                            <CheckCheck size={16} /> Approve & publish
                          </Button>
                        </div>
                      </div>
                    </Panel>
                  ))}
                  <Panel
                    title="Published fixtures"
                    subtitle={
                      published?.explanation ??
                      "Only approved schedules appear on the public site."
                    }
                  >
                    {published ? (
                      <FixtureTable s={s} version={published.id} />
                    ) : (
                      <Empty title="No schedule published yet">
                        Generate a feasible draft, review it and approve
                        publication.
                      </Empty>
                    )}
                  </Panel>
                  {s.versions.filter((v) =>
                    ["superseded", "rejected"].includes(v.status),
                  ).length > 0 && (
                    <Panel title="Version history">
                      <div className="history-list">
                        {s.versions
                          .filter((v) =>
                            ["superseded", "rejected"].includes(v.status),
                          )
                          .map((v) => (
                            <details key={v.id}>
                              <summary>
                                Version {v.number} <Badge>{v.status}</Badge>
                                <span>{time(v.created_at)}</span>
                              </summary>
                              <p>{v.explanation}</p>
                              <FixtureTable s={s} version={v.id} />
                            </details>
                          ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}
              {view === "Scoresheets" && (
                <>
                  {canScore && (
                    <Panel
                      title="Capture the final whistle"
                      subtitle="Upload a scoresheet photo. Extract, review, then confirm the result."
                    >
                      <Form
                        busy={busy}
                        submit={
                          health?.meta
                            ? "Upload & extract with Muse Spark"
                            : "Upload for manual review"
                        }
                        onSubmit={async (f) => {
                          const game_id = String(f.get("game_id")),
                            file = f.get("image") as File;
                          if (!file?.size)
                            return notify("Choose a scoresheet image", true);
                          if (file.size > 6 * 1024 * 1024)
                            return notify("Maximum image size is 6 MB", true);
                          await act(
                            async () => {
                              if (!supabase || !session)
                                throw new Error("Sign in first");
                              const ext =
                                file.type === "image/png"
                                  ? "png"
                                  : file.type === "image/webp"
                                    ? "webp"
                                    : "jpg";
                              const hash = Array.from(
                                new Uint8Array(
                                  await crypto.subtle.digest(
                                    "SHA-256",
                                    await file.arrayBuffer(),
                                  ),
                                ),
                              )
                                .map((b) => b.toString(16).padStart(2, "0"))
                                .join("");
                              const path = `${selected}/${session.user.id}/${hash}.${ext}`;
                              const { error } = await supabase.storage
                                .from("scoresheets")
                                .upload(path, file, {
                                  upsert: false,
                                  contentType: file.type,
                                });
                              if (
                                error &&
                                !/already exists|Duplicate/i.test(error.message)
                              )
                                throw error;
                              const game = s.games.find(
                                (g) => g.id === game_id,
                              )!;
                              const empty: Extraction = {
                                homeTeam: teamName(game.home_team_id),
                                awayTeam: teamName(game.away_team_id),
                                homeScore: null,
                                awayScore: null,
                                confidence: 0,
                                warnings: [
                                  "Manual entry. No AI extraction was performed.",
                                ],
                                players: [],
                              };
                              const result = await api("/api/scoresheet", {
                                method: "POST",
                                body: JSON.stringify({
                                  league: selected,
                                  game_id,
                                  path,
                                  mode: health?.meta ? "meta" : "manual",
                                  extraction: empty,
                                }),
                              });
                              const fresh = (await api(
                                `/api/league?id=${selected}&public=false`,
                              )) as Snapshot;
                              setSnapshot(fresh);
                              const saved = fresh.scoresheets.find(
                                (sh) => sh.id === result.id,
                              );
                              if (saved) await openSheet(saved);
                            },
                            health?.meta
                              ? "Extraction saved for human review. No official result recorded."
                              : "Photo saved for manual review. Meta is not connected.",
                          );
                        }}
                      >
                        <Field label="Published game">
                          <select name="game_id" required>
                            <option value="">Choose a game</option>
                            {officialFixtures.map((f) => (
                              <option key={f.game_id} value={f.game_id}>
                                {teamName(f.home_team_id)} vs{" "}
                                {teamName(f.away_team_id)} · {date(f.starts_at)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Scoresheet photo (JPEG, PNG, WebP · up to 6 MB)">
                          <input
                            name="image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            required
                          />
                        </Field>
                        <p className="form-note">
                          <ShieldCheck size={15} /> Photos stay in private
                          storage. Missing scores and statistics stay empty
                          until reviewed.
                        </p>
                        {s.league.is_demo && (
                          <a
                            className="text-link"
                            href="/demo/scoresheet.png"
                            download
                          >
                            Download fictional demo scoresheet{" "}
                            <ArrowDown size={14} />
                          </a>
                        )}
                      </Form>
                    </Panel>
                  )}
                  <Panel
                    title="Scoresheet review queue"
                    subtitle={
                      s.role === "public"
                        ? "Original scoresheets and youth information are private."
                        : "Every official result has a human review step."
                    }
                  >
                    {s.scoresheets.length ? (
                      <div className="sheet-grid">
                        {s.scoresheets.map((sh) => (
                          <div className="sheet-card" key={sh.id}>
                            <FileImage size={24} />
                            <div>
                              <b>
                                {teamName(
                                  s.games.find((g) => g.id === sh.game_id)
                                    ?.home_team_id ?? "",
                                )}{" "}
                                vs{" "}
                                {teamName(
                                  s.games.find((g) => g.id === sh.game_id)
                                    ?.away_team_id ?? "",
                                )}
                              </b>
                              <p>
                                {sh.source === "meta"
                                  ? "Meta Muse Spark"
                                  : "Manual entry"}{" "}
                                · {time(sh.created_at)}
                              </p>
                            </div>
                            <Badge
                              tone={
                                sh.status === "confirmed" ? "green" : "orange"
                              }
                            >
                              {sh.status}
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void openSheet(sh)}
                            >
                              Review <ArrowRight size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty title="No scoresheets to review">
                        {canScore
                          ? "Choose a published game and upload its scoresheet."
                          : "Sign in with the appropriate role to upload and review scoresheets."}
                      </Empty>
                    )}
                  </Panel>
                </>
              )}
              {view === "Standings" && (
                <>
                  <Panel
                    title="Season standings"
                    subtitle="2 points for a win · 1 for a draw · Verified results only"
                  >
                    <StandingsTable rows={table} />
                  </Panel>
                  <Panel title="Latest confirmed results">
                    <div className="results-grid">
                      {verified.map((g) => (
                        <div className="result-card" key={g.id}>
                          <Badge tone="green">
                            <Check size={12} /> Verified
                          </Badge>
                          <div>
                            <span>{teamName(g.home_team_id)}</span>
                            <b>{g.home_score}</b>
                          </div>
                          <div>
                            <span>{teamName(g.away_team_id)}</span>
                            <b>{g.away_score}</b>
                          </div>
                          <small>
                            {g.played_at ? time(g.played_at) : "Confirmed game"}
                          </small>
                        </div>
                      ))}
                    </div>
                    {!verified.length && (
                      <Empty title="The season is waiting for its first result">
                        Confirmed scoresheets will update standings and ratings
                        here.
                      </Empty>
                    )}
                  </Panel>
                </>
              )}
              {view === "Competitive balance" && (
                <>
                  <div className="info-banner">
                    <ShieldCheck size={20} />
                    <div>
                      <b>
                        Three verified games. One evidence-based recommendation.
                      </b>
                      <p>
                        A team with three consecutive wins or losses and an
                        average margin of at least 15 points may move one tier.
                        Every change requires your approval.
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () => cmd("propose_balance"),
                            "Competitive evidence checked. Review any new proposals.",
                          )
                        }
                      >
                        <RefreshCw size={15} /> Evaluate balance
                      </Button>
                    )}
                  </div>
                  {pendingProposals.map((p) => (
                    <Panel
                      key={p.id}
                      title={teamName(p.team_id)}
                      subtitle="DIVISION ADJUSTMENT PROPOSAL"
                      action={<Badge tone="orange">Needs your decision</Badge>}
                    >
                      <div className="proposal-path">
                        <span>{divisionName(p.from_division_id)}</span>
                        <ArrowRight size={22} />
                        <span>{divisionName(p.to_division_id)}</span>
                      </div>
                      <p className="proposal-reason">{p.reason}</p>
                      <div className="evidence-stats">
                        {Object.entries(p.evidence).map(([k, v]) => (
                          <div key={k}>
                            <small>{k.replaceAll("_", " ")}</small>
                            <b>
                              {typeof v === "number"
                                ? Number(v.toFixed(1))
                                : String(v)}
                            </b>
                          </div>
                        ))}
                      </div>
                      <div className="approval-bar">
                        <p>
                          Approval updates placement. Generate and review a
                          revised schedule before publishing new fixtures.
                        </p>
                        <div className="inline-actions">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("decide_proposal", {
                                    proposal_id: p.id,
                                    approve: false,
                                  }),
                                "Division proposal rejected.",
                              )
                            }
                          >
                            Keep current division
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("decide_proposal", {
                                    proposal_id: p.id,
                                    approve: true,
                                  }),
                                "Division adjustment approved. Generate a revised schedule next.",
                              )
                            }
                          >
                            <Check size={16} /> Approve adjustment
                          </Button>
                        </div>
                      </div>
                    </Panel>
                  ))}
                  {!pendingProposals.length && (
                    <Panel title="Competitive review">
                      <Empty
                        title={
                          s.role === "public"
                            ? "Division reviews are private"
                            : "No pending division adjustments"
                        }
                      >
                        {s.role === "public"
                          ? "Administrators review individual evidence and placement proposals securely."
                          : "Run an evaluation after three verified games. The engine proposes a move only when the evidence threshold is met."}
                      </Empty>
                    </Panel>
                  )}
                  <Panel
                    title="Team rating monitor"
                    subtitle="Elo ratings are recalculated from the complete verified result history."
                  >
                    <div className="rating-list">
                      {[...s.teams]
                        .sort((a, b) => b.rating - a.rating)
                        .map((t) => (
                          <div key={t.id}>
                            <TeamMark name={t.name} />
                            <b>{t.name}</b>
                            <span>{divisionName(t.division_id)}</span>
                            <div className="rating-bar">
                              <i
                                style={{
                                  width: `${Math.max(5, Math.min(100, (t.rating - 700) / 8))}%`,
                                }}
                              />
                            </div>
                            <strong>{t.rating}</strong>
                            <small
                              className={
                                t.rating >= t.initial_rating
                                  ? "text-green"
                                  : "text-orange"
                              }
                            >
                              {t.rating >= t.initial_rating ? (
                                <ArrowUp size={12} />
                              ) : (
                                <ArrowDown size={12} />
                              )}{" "}
                              {Math.abs(t.rating - t.initial_rating)}
                            </small>
                          </div>
                        ))}
                    </div>
                  </Panel>
                </>
              )}
              {view === "Courts & gyms" && (
                <>
                  <div className="court-grid">
                    {s.courts.map((c) => (
                      <Panel
                        key={c.id}
                        title={c.name}
                        subtitle={c.venue}
                        action={<MapPin size={21} />}
                      >
                        <div className="court-mini">
                          <svg viewBox="0 0 280 130" aria-hidden="true">
                            <rect
                              x="10"
                              y="10"
                              width="260"
                              height="110"
                              rx="3"
                            />
                            <path d="M140 10v110M10 35h45v60H10M270 35h-45v60h45" />
                            <circle cx="140" cy="65" r="23" />
                          </svg>
                        </div>
                        <div className="availability-list">
                          {s.availability
                            .filter((a) => a.court_id === c.id)
                            .map((a) => (
                              <div key={a.id}>
                                <Clock3 size={14} />
                                <span>
                                  {time(a.starts_at)}
                                  <small>until {time(a.ends_at)}</small>
                                </span>
                                <Badge tone="green">Confirmed</Badge>
                              </div>
                            ))}
                          {!s.availability.some((a) => a.court_id === c.id) && (
                            <p className="small-muted">
                              No confirmed availability.
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setModal("availability")}
                          >
                            <Plus size={14} /> Confirm availability
                          </Button>
                        )}
                      </Panel>
                    ))}
                  </div>
                  {!s.courts.length && (
                    <Empty title="Give your season a home court">
                      Add a venue and court, then confirm available time blocks.
                    </Empty>
                  )}
                </>
              )}
              {view === "Notifications" && (
                <Panel
                  title="Coach notification history"
                  subtitle="Queued on publication. Provider acceptance and delivery are distinct states."
                  action={
                    isAdmin && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              api("/api/notifications", {
                                method: "POST",
                                body: JSON.stringify({ league: selected }),
                              }),
                            "Notification delivery attempts completed. Review each delivery state.",
                          )
                        }
                      >
                        <Send size={15} /> Process queue
                      </Button>
                    )
                  }
                >
                  {s.notifications.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Update</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>Attempts</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.notifications.map((n) => (
                            <tr key={n.id}>
                              <td>
                                <b>{n.subject}</b>
                                <small>{time(n.created_at)}</small>
                              </td>
                              <td>{n.channel}</td>
                              <td>
                                <Badge
                                  tone={
                                    ["accepted", "delivered"].includes(n.status)
                                      ? "green"
                                      : n.status === "failed"
                                        ? "orange"
                                        : "neutral"
                                  }
                                >
                                  {n.status}
                                </Badge>
                              </td>
                              <td>{n.attempts} / 5</td>
                              <td>
                                {n.last_error ??
                                  (n.provider_id
                                    ? "Provider message recorded"
                                    : "Awaiting configured provider")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title={
                        isAdmin
                          ? "No updates queued yet"
                          : "Notification history is private"
                      }
                    >
                      Publishing a schedule queues updates for affected coaches.
                      Synthetic recipients are never sent real messages.
                    </Empty>
                  )}
                </Panel>
              )}
              {view === "Settings" && (
                <>
                  <div className="settings-grid">
                    <Panel
                      title="Connected services"
                      subtitle="Actual server configuration status"
                    >
                      <div className="connection-list">
                        {[
                          [
                            "Supabase",
                            "Authoritative league database",
                            health?.database,
                          ],
                          [
                            "Meta Muse Spark",
                            "Questionnaire, vision and operations agent",
                            health?.meta,
                          ],
                          [
                            "Resend",
                            "Transactional coach notifications",
                            health?.email,
                          ],
                          ["Twilio", "Consent saved · sending disabled", false],
                        ].map(([name, desc, ready]) => (
                          <div key={String(name)}>
                            <span className="connection-logo">
                              {String(name)[0]}
                            </span>
                            <div>
                              <b>{name}</b>
                              <small>{desc}</small>
                            </div>
                            <Badge tone={ready ? "green" : "orange"}>
                              {ready ? "Connected" : "Setup required"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <p className="form-note">
                        Credentials stay on the server. See SETUP.md for the
                        required environment variables.
                      </p>
                    </Panel>
                    <Panel
                      title="Your workspace"
                      subtitle={
                        session
                          ? "Signed in securely with Supabase Auth"
                          : "Public browsing is read-only"
                      }
                    >
                      <div className="settings-actions">
                        {!session ? (
                          <Button onClick={() => setModal("auth")}>
                            <LogIn size={16} /> Sign in / create account
                          </Button>
                        ) : (
                          <>
                            <Button onClick={() => setModal("league")}>
                              <Plus size={16} /> Create league
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void createDemo()}
                            >
                              <Sparkles size={16} /> Create private demo
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => void supabase?.auth.signOut()}
                            >
                              Sign out
                            </Button>
                          </>
                        )}
                      </div>
                    </Panel>
                  </div>
                  {isAdmin && (
                    <>
                      <Panel
                        title="League access"
                        subtitle="An invited person must have an existing Courtside account."
                      >
                        <Form
                          busy={busy}
                          submit="Add league member"
                          onSubmit={async (f) => {
                            await act(
                              () =>
                                cmd("invite_member", {
                                  email: f.get("email"),
                                  role: f.get("role"),
                                }),
                              "League membership updated.",
                            );
                          }}
                        >
                          <Field label="Account email">
                            <input name="email" type="email" required />
                          </Field>
                          <Field label="Role">
                            <select name="role">
                              <option value="coach">Coach · own teams</option>
                              <option value="scorekeeper">
                                Scorekeeper · confirm results
                              </option>
                              <option value="referee">
                                Referee · read league schedule
                              </option>
                            </select>
                          </Field>
                        </Form>
                      </Panel>
                      <Panel
                        title="Public league site"
                        subtitle="Public data excludes player identities, documents and coach contact information."
                      >
                        <div className="inline-actions">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("configure_public", { enabled: true }),
                                "Public schedule enabled. Team registrations are open.",
                              )
                            }
                          >
                            Enable public site & registration
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  cmd("configure_public", { enabled: false }),
                                "Public site and registration closed.",
                              )
                            }
                          >
                            Close public access
                          </Button>
                        </div>
                      </Panel>
                      <Panel
                        title="Audit trail"
                        subtitle="Database-generated records of impactful actions"
                      >
                        <div className="audit-list">
                          {s.audit.map((a) => (
                            <div key={a.id}>
                              <Activity size={14} />
                              <b>{a.action.replaceAll("_", " ")}</b>
                              <span>{time(a.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </>
                  )}
                  {canWrite &&
                    !isAdmin &&
                    s.teams
                      .filter((t) => t.coach_id === session?.user.id)
                      .map((t) => (
                        <Panel key={t.id} title={`${t.name} · SMS preferences`}>
                          <Form
                            busy={busy}
                            submit="Save preferences"
                            onSubmit={async (f) => {
                              await act(
                                () =>
                                  cmd("set_sms_consent", {
                                    team_id: t.id,
                                    phone: f.get("phone"),
                                    consent: f.get("consent") === "on",
                                  }),
                                "SMS consent preferences saved.",
                              );
                            }}
                          >
                            <Field label="Phone in international format">
                              <input
                                name="phone"
                                defaultValue={t.phone ?? ""}
                                placeholder="+14165550100"
                              />
                            </Field>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                name="consent"
                                defaultChecked={t.sms_consent}
                              />{" "}
                              I consent to schedule SMS. I can opt out here at
                              any time. Sending is currently disabled.
                            </label>
                          </Form>
                        </Panel>
                      ))}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={`modal ${modal === "agent" ? "modal-wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "auth"
                ? "Account access"
                : modal === "team"
                  ? "Register team"
                  : modal === "agent"
                    ? "League operations agent"
                    : "League form"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "auth" && (
              <>
                <span className="modal-icon">
                  <ShieldCheck />
                </span>
                <h2>
                  {authMode === "signin"
                    ? "Welcome back to courtside."
                    : "Your next season starts here."}
                </h2>
                <p>Secure access for the people who keep the league moving.</p>
                <Form
                  busy={busy}
                  submit={authMode === "signin" ? "Sign in" : "Create account"}
                  onSubmit={async (f) => {
                    setBusy(true);
                    try {
                      if (!supabase)
                        throw new Error("Database configuration missing");
                      const email = String(f.get("email")),
                        password = String(f.get("password"));
                      const { data, error } =
                        authMode === "signin"
                          ? await supabase.auth.signInWithPassword({
                              email,
                              password,
                            })
                          : await supabase.auth.signUp({
                              email,
                              password,
                              options: {
                                emailRedirectTo: window.location.origin,
                              },
                            });
                      if (error) throw error;
                      if (data.session) {
                        setSession(data.session);
                        setModal(null);
                        notify("Signed in. Your workspace is ready.");
                      } else
                        notify(
                          "Check your email to confirm your account, then sign in.",
                        );
                    } catch (e) {
                      notify((e as Error).message, true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Field label="Email address">
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      name="password"
                      type="password"
                      autoComplete={
                        authMode === "signin"
                          ? "current-password"
                          : "new-password"
                      }
                      minLength={authMode === "signup" ? 12 : 1}
                      required
                    />
                  </Field>
                </Form>
                <button
                  className="text-link auth-switch"
                  onClick={() =>
                    setAuthMode(authMode === "signin" ? "signup" : "signin")
                  }
                >
                  {authMode === "signin"
                    ? "New here? Create an account"
                    : "Have an account? Sign in"}
                </button>
              </>
            )}
            {modal === "team" && (
              <>
                <span className="modal-icon">
                  <Users />
                </span>
                <h2>Find your team’s starting point.</h2>
                <p>
                  Your coach assessment recommends a division. A league
                  administrator makes the final placement.
                </p>
                <Form
                  busy={busy}
                  submit="Submit team & assessment"
                  onSubmit={async (f) => {
                    const result = await act(
                      () =>
                        api("/api/register", {
                          method: "POST",
                          body: JSON.stringify({
                            league: selected,
                            name: f.get("name"),
                            assessment: {
                              experience: Number(f.get("experience")),
                              yearsTogether: Number(f.get("years")),
                              practicesPerWeek: Number(f.get("practices")),
                              notes: f.get("notes"),
                            },
                            phone: f.get("phone") || "",
                            sms_consent: f.get("sms") === "on",
                          }),
                        }),
                      "Registration saved. Placement is awaiting administrator approval.",
                    );
                    if (result) await refreshChoices(selected);
                  }}
                >
                  <Field label="Team name">
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="e.g. Northside Falcons"
                    />
                  </Field>
                  <Field label="Competitive experience">
                    <select name="experience">
                      <option value="1">1 · New to organized basketball</option>
                      <option value="2">2 · Recreational experience</option>
                      <option value="3">
                        3 · Local competitive experience
                      </option>
                      <option value="4">
                        4 · Regional competitive experience
                      </option>
                      <option value="5">
                        5 · Established representative team
                      </option>
                    </select>
                  </Field>
                  <div className="two-fields">
                    <Field label="Years playing together">
                      <input
                        name="years"
                        type="number"
                        min={0}
                        max={15}
                        defaultValue={1}
                        required
                      />
                    </Field>
                    <Field label="Practices per week">
                      <input
                        name="practices"
                        type="number"
                        min={0}
                        max={7}
                        defaultValue={2}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Anything the league should understand?">
                    <textarea
                      name="notes"
                      maxLength={2000}
                      placeholder="Team experience and context. Do not include children's personal details."
                    />
                  </Field>
                  <Field label="Optional coach phone">
                    <input name="phone" type="tel" placeholder="+14165550100" />
                  </Field>
                  <label className="checkbox-label">
                    <input name="sms" type="checkbox" /> I consent to schedule
                    SMS updates. I can opt out in Settings. Sending is currently
                    disabled.
                  </label>
                  <p className="form-note">
                    {health?.meta
                      ? "Meta Muse Spark explains the questionnaire recommendation."
                      : "Meta is not connected. The deterministic placement rubric is available."}
                  </p>
                </Form>
              </>
            )}
            {modal === "court" && (
              <>
                <h2>Add a home court.</h2>
                <p>Availability must be confirmed separately.</p>
                <Form
                  busy={busy}
                  submit="Add court"
                  onSubmit={async (f) => {
                    const result = await act(
                      () =>
                        cmd("add_court", {
                          name: f.get("name"),
                          venue: f.get("venue"),
                        }),
                      "Court added. Confirm its availability next.",
                    );
                    if (result) setModal(null);
                  }}
                >
                  <Field label="Court name">
                    <input name="name" required maxLength={100} />
                  </Field>
                  <Field label="Gym / venue">
                    <input name="venue" required maxLength={150} />
                  </Field>
                </Form>
              </>
            )}
            {modal === "availability" && (
              <>
                <h2>Confirm court time.</h2>
                <p>
                  Enter local Eastern time. Only confirmed time can be
                  scheduled.
                </p>
                <Form
                  busy={busy}
                  submit="Confirm availability"
                  onSubmit={async (f) => {
                    const start = String(f.get("start")),
                      end = String(f.get("end"));
                    const offset = (d: string) => {
                      const utc = new Date(d + "Z");
                      const toronto =
                        new Intl.DateTimeFormat("en-CA", {
                          timeZone: "America/Toronto",
                          timeZoneName: "longOffset",
                        })
                          .formatToParts(utc)
                          .find((p) => p.type === "timeZoneName")
                          ?.value.replace("GMT", "") ?? "-05:00";
                      return new Date(d + toronto).toISOString();
                    };
                    const result = await act(
                      () =>
                        cmd("add_availability", {
                          court_id: f.get("court_id"),
                          starts_at: offset(start),
                          ends_at: offset(end),
                        }),
                      "Gym availability confirmed.",
                    );
                    if (result) setModal(null);
                  }}
                >
                  <Field label="Court">
                    <select name="court_id" required>
                      {s?.courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.venue}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Start (Eastern)">
                    <input name="start" type="datetime-local" required />
                  </Field>
                  <Field label="End (Eastern)">
                    <input name="end" type="datetime-local" required />
                  </Field>
                </Form>
              </>
            )}
            {modal === "league" && (
              <>
                <h2>A new league, ready to grow.</h2>
                <p>
                  Create a private workspace with three competitive divisions.
                </p>
                <Form
                  busy={busy}
                  submit="Create league"
                  onSubmit={async (f) => {
                    await act(async () => {
                      const result = await api("/api/league", {
                        method: "POST",
                        body: JSON.stringify({
                          league: null,
                          action: "create_league",
                          payload: {
                            name: f.get("name"),
                            season: f.get("season"),
                            cutoff: f.get("cutoff"),
                          },
                        }),
                      });
                      await refreshChoices(result.id);
                    }, "League created. Register your first teams.");
                  }}
                >
                  <Field label="League name">
                    <input name="name" required minLength={2} maxLength={100} />
                  </Field>
                  <Field label="Season">
                    <input name="season" defaultValue="Fall 2026" required />
                  </Field>
                  <Field label="Age eligibility cutoff">
                    <input
                      name="cutoff"
                      type="date"
                      defaultValue="2026-09-01"
                      required
                    />
                  </Field>
                </Form>
              </>
            )}
            {modal === "player" && (
              <>
                <h2>Add to the roster.</h2>
                <p>
                  Use fictional children for the hackathon demo. Eligibility
                  requires guardian consent and administrator review.
                </p>
                <Form
                  busy={busy}
                  submit="Add player for review"
                  onSubmit={async (f) => {
                    const result = await act(
                      () =>
                        cmd("add_player", {
                          team_id: f.get("team_id"),
                          display_name: f.get("name"),
                          jersey: f.get("jersey"),
                          birth_date: f.get("dob"),
                          guardian_consent: f.get("consent") === "on",
                        }),
                      "Player saved privately for eligibility review.",
                    );
                    if (result) setModal(null);
                  }}
                >
                  <Field label="Team">
                    <select name="team_id" required>
                      {s?.teams
                        .filter(
                          (t) => isAdmin || t.coach_id === session?.user.id,
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Player display name">
                    <input name="name" required maxLength={80} />
                  </Field>
                  <div className="two-fields">
                    <Field label="Jersey number">
                      <input name="jersey" required maxLength={4} />
                    </Field>
                    <Field label="Date of birth">
                      <input name="dob" type="date" required />
                    </Field>
                  </div>
                  <label className="checkbox-label">
                    <input name="consent" type="checkbox" /> Guardian consent
                    has been obtained for league participation and private
                    roster processing.
                  </label>
                </Form>
              </>
            )}
            {modal === "agent" && (
              <>
                <span className="modal-icon">
                  <Workflow />
                </span>
                <h2>Your league operations agent.</h2>
                <p>
                  Muse Spark chooses tools to inspect the league, evaluate
                  competitive balance and prepare schedules. Your approval stays
                  in the loop.
                </p>
                <Form
                  busy={busy}
                  submit="Run operations workflow"
                  onSubmit={async (f) => {
                    await act(async () => {
                      const result = await api("/api/agent", {
                        method: "POST",
                        body: JSON.stringify({
                          league: selected,
                          objective: f.get("objective"),
                        }),
                      });
                      setAgentResult(result);
                    }, "Agent workflow recorded. Review proposed changes before approval.");
                  }}
                >
                  <Field label="What should the league work on?">
                    <textarea
                      name="objective"
                      required
                      minLength={5}
                      maxLength={1000}
                      defaultValue="Inspect our league, check for competitive mismatches, and prepare the next round for administrator review."
                    />
                  </Field>
                </Form>
                {agentResult && (
                  <div className="agent-results">
                    <p>{agentResult.message}</p>
                    {agentResult.trace.map((t, i) => (
                      <details key={i}>
                        <summary>
                          <Check size={14} />
                          {t.tool}
                        </summary>
                        <pre>{JSON.stringify(t.outcome, null, 2)}</pre>
                      </details>
                    ))}
                    <Badge tone="orange">Human approval required</Badge>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {sheet && extraction && (
        <div className="modal-backdrop">
          <section
            className="modal modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Review scoresheet"
          >
            <button
              className="modal-close"
              aria-label="Close review"
              onClick={() => {
                setSheet(null);
                setImageUrl("");
              }}
            >
              <X size={20} />
            </button>
            <h2>Review before it counts.</h2>
            <p>
              {sheet.source === "meta"
                ? "Extracted by Meta Muse Spark"
                : "Entered manually · no AI extraction"}{" "}
              · {Math.round(extraction.confidence * 100)}% extraction confidence
            </p>
            <div className="review-grid">
              <div className="scoresheet-preview">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Private uploaded scoresheet for review"
                  />
                ) : (
                  <FileImage size={48} />
                )}
              </div>
              <div>
                <div className="two-fields">
                  <Field label="Home team">
                    <input
                      value={extraction.homeTeam ?? ""}
                      onChange={(e) =>
                        setExtraction({
                          ...extraction,
                          homeTeam: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Away team">
                    <input
                      value={extraction.awayTeam ?? ""}
                      onChange={(e) =>
                        setExtraction({
                          ...extraction,
                          awayTeam: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="two-fields">
                  <Field label="Home final score">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={extraction.homeScore ?? ""}
                      onChange={(e) => {
                        setReviewed(false);
                        setExtraction({
                          ...extraction,
                          homeScore:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        });
                      }}
                    />
                  </Field>
                  <Field label="Away final score">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={extraction.awayScore ?? ""}
                      onChange={(e) => {
                        setReviewed(false);
                        setExtraction({
                          ...extraction,
                          awayScore:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        });
                      }}
                    />
                  </Field>
                </div>
                <div className="review-warnings">
                  {[
                    ...extraction.warnings,
                    ...validateExtraction(
                      extraction,
                      teamName(
                        s?.games.find((g) => g.id === sheet.game_id)
                          ?.home_team_id ?? "",
                      ),
                      teamName(
                        s?.games.find((g) => g.id === sheet.game_id)
                          ?.away_team_id ?? "",
                      ),
                    ),
                  ].map((w, i) => (
                    <p key={i}>
                      <CircleHelp size={13} />
                      {w}
                    </p>
                  ))}
                </div>
                <p className="small-muted">
                  {extraction.players.length
                    ? `${extraction.players.length} explicitly recorded player stat rows`
                    : "No player statistics recorded. Missing data stays missing."}
                </p>
                {extraction.players.length > 0 && (
                  <details>
                    <summary>Review extracted player statistics</summary>
                    <pre>{JSON.stringify(extraction.players, null, 2)}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExtraction({ ...extraction, players: [] });
                        setReviewed(false);
                      }}
                    >
                      Remove unreliable player statistics
                    </Button>
                  </details>
                )}
                {s?.games.find((g) => g.id === sheet.game_id)?.status ===
                  "confirmed" && (
                  <Field label="Reason for correcting the official result">
                    <textarea
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      minLength={5}
                    />
                  </Field>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />{" "}
                  I checked the original scoresheet, both team names, final
                  scores and any recorded player statistics.
                </label>
                {sheet.status === "review" &&
                  ["admin", "scorekeeper"].includes(s?.role ?? "") && (
                    <div className="inline-actions">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await cmd("reject_scoresheet", {
                              sheet_id: sheet.id,
                            });
                            setSheet(null);
                          }, "Scoresheet rejected. Official results are unchanged.")
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={
                          busy ||
                          !reviewed ||
                          extraction.homeScore === null ||
                          extraction.awayScore === null
                        }
                        onClick={() =>
                          void act(async () => {
                            await api("/api/scoresheet", {
                              method: "PATCH",
                              body: JSON.stringify({
                                league: selected,
                                sheet_id: sheet.id,
                                extraction,
                                reviewed,
                                correction_reason: correction,
                              }),
                            });
                            setSheet(null);
                          }, "Official result confirmed. Standings and ratings recalculated.")
                        }
                      >
                        <CheckCheck size={16} /> Confirm official result
                      </Button>
                    </div>
                  )}
                {sheet.status === "confirmed" &&
                  ["admin", "scorekeeper"].includes(s?.role ?? "") && (
                    <Button
                      variant="secondary"
                      disabled={busy || correction.trim().length < 5}
                      onClick={() =>
                        void act(async () => {
                          await cmd("reopen_result", {
                            sheet_id: sheet.id,
                            correction_reason: correction,
                          });
                          setSheet({ ...sheet, status: "review" });
                          setReviewed(false);
                        }, "Scoresheet reopened. The current official result remains in place until you approve a correction.")
                      }
                    >
                      Reopen for correction
                    </Button>
                  )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function TeamMark({ name }: { name: string }) {
  const h = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <span className={`team-mark team-color-${h % 5}`}>
      {name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function Stat({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        <span className={`stat-icon stat-${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <p>{detail}</p>
    </div>
  );
}
function StandingsTable({ rows }: { rows: ReturnType<typeof standings> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="rank-cell">#</th>
            <th>Team</th>
            <th>GP</th>
            <th>W</th>
            <th>L</th>
            <th>+/-</th>
            <th>PTS</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team.id}>
              <td className="rank-cell">{i + 1}</td>
              <td>
                <div className="table-team">
                  <TeamMark name={r.team.name} />
                  <b>{r.team.name}</b>
                </div>
              </td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.losses}</td>
              <td
                className={
                  r.for - r.against >= 0 ? "text-green" : "text-orange"
                }
              >
                {r.for - r.against > 0 ? "+" : ""}
                {r.for - r.against}
              </td>
              <td>
                <strong>{r.points}</strong>
              </td>
              <td>
                <span className="rating-number">{r.team.rating}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty title="Standings start with approved teams" />}
    </div>
  );
}
function FixtureTable({ s, version }: { s: Snapshot; version: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tipoff · Eastern</th>
            <th>Matchup</th>
            <th>Court</th>
            <th>Status / result</th>
          </tr>
        </thead>
        <tbody>
          {s.fixtures
            .filter((f) => f.version_id === version)
            .map((f) => {
              const g = s.games.find((g) => g.id === f.game_id);
              return (
                <tr key={f.game_id}>
                  <td>{time(f.starts_at)}</td>
                  <td>
                    <b>{s.teams.find((t) => t.id === f.home_team_id)?.name}</b>
                    <small>
                      vs {s.teams.find((t) => t.id === f.away_team_id)?.name}
                    </small>
                  </td>
                  <td>{s.courts.find((c) => c.id === f.court_id)?.name}</td>
                  <td>
                    {g?.status === "confirmed" ? (
                      <Badge tone="green">
                        {g.home_score} – {g.away_score} · Verified
                      </Badge>
                    ) : (
                      <Badge>
                        {s.versions.find((v) => v.id === version)?.status ===
                        "draft"
                          ? "Proposed"
                          : "Scheduled"}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
