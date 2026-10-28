"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, CheckCheck, Upload, LockKeyhole } from "lucide-react";
import { Button } from "./ui/button";
import { browserSupabase } from "@/lib/supabase";
type GuardianState = {
  invitation_id: string;
  child: { name: string; birth_date: string };
  league: string;
  team: string;
  status: string;
  guardian_consent: boolean;
  expires_at: string;
  deadline: string;
  retention_days: number;
  allowed_document_types: string[];
  review_reason: string | null;
  can_submit: boolean;
};
export function GuardianVerification() {
  const opening = useRef<Promise<GuardianState> | null>(null);
  const [state, setState] = useState<GuardianState | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function api(action?: string, payload: unknown = {}) {
    const response = await fetch(
      "/api/guardian",
      action
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, payload }),
            cache: "no-store",
          }
        : { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Unable to access verification");
    return result;
  }
  useEffect(() => {
    let active = true;
    if (!opening.current) {
      const params = new URLSearchParams(window.location.hash.slice(1)),
        token = params.get("invite");
      window.history.replaceState(null, "", window.location.pathname);
      opening.current = api(
        token ? "exchange" : undefined,
        token ? { token } : {},
      );
    }
    (async () => {
      try {
        const data = await opening.current!;
        if (active) setState(data);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!state) return;
    const f = new FormData(e.currentTarget),
      file = f.get("proof") as File;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        !file?.size ||
        file.size > 6 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error(
          "Choose a JPEG, PNG or WebP proof-of-age photo under 6 MB.",
        );
      const reserved = await api("reserve_upload", {
        invitation_id: state.invitation_id,
        document_type: f.get("document_type"),
        mime: file.type,
      });
      const uploaded = await browserSupabase()
        .storage.from("youth-documents")
        .uploadToSignedUrl(reserved.path, reserved.uploadToken, file, {
          contentType: file.type,
          cacheControl: "0",
        });
      if (uploaded.error)
        throw new Error("The private upload failed. Please retry.");
      await api("submit", {
        invitation_id: state.invitation_id,
        document_id: reserved.document_id,
        guardian_name: f.get("guardian_name"),
        relationship: f.get("relationship"),
        consent: f.get("consent") === "on",
        confirmed_details: f.get("confirmed") === "on",
      });
      setState(await api());
      setNotice(
        "Proof and consent submitted. An authorized league administrator must now review them.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="guardian-shell">
      <a href="/" className="guardian-brand">
        courtside<span>AI</span>
      </a>
      <section className="panel guardian-card">
        <div className="guardian-icon">
          <ShieldCheck size={28} />
        </div>
        <p className="eyebrow">SECURE PRESEASON VERIFICATION</p>
        <h1>A safe start to the season.</h1>
        <p>
          Confirm your child's details, provide guardian consent and send proof
          of age directly to authorized league reviewers.
        </p>
        {loading && <p role="status">Opening your private invitation…</p>}
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {state && (
          <>
            <div className="guardian-child">
              <small>
                {state.league} · {state.team}
              </small>
              <h2>{state.child.name}</h2>
              <p>
                Recorded date of birth: <b>{state.child.birth_date}</b>
              </p>
              <span
                className={`badge ${state.status === "approved" ? "badge-green" : "badge-orange"}`}
              >
                Verification: {state.status}
              </span>
              {state.review_reason && (
                <p>
                  <b>League review:</b> {state.review_reason}
                </p>
              )}
            </div>
            <div className="info-banner">
              <LockKeyhole size={22} />
              <p>
                Only authorized league administrators can open this proof.
                Coaches see progress, not the document. No facial recognition or
                Meta AI processing is used. Stored copies are deleted under the
                league's {state.retention_days}-day retention policy; the
                eligibility decision and audit history remain.
              </p>
            </div>
            {state.can_submit ? (
              <form className="form-grid" onSubmit={submit}>
                <label className="field">
                  <span>Guardian full name</span>
                  <input
                    name="guardian_name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>Relationship to child</span>
                  <select name="relationship" required>
                    <option value="parent">Parent</option>
                    <option value="legal guardian">Legal guardian</option>
                  </select>
                </label>
                <label className="field">
                  <span>Proof of age type</span>
                  <select name="document_type" required>
                    {state.allowed_document_types.map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Proof of age photo</span>
                  <input
                    name="proof"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                  />
                </label>
                <p className="form-note">
                  Photo of an accepted birth certificate, passport or government
                  ID. Make the child's name and date of birth readable. Cover
                  unrelated identification numbers and addresses. JPEG, PNG or
                  WebP · maximum 6 MB. All development/demo uploads must be
                  synthetic and clearly marked.
                </p>
                <label className="checkbox-label">
                  <input name="confirmed" type="checkbox" required /> I confirm
                  the recorded name and date of birth are correct and match the
                  proof. If incorrect, I will contact the coach before
                  submitting.
                </label>
                <label className="checkbox-label">
                  <input name="consent" type="checkbox" required /> I am the
                  parent or legal guardian. I consent to the league collecting
                  and reviewing this proof solely for age eligibility, retaining
                  it for the stated period, and keeping the decision audit.
                </label>
                <Button disabled={busy}>
                  <Upload size={16} />
                  {busy
                    ? "Uploading securely…"
                    : "Submit proof and guardian consent"}
                </Button>
              </form>
            ) : (
              <div className="guardian-status">
                <CheckCheck size={24} />
                <p>
                  {state.status === "approved"
                    ? "Your child’s document and eligibility have been approved by the league."
                    : state.status === "pending"
                      ? "Your submission is pending administrator review. No automatic verification decision has been made."
                      : "Submissions are closed for this invitation. Contact the coach if you need assistance."}
                </p>
              </div>
            )}
            <p className="small-muted">
              Invitation expires {new Date(state.expires_at).toLocaleString()}.
              Verification deadline: {new Date(state.deadline).toLocaleString()}
              .
            </p>
            <div className="inline-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  setNotice("");
                  try {
                    setState(await api());
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Refresh verification status
              </Button>
              {state.guardian_consent && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("withdraw_consent", {
                        invitation_id: state.invitation_id,
                      });
                      setState(await api());
                      setNotice(
                        "Consent withdrawn. Eligibility is blocked until the league resolves it.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Withdraw guardian consent
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={async () => {
                  await fetch("/api/guardian", { method: "DELETE" });
                  setState(null);
                  setNotice(
                    "Private session closed. Reopen your invitation to return.",
                  );
                }}
              >
                Close private session
              </Button>
            </div>
          </>
        )}
      </section>
      <p className="guardian-footer">
        Your invitation is private. Do not forward it. If you were not expecting
        it, contact your coach.
      </p>
    </main>
  );
}
