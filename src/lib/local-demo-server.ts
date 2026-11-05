import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";
import { newSetup } from "./launchpad";
import { workspaceHref, type ProductDemo } from "./product-navigation";
import { localDemoAllowed, localDemoSameOrigin } from "./local-demo-policy";
// Next replaces NODE_ENV at build time: production artifacts can never opt in at runtime.
const DEVELOPMENT_BUILD = process.env.NODE_ENV !== "production";
export const localDemoCookie = "courtside_local_preview";
const ttl = 8 * 60 * 60;
type PreviewSession = {
  token: string;
  email: string;
  user: User;
  demo: ProductDemo;
  expires: number;
  refreshAt: number;
};
const localGlobal = globalThis as typeof globalThis & {
  courtsidePreviewSessions?: Map<string, PreviewSession>;
};
const sessions = (localGlobal.courtsidePreviewSessions ??= new Map<
  string,
  PreviewSession
>());
export function localDemoEnabled(request: Request) {
  return localDemoAllowed(request, process.env, DEVELOPMENT_BUILD);
}
function client(token?: string) {
  return createClient(
    "http://127.0.0.1:3302",
    "synthetic-preview-publishable",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token
        ? { headers: { Authorization: "Bearer " + token } }
        : undefined,
    },
  );
}
async function attest() {
  const r = await fetch("http://127.0.0.1:3302/__preview", {
    cache: "no-store",
    redirect: "error",
  });
  if (!r.ok) throw Error("Synthetic backend unavailable");
  const p = await r.json();
  if (
    p.accounts?.admin !== "launchpad-admin@example.invalid" ||
    p.accounts?.coach !== "launchpad-coach@example.invalid" ||
    typeof p.password !== "string" ||
    p.password.length < 12
  )
    throw Error("Synthetic backend identity mismatch");
  return p.password as string;
}
function cookieId(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(localDemoCookie + "="))
    ?.slice(localDemoCookie.length + 1);
}
export async function localDemoSession(request: Request) {
  if (!localDemoEnabled(request)) return null;
  const id = cookieId(request);
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const s = sessions.get(id);
  if (!s || s.expires < Date.now()) {
    if (id) sessions.delete(id);
    return null;
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !localDemoSameOrigin(request)
  )
    throw Error("Local demo origin rejected");
  if (s.refreshAt < Date.now()) {
    const password = await attest();
    const { data, error } = await client().auth.signInWithPassword({
      email: s.email,
      password,
    });
    if (error || !data.session) throw Error("Synthetic session renewal failed");
    s.token = data.session.access_token;
    s.refreshAt = Date.now() + 45 * 60 * 1000;
  }
  const { data, error } = await client(s.token).auth.getUser(s.token);
  if (error || data.user?.id !== s.user.id)
    throw Error("Synthetic session unavailable");
  return s;
}
export function localDemoDescription(s: PreviewSession) {
  return {
    enabled: true,
    user: { id: s.user.id },
    demo: s.demo,
    dashboard: workspaceHref(s.demo.id),
  };
}
export async function prepareLocalDemo(request: Request) {
  if (!localDemoEnabled(request) || !localDemoSameOrigin(request))
    throw Error("Local demo unavailable");
  const existing = await localDemoSession(request);
  if (existing)
    return { description: localDemoDescription(existing), cookie: null };
  for (const [id, s] of sessions)
    if (s.expires < Date.now()) sessions.delete(id);
  if (sessions.size >= 32) throw Error("Local demo session limit reached");
  const password = await attest();
  // Credentials are obtained only from the attested loopback adapter, never committed or exposed to the browser.
  const email = `interactive-${randomUUID()}@example.invalid`;
  const { data: auth, error: authError } = await client().auth.signUp({
    email,
    password,
  });
  if (authError || !auth.session || !auth.user)
    throw Error("Synthetic account unavailable");
  const db = client(auth.session.access_token);
  const call = async (action: string, payload: unknown) => {
    const { data, error } = await db.rpc("organizer_command", {
      p_action: action,
      p_payload: payload,
    });
    if (error) throw Error("Synthetic setup unavailable");
    return data;
  };
  const { data: seed, error: seedError } = await db.rpc("create_demo");
  if (seedError || !seed?.id) throw Error("Synthetic fixture unavailable");
  let draft = await call("begin_edit", { league_id: seed.id });
  const setup = {
    ...newSetup(),
    ...draft.data,
    name: "Harbour Hoops League · Interactive demo",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    season: "Fall 2026",
    start: "2026-09-01",
    end: "2026-12-31",
    opening: "2026-09-05",
    cutoff: "2026-09-01",
    registrationDeadline: "2026-08-01",
    rosterDeadline: "2026-08-15",
    verificationDeadline: "2026-08-28",
    minRoster: 5,
    maxRoster: 12,
    proofRequired: true,
    allowedDocumentTypes: ["passport"],
    divisions: draft.data.divisions.map((d: object) => ({
      ...d,
      min_age: 12,
      max_age: 13,
    })),
  };
  draft = await call("save_draft", {
    id: draft.id,
    revision: draft.revision,
    base_revision: draft.base_revision,
    league_id: seed.id,
    data: setup,
  });
  await call("finish", { id: draft.id, revision: draft.revision });
  // Copy only already-approved public branding from the existing Scoreboard review league.
  const { data: directory } = await db.rpc("public_leagues");
  let approved;
  for (const row of (directory ?? [])
    .filter((r: { is_demo: boolean }) => r.is_demo)
    .slice(0, 12)) {
    const { data } = await db.rpc("public_launch_site", { p_slug: row.slug });
    if (data?.config?.theme === "courtside") {
      approved = data.config;
      break;
    }
  }
  if (!approved) throw Error("Published Scoreboard template unavailable");
  await call("site_save", {
    league_id: seed.id,
    revision: 0,
    site: {
      ...approved,
      theme: "courtside",
      contactEmail: "",
      about:
        approved.about ||
        "A synthetic youth basketball league for the local Courtside AI demonstration.",
    },
  });
  // Initial synthetic fixture only. Subsequent user websites retain explicit saved-copy approval.
  await call("site_publish", {
    league_id: seed.id,
    revision: 1,
    approved_public: true,
  });
  const site = await call("site_preview", { league_id: seed.id });
  const s: PreviewSession = {
    token: auth.session.access_token,
    email,
    user: auth.user,
    demo: {
      id: seed.id,
      name: site.league.name,
      season: site.league.season,
      href: `/league/${site.league.slug}/website`,
    },
    expires: Date.now() + ttl * 1000,
    refreshAt: Date.now() + 45 * 60 * 1000,
  };
  const id = randomBytes(32).toString("base64url");
  sessions.set(id, s);
  return {
    description: localDemoDescription(s),
    cookie: {
      name: localDemoCookie,
      value: id,
      httpOnly: true,
      sameSite: "strict" as const,
      path: "/",
      maxAge: ttl,
      secure: false,
    },
  };
}
