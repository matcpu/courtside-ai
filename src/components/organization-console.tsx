"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { browserSupabase } from "@/lib/supabase";
import type { Organization, Plan } from "@/lib/organizations";
import { newSetup, type Setup } from "@/lib/launchpad";
import { OrganizerSetup } from "./organizer-setup";
import { Button } from "./ui/button";
import { workspaceHref } from "@/lib/product-navigation";

export function OrganizationConsole({
  platform = false,
}: {
  platform?: boolean;
}) {
  const [client] = useState(() => {
    try {
      return browserSupabase();
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<{ user: { id: string } } | null>(null),
    [ready, setReady] = useState(false);
  const [data, setData] = useState<{
    organizations: Organization[];
    plans: Plan[];
    platform_admin: boolean;
    billing_enabled: boolean;
  } | null>(null);
  const [platformData, setPlatformData] = useState<any>(null),
    [selected, setSelected] = useState("");
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [invitation, setInvitation] = useState("");
  const [newOrg, setNewOrg] = useState(""),
    [newProgram, setNewProgram] = useState(""),
    [rename, setRename] = useState("");
  const [inviteEmail, setInviteEmail] = useState(""),
    [inviteRole, setInviteRole] = useState("member");
  const [setup, setSetup] = useState<Setup | null>(null);
  const token = useRef("");
  const requestedOrganization = useRef<string | null>(null),
    authUid = useRef<string | null>(null),
    loadEpoch = useRef(0);
  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const candidate = fragment.get("invite");
    if (candidate && /^[A-Za-z0-9_-]{43}$/.test(candidate))
      token.current = candidate;
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
    requestedOrganization.current = new URLSearchParams(location.search).get(
      "organization",
    );
    if (!client) {
      setReady(true);
      setNotice("Secure authentication is not configured on this runtime.");
      return;
    }
    const applySession = (value: { user: { id: string } } | null) => {
      if (authUid.current !== (value?.user.id ?? null)) {
        authUid.current = value?.user.id ?? null;
        loadEpoch.current++;
        setData(null);
        setPlatformData(null);
        setSelected("");
        setInvitation("");
        setSetup(null);
        setNotice("");
        setNewOrg("");
        setNewProgram("");
        setRename("");
        setInviteEmail("");
        setInviteRole("member");
      }
      setSession(value);
      setReady(true);
    };
    let live = true;
    client.auth.getSession().then(({ data }) => {
      if (live) {
        applySession(data.session);
      }
    });
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, value) => {
        applySession(value);
      },
    );
    return () => {
      live = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);
  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!client) throw Error("Secure authentication is not configured");
      const {
        data: { session },
      } = await client.auth.getSession();
      const r = await fetch(path, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
      });
      const body = await r.json();
      if ((session?.user.id ?? null) !== authUid.current)
        throw Error("Account changed. Reload before continuing.");
      if (!r.ok) throw Error(body.error ?? "Request could not complete");
      return body;
    },
    [client],
  );
  const command = (action: string, payload: unknown = {}) =>
    api("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });
  const load = useCallback(async () => {
    if (!session) {
      setData(null);
      setPlatformData(null);
      return;
    }
    const epoch = ++loadEpoch.current;
    try {
      if (platform) {
        const result = await api("/api/platform");
        if (epoch === loadEpoch.current) setPlatformData(result);
      } else {
        const next = await api("/api/organizations");
        if (epoch !== loadEpoch.current) return;
        setData(next);
        setSelected((old) => {
          const wanted = old || requestedOrganization.current;
          return wanted
            ? next.organizations.some((o: Organization) => o.id === wanted)
              ? wanted
              : ""
            : (next.organizations[0]?.id ?? "");
        });
      }
    } catch (e) {
      if (epoch === loadEpoch.current) setNotice((e as Error).message);
    }
  }, [api, session, platform]);
  useEffect(() => {
    void load();
  }, [load]);
  const org = data?.organizations.find((o) => o.id === selected);
  useEffect(() => {
    setRename(org?.name ?? "");
    setInvitation("");
  }, [org?.id, org?.revision]);
  async function act(fn: () => Promise<unknown>, message: string) {
    const actor = authUid.current;
    setBusy(true);
    setNotice("");
    try {
      await fn();
      if (actor !== authUid.current) return;
      await load();
      setNotice(message);
    } catch (e) {
      if (actor === authUid.current) setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(
    action: string,
    payload: Record<string, unknown>,
    message: string,
  ) {
    return act(
      () => command(action, { organization_id: org?.id, ...payload }),
      message,
    );
  }
  async function bill(action: string, plan?: string) {
    await act(async () => {
      const r = await api("/api/billing", {
        method: "POST",
        body: JSON.stringify({ organization_id: org?.id, action, plan }),
      });
      if (r.url) location.assign(r.url);
    }, "Billing reconciled from current Stripe test state.");
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const f = new FormData(event.currentTarget);
    await act(async () => {
      const { error } = await client.auth.signInWithPassword({
        email: String(f.get("email")),
        password: String(f.get("password")),
      });
      if (error)
        throw Error(
          "Sign-in failed. Check your account and confirmation status.",
        );
    }, "Signed in.");
  }
  return (
    <div className="saas-shell">
      <header className="saas-header">
        <a href="/" className="saas-brand">
          courtside AI
        </a>
        <nav aria-label="Account navigation">
          <a href="/">Your leagues</a>
          <a href="/organizations">Organizations & plans</a>
          {data?.platform_admin && (
            <a href="/platform">Platform administration</a>
          )}
          {session && (
            <Button variant="ghost" onClick={() => void client?.auth.signOut()}>
              Sign out
            </Button>
          )}
        </nav>
      </header>
      <main>
        <h1>{platform ? "Platform administration" : "Your league business"}</h1>
        <p>
          {platform
            ? "Organization health and subscription operations. This view grants no private league or youth-document access."
            : "Manage your organization, leagues, seasons and team of organizers. Private league permissions stay separate."}
        </p>
        {notice && (
          <p role="status" className="info-banner">
            {notice}
          </p>
        )}
        {!ready ? (
          <p>Checking your session…</p>
        ) : !session ? (
          <section className="panel">
            <h2>Sign in securely</h2>
            <form className="setup-fields" onSubmit={signIn}>
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="field">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <Button disabled={busy}>Sign in</Button>
            </form>
            <a href="/?action=signin">
              Create an account through the existing sign-up flow
            </a>
          </section>
        ) : platform ? (
          platformData ? (
            <>
              <div className="saas-cards">
                {platformData.organizations.map((o: any) => (
                  <section className="panel" key={o.id}>
                    <h2>{o.name}</h2>
                    <p>{o.id}</p>
                    <p>
                      {o.plan} · {o.billing_status} · {o.status}
                    </p>
                    <p>
                      {o.usage.programs} leagues · {o.usage.seasons} seasons ·{" "}
                      {o.usage.members} organization members
                    </p>
                    {(o.issue_code ||
                      o.over_limit ||
                      o.pending_webhooks > 0 ||
                      o.status === "unclaimed") && (
                      <p role="status">
                        Needs review:{" "}
                        {o.issue_code ??
                          (o.status === "unclaimed"
                            ? "legacy owner unclaimed"
                            : o.over_limit
                              ? "above current plan limit"
                              : "pending/failed synchronization")}{" "}
                        · {o.pending_webhooks} events
                      </p>
                    )}
                    <ul>
                      {o.leagues.map((l: any) => (
                        <li key={l.id}>
                          {l.name} · {l.season} · {l.sport}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <p>Unmapped billing events: {platformData.unmapped_events}</p>
            </>
          ) : (
            <p>No platform data is available for this account.</p>
          )
        ) : (
          <>
            {token.current && (
              <section className="panel">
                <h2>Organization invitation</h2>
                <p>
                  The invitation is kept out of the URL and server logs. Accept
                  using the invited, confirmed account.
                </p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const r = await command("accept", {
                        token: token.current,
                      });
                      token.current = "";
                      setSelected(r.organization_id);
                    }, "Invitation accepted. League access still requires an explicit league role.")
                  }
                >
                  Accept organization invitation
                </Button>
              </section>
            )}
            <section className="panel">
              <h2>Organizations</h2>
              {data?.organizations.length ? (
                <label className="field">
                  Selected organization
                  <select
                    aria-label="Selected organization"
                    value={selected}
                    disabled={busy}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="" disabled>
                      Choose an organization
                    </option>
                    {data.organizations.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name} · {o.role}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p>
                  Create your first organization to organize leagues and
                  seasons.
                </p>
              )}
              <form
                className="saas-inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    const r = await command("create", { name: newOrg });
                    setSelected(r.id);
                    setNewOrg("");
                  }, "Organization created on Free. No billing service was contacted.");
                }}
              >
                <label className="field">
                  New organization name
                  <input
                    aria-label="New organization name"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <Button disabled={busy}>Create organization</Button>
              </form>
            </section>
            {org && (
              <>
                <section className="panel">
                  <h2>{org.name}</h2>
                  <p>Your role: {org.role}</p>
                  {org.role !== "member" && (
                    <form
                      className="saas-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(
                          "rename",
                          { name: rename, revision: org.revision },
                          "Organization name saved.",
                        );
                      }}
                    >
                      <label className="field">
                        Organization name
                        <input
                          aria-label="Organization name"
                          value={rename}
                          onChange={(e) => setRename(e.target.value)}
                          minLength={2}
                          maxLength={100}
                          required
                        />
                      </label>
                      <Button disabled={busy}>Save organization</Button>
                    </form>
                  )}
                </section>
                <section className="panel">
                  <h2>Plan & usage</h2>
                  <p data-testid="effective-plan">
                    Current plan: <strong>{org.plan}</strong> · Subscription:{" "}
                    {org.billing.status}
                  </p>
                  <p>
                    {org.billing.cancel_at_period_end
                      ? "Cancellation is scheduled; the current plan remains until the provider ends the subscription."
                      : "Plan access follows verified current subscription state, never the checkout return page."}
                  </p>
                  {org.billing.issue_code && (
                    <p role="status">
                      Billing needs review: {org.billing.issue_code}
                    </p>
                  )}
                  <div className="saas-cards">
                    {data?.plans.map((plan) => (
                      <article key={plan.code} className="saas-plan">
                        <h3>{plan.name}</h3>
                        <p>
                          {plan.limits.programs} leagues · {plan.limits.seasons}{" "}
                          season workspaces · {plan.limits.members} organization
                          members
                        </p>
                        {plan.code !== "free" && org.role === "owner" && (
                          <Button
                            disabled={busy || !data.billing_enabled}
                            onClick={() => void bill("checkout", plan.code)}
                          >
                            Test checkout: {plan.name}
                          </Button>
                        )}
                      </article>
                    ))}
                  </div>
                  <p>
                    Usage: {org.usage.programs}/{org.limits.programs} leagues ·{" "}
                    {org.usage.seasons}/{org.limits.seasons} seasons ·{" "}
                    {org.usage.members}/{org.limits.members} members ·{" "}
                    {org.usage.pending_invitations} pending invitations.
                  </p>
                  <p>
                    Downgrades preserve existing data and league operations.
                    Creation above the new limits is blocked. Capacity values
                    are configurable; no prices are assumed.
                  </p>
                  {!data?.billing_enabled && (
                    <p>
                      Stripe test billing is disabled. No payment request will
                      be made.
                    </p>
                  )}
                  {org.role === "owner" && (
                    <div className="inline-actions">
                      <Button
                        variant="secondary"
                        disabled={busy || !data?.billing_enabled}
                        onClick={() => void bill("portal")}
                      >
                        Open test customer portal
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy || !data?.billing_enabled}
                        onClick={() => void bill("reconcile")}
                      >
                        Reconcile test subscription
                      </Button>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <h2>Leagues & seasons</h2>
                  {org.role !== "member" && (
                    <form
                      className="saas-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(
                          "create_program",
                          { name: newProgram },
                          "League created. Set up its first season next.",
                        );
                        setNewProgram("");
                      }}
                    >
                      <label className="field">
                        League name
                        <input
                          aria-label="League name"
                          value={newProgram}
                          onChange={(e) => setNewProgram(e.target.value)}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </label>
                      <Button disabled={busy}>Add league</Button>
                    </form>
                  )}
                  {org.programs.map((pr) => (
                    <article className="saas-program" key={pr.id}>
                      <h3>{pr.name}</h3>
                      <ul>
                        {pr.seasons.map((s) => (
                          <li key={s.id}>
                            {s.season} · {s.sport}{" "}
                            {s.role ? (
                              <a href={workspaceHref(s.id)}>
                                Open league dashboard ↗
                              </a>
                            ) : (
                              <span>
                                Private workspace · ask a league administrator
                                for access
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {org.role !== "member" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            setSetup({
                              ...newSetup(),
                              name: pr.name,
                              organization_id: org.id,
                              program_id: pr.id,
                            })
                          }
                        >
                          Set up season for {pr.name}
                        </Button>
                      )}
                    </article>
                  ))}
                </section>
                {org.role !== "member" && (
                  <section className="panel">
                    <h2>Organization team</h2>
                    <p>
                      Organization roles do not automatically unlock private
                      league data. Only a current league administrator can
                      explicitly delegate a league role.
                    </p>
                    <form
                      className="saas-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(async () => {
                          const r = await command("invite", {
                            organization_id: org.id,
                            email: inviteEmail,
                            role: inviteRole,
                          });
                          setInvitation(
                            new URL(r.invitation_path, location.origin).href,
                          );
                        }, "Invitation prepared. No email or SMS was sent.");
                      }}
                    >
                      <label className="field">
                        Invite account email
                        <input
                          aria-label="Invite account email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                        />
                      </label>
                      <label className="field">
                        Organization role
                        <select
                          aria-label="Organization role"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                        >
                          <option value="member">Member</option>
                          {org.role === "owner" && (
                            <option value="admin">Admin</option>
                          )}
                        </select>
                      </label>
                      <Button disabled={busy}>Create invitation link</Button>
                    </form>
                    {invitation && (
                      <label className="field">
                        Private invitation link
                        <input
                          aria-label="Private invitation link"
                          readOnly
                          value={invitation}
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                    )}
                    <ul>
                      {org.invitations
                        .filter((i) => !i.revoked_at && !i.accepted_at)
                        .map((i) => (
                          <li key={i.id}>
                            {i.email} · {i.role} · expires{" "}
                            {new Date(i.expires_at).toLocaleString()}{" "}
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void mutate(
                                  "revoke_invite",
                                  { invitation_id: i.id },
                                  "Invitation revoked.",
                                )
                              }
                            >
                              Revoke invitation
                            </Button>
                          </li>
                        ))}
                    </ul>
                    {org.members.map((m) => (
                      <article className="saas-member" key={m.user_id}>
                        <b>
                          {m.user_id === session.user.id ? "You" : m.user_id}
                        </b>{" "}
                        · {m.role}
                        {m.role !== "owner" &&
                          m.user_id !== session.user.id && (
                            <div className="inline-actions">
                              {org.role === "owner" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      void mutate(
                                        "set_role",
                                        {
                                          user_id: m.user_id,
                                          role:
                                            m.role === "admin"
                                              ? "member"
                                              : "admin",
                                        },
                                        "Organization role changed.",
                                      )
                                    }
                                  >
                                    Make{" "}
                                    {m.role === "admin" ? "member" : "admin"}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Transfer organization ownership to this member? You will remain an administrator. Private league roles stay separate.",
                                        )
                                      )
                                        void mutate(
                                          "transfer_owner",
                                          { user_id: m.user_id },
                                          "Organization ownership transferred.",
                                        );
                                    }}
                                  >
                                    Transfer ownership
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(
                                    "remove_member",
                                    { user_id: m.user_id },
                                    "Organization membership removed. Organization-delegated league grants were revoked; prior explicit league permissions were preserved.",
                                  )
                                }
                              >
                                Remove organization member
                              </Button>
                              {org.programs
                                .flatMap((pr) => pr.seasons)
                                .filter((s) => s.role === "admin")
                                .map((s) => (
                                  <Button
                                    key={s.id}
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      void mutate(
                                        "grant_league_role",
                                        {
                                          user_id: m.user_id,
                                          league_id: s.id,
                                          role: "admin",
                                        },
                                        "Explicit league administrator access granted.",
                                      )
                                    }
                                  >
                                    Grant league admin: {s.name} · {s.season}
                                  </Button>
                                ))}
                            </div>
                          )}
                      </article>
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
      {setup && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Organization season setup"
            className="modal modal-setup"
          >
            <button
              className="modal-close"
              aria-label="Close season setup"
              onClick={() => setSetup(null)}
            >
              ×
            </button>
            <OrganizerSetup
              api={api}
              startMode="guided"
              initialData={setup}
              onClose={() => setSetup(null)}
              onComplete={async (id) => {
                location.assign(workspaceHref(id, "Launchpad"));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
