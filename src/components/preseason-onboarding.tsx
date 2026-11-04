"use client";
import {
  useCallback,
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import { Button } from "./ui/button";
import {
  CheckCheck,
  FileImage,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { PreseasonData, PreseasonQuestionnaire } from "@/lib/preseason";
import { DocumentScreeningPanel } from "./document-screening-panel";
import { PreseasonRoster } from "./preseason-roster";
import { SeasonRules } from "./season-rules";
import { DeclarationReviews } from "./preseason-declaration-reviews";
type Props = {
  league: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onChanged: () => Promise<void>;
  metaEnabled: boolean;
  signedIn: boolean;
  onOpenLaunchpad?: () => void;
  divisions: {
    id: string;
    name: string;
    tier: number;
    age_category?: string;
  }[];
};
function Section({
  title,
  id,
  description,
  children,
}: {
  title: string;
  id?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="panel preseason-section">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
        "aria-label": label,
      })}
    </label>
  );
}
const documentType = (type: string) => type.replaceAll("_", " ");
export function PreseasonOnboarding({
  league,
  api,
  onChanged,
  metaEnabled,
  signedIn,
  divisions,
  onOpenLaunchpad,
}: Props) {
  const [data, setData] = useState<PreseasonData | null>(null),
    [team, setTeam] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(false),
    [section, setSection] = useState("teams"),
    [registering, setRegistering] = useState(false),
    [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    try {
      setData(await api(`/api/preseason?league=${league}`));
    } catch {
      setData(null);
      setNotice(
        "Preseason could not load. Refresh preseason or check your league access.",
      );
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api, league]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (data && team && !data.teams.some((t) => t.id === team)) setTeam("");
  }, [data, team]);
  const act = async (fn: () => Promise<any>, message: string) => {
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const result = await fn();
      setNotice(message);
      await load();
      await onChanged();
      return result;
    } catch (e) {
      setNotice((e as Error).message);
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const command = (action: string, payload: unknown) =>
    api("/api/preseason", {
      method: "POST",
      body: JSON.stringify({ league, action, payload }),
    });
  const selected = data?.teams.find((t) => t.id === team),
    questionnaire = data?.questionnaires.find((q) => q.team_id === team),
    q = questionnaire?.data ?? {};
  const allDivisions = data?.divisions ?? divisions,
    ageCategories = [
      ...new Set(allDivisions.map((d) => d.age_category ?? "U14")),
    ];
  const save = async (submit: boolean) => {
    if (!form.current) return;
    const f = new FormData(form.current),
      values: Record<string, unknown> = {};
    for (const [name, value] of f.entries()) {
      if (name === "name") continue;
      if (
        ["ageCategory", "previousLeague", "previousDivision", "notes"].includes(
          name,
        )
      )
        values[name] = String(value);
      else if (String(value) !== "") values[name] = Number(value);
    }
    const result = await act(
      () =>
        command("save_questionnaire", {
          team_id: team || null,
          name: selected?.name ?? f.get("name"),
          data: values,
          submit,
        }),
      submit
        ? "Questionnaire submitted for administrator placement review."
        : "Draft saved. You can return to finish it later.",
    );
    if (result?.team_id) {
      setTeam(result.team_id);
      setRegistering(false);
    }
  };
  const pendingDocuments =
    data?.documents.filter(
      (d) =>
        d.status === "submitted" ||
        (d.status === "approved" &&
          data.players.some(
            (p) => p.id === d.player_id && p.verification_status === "pending",
          )),
    ) ?? [];
  const metrics = data
    ? [
        ["Teams registered", data.teams.length],
        [
          "Players awaiting verification",
          data.players.filter(
            (p) =>
              p.active &&
              !["approved", "declaration_approved"].includes(
                p.verification_status,
              ),
          ).length,
        ],
        ["Documents awaiting review", pendingDocuments.length],
        [
          "Teams ready to compete",
          data.settings.enabled
            ? data.readiness.filter((r) => r.eligible_for_scheduling).length
            : "Legacy mode",
        ],
      ]
    : [];
  if (!signedIn)
    return (
      <Section
        title="Your preseason starts here"
        description="Coaches sign in to save an assessment and manage a roster. Guardians use their private invitation link."
      >
        <p>
          Sign in using the account controls to begin. Birth dates and documents
          are never public.
        </p>
      </Section>
    );
  if (loading)
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" /> Loading preseason…
      </div>
    );
  return (
    <div className="preseason-stack preseason-workspace">
      <header className="preseason-intro">
        <div>
          <p className="eyebrow">BEFORE THE FIRST TIP-OFF</p>
          <h2>Prepare teams for competition.</h2>
          <p>
            Set the rules, prepare each roster, then review player eligibility.
          </p>
        </div>
        <div className="inline-actions">
          {onOpenLaunchpad && data?.role === "admin" && (
            <Button variant="secondary" onClick={onOpenLaunchpad}>
              League configuration
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh preseason
          </Button>
        </div>
      </header>
      {notice && (
        <div
          role={error ? "alert" : "status"}
          className={`notice ${error ? "notice-error" : ""}`}
        >
          {notice}
        </div>
      )}
      {data && (
        <>
          <div className="preseason-metrics">
            {metrics.map(([label, count]) => (
              <div className="panel" key={label}>
                <small>{label}</small>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {!data.settings.enabled && (
            <div className="notice">
              <b>Legacy scheduling policy</b>
              <p>
                Preseason readiness is not enforced for this season. Existing
                basic roster checks are not document verification.{" "}
                {data.role === "admin"
                  ? "Review season rules before enabling checks for future schedule drafts."
                  : "Ask your administrator about this season’s requirements."}
              </p>
            </div>
          )}
          <nav className="preseason-nav" aria-label="Preseason sections">
            {[
              ...(data.role === "admin"
                ? [["rules", "Season rules & eligibility"]]
                : []),
              ["teams", "Teams & players"],
              ["verification", "Age verification"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant="secondary"
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {label}
              </Button>
            ))}
          </nav>
          <div hidden={section !== "rules"}>
            <section className="panel preseason-section">
              {data.role === "admin" && (
                <SeasonRules
                  key={String(data.settings.rules_version)}
                  data={data}
                  busy={busy}
                  command={command}
                  act={act}
                />
              )}
            </section>
          </div>
          <div hidden={section !== "teams"} className="preseason-team-content">
            <Section
              title="Teams & players"
              description="Choose a team to see its assessment, roster and guardian links, or start a new registration."
            >
              <div className="preseason-team-picker">
                <Field label="Preseason team">
                  <select
                    value={team}
                    onChange={(e) => {
                      setTeam(e.target.value);
                      setRegistering(false);
                    }}
                  >
                    <option value="">Select a team…</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  variant={registering || selected ? "secondary" : "default"}
                  disabled={busy}
                  onClick={() => {
                    setTeam("");
                    setRegistering(true);
                  }}
                >
                  Register a new team
                </Button>
              </div>
              {!selected && !registering && (
                <div className="verification-empty">
                  <b>Start with a team.</b>
                  <p>
                    Select an existing team above to manage players and guardian
                    links. For a new team, choose Register a new team to save
                    its coach assessment.
                  </p>
                </div>
              )}
              {selected && (
                <Button
                  variant="secondary"
                  className="preseason-roster-jump"
                  onClick={() => {
                    const heading = document.getElementById("roster-heading");
                    heading?.focus();
                    heading?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  Manage roster & guardian links
                </Button>
              )}
              {selected && (
                <div className="preseason-team-status">
                  <b>{selected.name}</b>
                  <span className="badge badge-orange">
                    Registration: {selected.status}
                  </span>
                  <p>
                    {data.readiness
                      .find((r) => r.team_id === team)
                      ?.blockers.join(" · ") ||
                      "Review the roster and placement below."}
                  </p>
                </div>
              )}
            </Section>
            <details className="panel preseason-readiness">
              <summary>All-team readiness</summary>{" "}
              {data && (
                <Section
                  title="Team readiness"
                  description="Questionnaire, placement, roster and player eligibility determine readiness. Select a team to work on its next step."
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Questionnaire</th>
                          <th>Placement</th>
                          <th>Roster</th>
                          <th>Documents verified</th>
                          <th>Scheduling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.readiness.map((r) => (
                          <tr key={r.team_id}>
                            <td>
                              <button
                                className="text-link"
                                onClick={() => {
                                  setTeam(r.team_id);
                                  setRegistering(false);
                                }}
                              >
                                {
                                  data.teams.find((t) => t.id === r.team_id)
                                    ?.name
                                }
                              </button>
                            </td>
                            <td>
                              {r.questionnaire_completed
                                ? "Submitted"
                                : "Draft / missing"}
                            </td>
                            <td>
                              {r.placement_approved ? "Approved" : "Pending"}
                            </td>
                            <td>
                              {r.roster_submitted ? "Submitted" : "Pending"}
                            </td>
                            <td>
                              {r.verified}/{r.players}
                            </td>
                            <td>
                              <b
                                className={
                                  r.eligible_for_scheduling
                                    ? "text-green"
                                    : "text-orange"
                                }
                              >
                                {!data.settings.enabled
                                  ? "Legacy scheduling"
                                  : r.eligible_for_scheduling
                                    ? "Ready"
                                    : "Blocked"}
                              </b>
                              <small>{r.blockers.join(" · ")}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
            </details>
            {(selected || registering) && (
              <details
                className="panel preseason-assessment"
                open={
                  registering ||
                  questionnaire?.status !== "submitted" ||
                  (data.role === "admin" && selected?.status === "pending")
                }
              >
                <summary>
                  Coach assessment and placement
                  {questionnaire ? ` · ${questionnaire.status}` : ""}
                </summary>{" "}
                <Section
                  title="Coach assessment and placement"
                  description="Save a draft, return later, then submit a comprehensive assessment. A league administrator owns the final placement."
                >
                  <form
                    className="form-grid"
                    ref={form}
                    key={team + ":" + (questionnaire?.revision ?? 0)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(true);
                    }}
                  >
                    <Field label="Preseason team name">
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        defaultValue={selected?.name ?? ""}
                        readOnly={Boolean(selected)}
                      />
                    </Field>
                    <div className="preseason-fields">
                      <Field label="Team age category">
                        <select
                          name="ageCategory"
                          defaultValue={q.ageCategory ?? ageCategories[0]}
                        >
                          {ageCategories.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Previous league">
                        <input
                          name="previousLeague"
                          maxLength={100}
                          defaultValue={q.previousLeague ?? ""}
                          placeholder="New team if none"
                        />
                      </Field>
                      <Field label="Previous division">
                        <input
                          name="previousDivision"
                          maxLength={100}
                          defaultValue={q.previousDivision ?? ""}
                        />
                      </Field>
                    </div>
                    <div className="preseason-fields">
                      {(["wins", "losses", "draws"] as const).map((name) => (
                        <Field key={name} label={`Previous season ${name}`}>
                          <input
                            type="number"
                            name={name}
                            min={0}
                            max={100}
                            required
                            defaultValue={q[name] ?? 0}
                          />
                        </Field>
                      ))}
                    </div>
                    <div className="two-fields">
                      <Field label="Typical winning margin">
                        <input
                          type="number"
                          name="winningMargin"
                          min={0}
                          max={60}
                          required
                          defaultValue={q.winningMargin ?? 0}
                        />
                      </Field>
                      <Field label="Typical losing margin">
                        <input
                          type="number"
                          name="losingMargin"
                          min={0}
                          max={60}
                          required
                          defaultValue={q.losingMargin ?? 0}
                        />
                      </Field>
                    </div>
                    <div className="preseason-fields">
                      <Field label="Returning player percentage">
                        <input
                          type="number"
                          name="returningPercent"
                          min={0}
                          max={100}
                          required
                          defaultValue={q.returningPercent ?? 0}
                        />
                      </Field>
                      <Field label="Experienced competitive players">
                        <input
                          type="number"
                          name="competitivePlayers"
                          min={0}
                          max={20}
                          required
                          defaultValue={q.competitivePlayers ?? 0}
                        />
                      </Field>
                      <Field label="Competitive experience level">
                        <select
                          name="experience"
                          defaultValue={q.experience ?? 1}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                              {n === 1
                                ? " · New to organized competition"
                                : n === 5
                                  ? " · Established representative team"
                                  : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="two-fields">
                      <Field label="Years together">
                        <input
                          name="yearsTogether"
                          type="number"
                          min={0}
                          max={15}
                          required
                          defaultValue={q.yearsTogether ?? 0}
                        />
                      </Field>
                      <Field label="Practices per week">
                        <input
                          name="practicesPerWeek"
                          type="number"
                          min={0}
                          max={7}
                          required
                          defaultValue={q.practicesPerWeek ?? 1}
                        />
                      </Field>
                    </div>
                    <div className="two-fields">
                      <Field label="Preferred initial division tier">
                        <select
                          name="preferredTier"
                          defaultValue={q.preferredTier ?? 3}
                        >
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              Tier {n}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Coach placement confidence (%)">
                        <input
                          name="coachConfidence"
                          type="number"
                          min={0}
                          max={100}
                          required
                          defaultValue={q.coachConfidence ?? 50}
                        />
                      </Field>
                    </div>
                    <Field label="Additional coach context">
                      <textarea
                        name="notes"
                        maxLength={2000}
                        defaultValue={q.notes ?? ""}
                        placeholder="Describe team continuity and prior competition. Do not include child names, birth dates, guardian information or documents."
                      />
                    </Field>
                    <div className="inline-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void save(false)}
                      >
                        Save questionnaire draft
                      </Button>
                      <Button
                        disabled={busy}
                        variant={
                          questionnaire?.status === "submitted"
                            ? "secondary"
                            : "default"
                        }
                      >
                        Submit questionnaire
                      </Button>
                      {questionnaire && (
                        <span className="badge">
                          {questionnaire.status} · revision{" "}
                          {questionnaire.revision}
                        </span>
                      )}
                    </div>
                  </form>
                  {questionnaire?.recommendation && (
                    <div className="preseason-recommendation">
                      <h3>Initial placement evidence</h3>
                      <span className="badge badge-green">
                        Deterministic rubric · Tier{" "}
                        {questionnaire.recommendation.tier}
                      </span>
                      <p>{questionnaire.recommendation.explanation}</p>
                      <p>
                        Evidence confidence:{" "}
                        {Math.round(
                          questionnaire.recommendation.confidence * 100,
                        )}
                        % · Rating {questionnaire.recommendation.rating}
                      </p>
                      <ul>
                        {questionnaire.recommendation.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                      {questionnaire.recommendation.flags.length > 0 && (
                        <div className="notice notice-error">
                          <ul>
                            {questionnaire.recommendation.flags.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="preseason-meta">
                        <h3>
                          <Sparkles size={18} /> Muse Spark placement review
                        </h3>
                        {questionnaire.meta_analysis ? (
                          <>
                            <p>{questionnaire.meta_analysis.summary}</p>
                            <p>
                              Meta suggested tier{" "}
                              {questionnaire.meta_analysis.recommendedTier} ·
                              model confidence{" "}
                              {Math.round(
                                questionnaire.meta_analysis.confidence * 100,
                              )}
                              %
                            </p>
                            <ul>
                              {[
                                ...questionnaire.meta_analysis.inconsistencies,
                                ...questionnaire.meta_analysis
                                  .clarifyingQuestions,
                              ].map((v, i) => (
                                <li key={i}>{v}</li>
                              ))}
                            </ul>
                            <small>
                              Actual model output; it cannot approve or override
                              placement.
                            </small>
                          </>
                        ) : (
                          <p>
                            {metaEnabled
                              ? "Ask Meta to interpret the questionnaire and identify uncertain or inconsistent evidence."
                              : "Live inference is paused. No model response has been recorded for this assessment."}
                          </p>
                        )}
                        <Button
                          variant="secondary"
                          disabled={busy || !metaEnabled}
                          onClick={() =>
                            void act(
                              () =>
                                api("/api/placement", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    league,
                                    team_id: team,
                                  }),
                                }),
                              "Meta interpretation saved with its model response evidence.",
                            )
                          }
                        >
                          <Sparkles size={15} /> Interpret with Muse Spark
                        </Button>
                      </div>
                      {data?.role === "admin" &&
                        selected?.status === "pending" && (
                          <form
                            className="form-grid"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              await act(
                                () =>
                                  api("/api/league", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      league,
                                      action: "approve_team",
                                      payload: {
                                        team_id: team,
                                        tier: Number(f.get("placement_tier")),
                                        override_reason:
                                          f.get("override_reason"),
                                      },
                                    }),
                                  }),
                                "Placement approved by league administrator.",
                              );
                            }}
                          >
                            <Field label="Administrator placement tier">
                              <select
                                name="placement_tier"
                                defaultValue={questionnaire.recommendation.tier}
                              >
                                {allDivisions
                                  .filter(
                                    (d) =>
                                      (d.age_category ?? "U14") ===
                                      selected.age_category,
                                  )
                                  .map((d) => (
                                    <option key={d.id} value={d.tier}>
                                      {d.name}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <Field label="Placement review or override reason">
                              <textarea
                                name="override_reason"
                                placeholder="At least 10 characters when overriding the evidence recommendation."
                              />
                            </Field>
                            <Button disabled={busy}>
                              <CheckCheck size={16} /> Approve preseason
                              placement
                            </Button>
                          </form>
                        )}
                    </div>
                  )}
                </Section>
              </details>
            )}
            {selected && data && (
              <PreseasonRoster
                key={team}
                league={league}
                team={selected}
                data={data}
                busy={busy}
                api={api}
                command={command}
                act={act}
              />
            )}
          </div>
          <div hidden={section !== "verification"}>
            {data?.role === "admin" && (
              <Section
                id="preseason-document-queue"
                title="Age verification"
                description="Review guardian submissions, investigate flags and record a human eligibility decision. No automatic approval or authenticity claim is made."
              >
                <DeclarationReviews
                  data={data}
                  busy={busy}
                  command={command}
                  act={act}
                />
                {data.documents
                  .filter(
                    (d) =>
                      d.status === "submitted" ||
                      (d.status === "approved" &&
                        data.players.some(
                          (p) =>
                            p.id === d.player_id &&
                            p.verification_status === "pending",
                        )),
                  )
                  .map((doc) => {
                    const p = data.players.find((p) => p.id === doc.player_id)!;
                    return (
                      <article className="panel preseason-review" key={doc.id}>
                        <h3>
                          {p.display_name} · {documentType(doc.document_type)}
                        </h3>
                        <p>
                          {data.teams.find((t) => t.id === p.team_id)?.name} ·
                          DOB {p.birth_date} · Age {p.age} · Consent{" "}
                          {p.guardian_consent ? "provided" : "missing"}
                        </p>
                        <p>
                          Guardian attestation:{" "}
                          {doc.guardian_name ?? "Not recorded"} ·{" "}
                          {doc.relationship ?? "—"}
                          {doc.consent_at
                            ? ` · ${new Date(doc.consent_at).toLocaleString()}`
                            : ""}
                          . Details confirmed:{" "}
                          {doc.confirmed_details ? "yes" : "no"}.
                        </p>
                        {(!p.age_eligible ||
                          p.duplicate_identity ||
                          doc.duplicate_document) && (
                          <div className="notice notice-error">
                            {!p.age_eligible && "Age eligibility failed. "}
                            {(p.duplicate_identity || doc.duplicate_document) &&
                              "Possible duplicate identity or document. Investigate before deciding."}
                          </div>
                        )}
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              const result = await command("open_document", {
                                document_id: doc.id,
                              });
                              setPreview({ id: doc.id, url: result.url });
                            }, "Private proof opened for reviewer inspection.")
                          }
                        >
                          <FileImage size={16} /> Open private proof of age
                        </Button>
                        {preview?.id === doc.id && (
                          <div className="preseason-document">
                            <img
                              src={preview.url}
                              alt={`Private proof of age for ${p.display_name}`}
                              referrerPolicy="no-referrer"
                            />
                            <small>
                              Private URL expires after 60 seconds. Open again
                              if needed.
                            </small>
                          </div>
                        )}
                        <DocumentScreeningPanel
                          league={league}
                          document={doc.id}
                          api={api}
                          onChanged={load}
                          autoLoad={preview?.id === doc.id}
                        />
                        <form
                          className="form-grid"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            await act(
                              () =>
                                command("review_document", {
                                  document_id: doc.id,
                                  decision: f.get("decision"),
                                  reason: f.get("reason"),
                                  document_checked: f.get("checked") === "on",
                                  duplicate_acknowledged:
                                    f.get("duplicate") === "on",
                                }),
                              "Administrator verification decision recorded.",
                            );
                            setPreview(null);
                          }}
                        >
                          <Field
                            label={`Review decision for ${p.display_name}`}
                          >
                            <select name="decision">
                              <option value="resubmission">
                                Request resubmission
                              </option>
                              <option value="approved">
                                Approve verified document and eligibility
                              </option>
                              <option value="rejected">
                                Reject verification
                              </option>
                            </select>
                          </Field>
                          <Field label={`Review reason for ${p.display_name}`}>
                            <textarea
                              name="reason"
                              required
                              minLength={10}
                              maxLength={1000}
                            />
                          </Field>
                          <label className="checkbox-label">
                            <input
                              name="checked"
                              type="checkbox"
                              disabled={preview?.id !== doc.id}
                            />{" "}
                            I inspected the original proof, matched name and
                            birth date, and checked guardian consent.
                          </label>
                          <label className="checkbox-label">
                            <input name="duplicate" type="checkbox" /> I
                            investigated any duplicate flags and explained the
                            decision in my reason.
                          </label>
                          <Button disabled={busy}>
                            <ShieldCheck size={16} /> Record verification
                            decision
                          </Button>
                        </form>
                      </article>
                    );
                  })}
                {!data.documents.some(
                  (d) =>
                    d.status === "submitted" ||
                    (d.status === "approved" &&
                      data.players.some(
                        (p) =>
                          p.id === d.player_id &&
                          p.verification_status === "pending",
                      )),
                ) && (
                  <p className="small-muted">
                    {data.settings.proof_required === false
                      ? "No documents awaiting review. This league uses guardian declarations; pending declarations appear above."
                      : "No documents awaiting review. Coaches invite guardians from the roster; submissions appear here after the guardian sends a permitted proof. A declared birth date alone creates no document to inspect."}
                  </p>
                )}
                <details>
                  <summary>Review history and document retention</summary>
                  <p className="small-muted">
                    Expired originals are removed by daily cleanup. You can also
                    run due deletion now. Reviewer links expire within 60
                    seconds; a retained eligibility decision does not retain its
                    proof image.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () =>
                          api("/api/retention", {
                            method: "POST",
                            body: JSON.stringify({ league }),
                          }),
                        "Due-document deletion completed. Review individual file states below.",
                      )
                    }
                  >
                    Run due document deletion
                  </Button>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Player / proof</th>
                          <th>State</th>
                          <th>Delete by</th>
                          <th>Control</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.documents.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {
                                data.players.find((p) => p.id === d.player_id)
                                  ?.display_name
                              }
                              <small>{documentType(d.document_type)}</small>
                            </td>
                            <td>{d.status}</td>
                            <td>
                              {new Date(d.retain_until).toLocaleDateString()}
                            </td>
                            <td>
                              {!["deleted", "deleting", "reserved"].includes(
                                d.status,
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void act(
                                      () =>
                                        command("delete_document", {
                                          document_id: d.id,
                                        }),
                                      "Private document bytes permanently deleted; review history retained.",
                                    )
                                  }
                                >
                                  Delete private document
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="audit-list">
                    {data.reviews.map((r) => (
                      <div key={r.id}>
                        <ShieldCheck size={14} />
                        <span>
                          <b>
                            {
                              data.players.find((p) => p.id === r.player_id)
                                ?.display_name
                            }{" "}
                            · {r.decision}
                          </b>
                          <small>
                            {r.reason} ·{" "}
                            {new Date(r.created_at).toLocaleString()}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </Section>
            )}
            {data.role !== "admin" && (
              <Section
                title="Age verification"
                description="Guardians submit privately. Only league administrators can inspect originals and approve eligibility."
              >
                <p>
                  Select a team in Teams & players to invite guardians and check
                  each player's progress. Coaches cannot open documents or
                  record verification decisions.
                </p>
                <Button onClick={() => setSection("teams")}>
                  Choose a team
                </Button>
              </Section>
            )}
            {data.role === "admin" && (
              <details className="panel preseason-section">
                <summary>Players still needing verification</summary>
                {data.players
                  .filter(
                    (p) =>
                      p.active &&
                      !["approved", "declaration_approved"].includes(
                        p.verification_status,
                      ),
                  )
                  .map((p) => (
                    <div className="preseason-needs-review" key={p.id}>
                      <span>
                        <b>{p.display_name}</b> ·{" "}
                        {data.teams.find((t) => t.id === p.team_id)?.name}
                        <small>
                          {p.verification_status.replaceAll("_", " ")} ·{" "}
                          {p.age_eligible
                            ? "Within age range"
                            : "Check age eligibility"}
                          {p.duplicate_identity ? " · Possible duplicate" : ""}
                        </small>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setTeam(p.team_id);
                          setRegistering(false);
                          setSection("teams");
                        }}
                      >
                        View team
                      </Button>
                    </div>
                  ))}
                {!data.players.some(
                  (p) =>
                    p.active &&
                    !["approved", "declaration_approved"].includes(
                      p.verification_status,
                    ),
                ) && <p>No active players awaiting verification.</p>}
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}
