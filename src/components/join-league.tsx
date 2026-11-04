"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { Button } from "./ui/button";
export function JoinLeague() {
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signed, setSigned] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "";
    // Remove the capability before Auth/navigation. Keep it in memory only.
    if (window.location.hash)
      history.replaceState(null, "", window.location.pathname);
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) setToken(value);
    else
      setError(
        "Open the complete private invitation supplied by your administrator.",
      );
    const db = browserSupabase();
    db.auth.getSession().then(({ data }) => setSigned(!!data.session));
    const { data } = db.auth.onAuthStateChange((_event, session) =>
      setSigned(!!session),
    );
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await browserSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        throw Error(
          "Sign-in failed. Use the invited email and your confirmed account.",
        );
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const { data } = await browserSupabase().auth.getSession();
      const r = await fetch("/api/launchpad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ action: "accept_invite", payload: { token } }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      localStorage.setItem(
        `courtside:last-league:v1:${data.session!.user.id}`,
        result.league_id,
      );
      setToken("");
      setAccepted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="join-page">
      <section className="join-card">
        <span className="launch-eyebrow">
          COURTSIDE AI · PRIVATE INVITATION
        </span>
        <h1>
          {accepted
            ? "You’re part of the league."
            : "Join your league securely."}
        </h1>
        <p>
          {accepted
            ? "Your authorized membership and any specified team assignment were saved together."
            : "This expiring link is for one invited email account. Sign in, then explicitly accept. No message is sent by accepting."}
        </p>
        {error && (
          <p role="alert" className="launch-error">
            {error}
          </p>
        )}
        {accepted ? (
          <a className="button button-primary" href="/">
            Open your league workspace →
          </a>
        ) : !signed ? (
          <>
            <form onSubmit={signIn}>
              <label className="field">
                <span>Invited email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <Button disabled={busy}>Sign in</Button>
            </form>
            <p className="form-note">
              Need an account?{" "}
              <a
                className="text-link"
                href="/"
                target="_blank"
                rel="noreferrer"
              >
                Create and confirm it in the workspace
              </a>
              , then sign in here. Keep this window open. Email confirmation
              remains subject to the existing restricted testing setup.
            </p>
          </>
        ) : (
          <>
            <p>
              Use the invited, confirmed account. Another person’s account
              cannot accept this invitation.
            </p>
            <Button disabled={busy || !token} onClick={() => void accept()}>
              Accept league invitation
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void browserSupabase().auth.signOut()}
            >
              Use another account
            </Button>
          </>
        )}
        <small>
          Expired, revoked or already accepted links cannot be reused. Ask the
          administrator for a replacement.
        </small>
      </section>
    </main>
  );
}
