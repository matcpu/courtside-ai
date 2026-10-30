"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ShieldCheck,
  CheckCheck,
  Upload,
  LockKeyhole,
  Camera,
} from "lucide-react";
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
    [notice, setNotice] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [uploadStage, setUploadStage] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function chooseFile(selected: File | undefined) {
    setError("");
    setNotice("");
    if (!selected) return;
    if (
      !selected.size ||
      selected.size > 6 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(selected.type)
    ) {
      setFile(null);
      setError(
        "Choose a JPEG, PNG or WebP image under 6 MB. PDF and HEIC files are not supported; export a supported image or take a photo.",
      );
      return;
    }
    setFile(selected);
  }
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
    const f = new FormData(e.currentTarget);
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
      setUploadStage("Preparing a secure private upload…");
      const reserved = await api("reserve_upload", {
        invitation_id: state.invitation_id,
        document_type: f.get("document_type"),
        mime: file.type,
      });
      setUploadStage("Uploading your document privately…");
      const uploaded = await browserSupabase()
        .storage.from("youth-documents")
        .uploadToSignedUrl(reserved.path, reserved.uploadToken, file, {
          contentType: file.type,
          cacheControl: "0",
        });
      if (uploaded.error)
        throw new Error("The private upload failed. Please retry.");
      setUploadStage(
        "Upload received. Checking the image and recording consent; this may take a few moments…",
      );
      await api("submit", {
        invitation_id: state.invitation_id,
        document_id: reserved.document_id,
        guardian_name: f.get("guardian_name"),
        relationship: f.get("relationship"),
        consent: f.get("consent") === "on",
        confirmed_details: f.get("confirmed") === "on",
      });
      setState(await api());
      setFile(null);
      setNotice(
        "Proof and consent submitted. An authorized league administrator must now review them.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setUploadStage("");
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
              <form className="form-grid" onSubmit={submit} aria-busy={busy}>
                <h2>
                  {state.status === "resubmission"
                    ? "Send a replacement document"
                    : "Upload proof and provide consent"}
                </h2>
                {state.status === "resubmission" && (
                  <p className="notice">
                    Read the league review reason above, then choose a new
                    image. Your previous submission is kept in the review
                    history; it cannot be silently replaced or approved.
                  </p>
                )}
                <label className="field">
                  <span>Guardian full name</span>
                  <input
                    name="guardian_name"
                    disabled={busy}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>Relationship to child</span>
                  <select name="relationship" required disabled={busy}>
                    <option value="parent">Parent</option>
                    <option value="legal guardian">Legal guardian</option>
                  </select>
                </label>
                <label className="field">
                  <span>Proof of age type</span>
                  <select name="document_type" required disabled={busy}>
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
                    required={!file}
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => chooseFile(e.currentTarget.files?.[0])}
                  />
                </label>
                <label className="field guardian-camera">
                  <span>
                    <Camera size={16} /> Take a photo with your camera (where
                    supported)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={busy}
                    onChange={(e) => chooseFile(e.currentTarget.files?.[0])}
                  />
                </label>
                <p className="form-note">
                  Photo of an accepted birth certificate, passport or government
                  ID. Make the child's name and date of birth readable. Cover
                  unrelated identification numbers and addresses. JPEG, PNG or
                  WebP · maximum 6 MB. PDFs and HEIC are not supported. Choose
                  an existing image above or use the separate camera option on
                  supported devices. All development/demo uploads must be
                  synthetic and clearly marked.
                </p>
                {file && preview && (
                  <div className="guardian-proof-preview">
                    <h3>Check your selected document</h3>
                    <p>
                      {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <img
                      src={preview}
                      alt="Selected proof of age preview"
                      onError={() => {
                        setFile(null);
                        setError(
                          "This image could not be previewed. Choose an undamaged JPEG, PNG or WebP image.",
                        );
                      }}
                    />
                    <p>
                      Make sure the full name and date of birth are readable.
                      Selecting a file does not submit it.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setFile(null);
                        document
                          .querySelectorAll<HTMLInputElement>(
                            'input[type="file"]',
                          )
                          .forEach((input) => {
                            input.value = "";
                          });
                      }}
                    >
                      Remove selected document
                    </Button>
                  </div>
                )}
                <label className="checkbox-label">
                  <input
                    name="confirmed"
                    type="checkbox"
                    required
                    disabled={busy}
                  />{" "}
                  I confirm the recorded name and date of birth are correct and
                  match the proof. If incorrect, I will contact the coach before
                  submitting.
                </label>
                <label className="checkbox-label">
                  <input
                    name="consent"
                    type="checkbox"
                    required
                    disabled={busy}
                  />{" "}
                  I am the parent or legal guardian. I consent to the league
                  collecting and reviewing this proof solely for age
                  eligibility, retaining it for the stated period, and keeping
                  the decision audit.
                </label>
                {uploadStage && (
                  <div role="status" className="guardian-upload-progress">
                    <progress aria-label="Secure document submission progress" />
                    <p>{uploadStage}</p>
                    <p>
                      Keep this page open. Verification stays pending until an
                      administrator decides.
                    </p>
                  </div>
                )}
                <Button disabled={busy || !file}>
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
                  setFile(null);
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
