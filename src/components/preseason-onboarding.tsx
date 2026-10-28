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
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  FileImage,
  Link as LinkIcon,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { PreseasonData, PreseasonQuestionnaire } from "@/lib/preseason";
type Props = {
  league: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onChanged: () => Promise<void>;
  metaEnabled: boolean;
  signedIn: boolean;
  divisions: {
    id: string;
    name: string;
    tier: number;
    age_category?: string;
  }[];
};
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel preseason-section">
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
const localDate = (value: unknown) => {
  if (!value) return "";
  const d = new Date(String(value));
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const documentType = (type: string) => type.replaceAll("_", " ");
export function PreseasonOnboarding({
  league,
  api,
  onChanged,
  metaEnabled,
  signedIn,
  divisions,
}: Props) {
  const [data, setData] = useState<PreseasonData | null>(null),
    [team, setTeam] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(false),
    [invitation, setInvitation] = useState<{
      url: string;
      expires: string;
      email: string;
    } | null>(null),
    [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    try {
      setData(await api(`/api/preseason?league=${league}`));
    } catch {
      setData(null);
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
  const roster =
    data?.players.filter((p) => p.team_id === team && p.active) ?? [];
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
    if (result?.team_id) setTeam(result.team_id);
  };
  const metrics = data
    ? [
        ["Registered teams", data.teams.length],
        [
          "Questionnaires submitted",
          data.questionnaires.filter((q) => q.status === "submitted").length,
        ],
        [
          "Rosters submitted",
          data.readiness.filter((r) => r.roster_submitted).length,
        ],
        [
          "Pending player reviews",
          data.players.filter(
            (p) => p.active && p.verification_status === "pending",
          ).length,
        ],
        [
          "Ready for scheduling",
          data.readiness.filter((r) => r.eligible_for_scheduling).length,
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
    <div className="preseason-stack">
      <div className="inline-actions">
        <Button variant="secondary" disabled={busy} onClick={() => void load()}>
          Refresh preseason
        </Button>
      </div>
      {notice && (
        <div
          role={error ? "alert" : "status"}
          className={`notice ${error ? "notice-error" : ""}`}
        >
          {notice}
        </div>
      )}
      <div className="info-banner">
        <ShieldCheck />
        <div>
          <b>One preseason journey. Human review where it matters.</b>
          <p>
            Coach assessment → placement approval → guardian proof and consent →
            document review → scheduling readiness. Proof-of-age documents are
            never sent to Meta.
          </p>
        </div>
      </div>
      {data && !data.settings.enabled && (
        <div className="notice notice-error">
          Legacy mode: this season does not enforce document readiness.
          Administrators can enable preseason requirements below. Demo seed
          records are not document-verified.
        </div>
      )}
      {!!metrics.length && (
        <div className="preseason-metrics">
          {metrics.map(([label, count]) => (
            <div className="panel" key={label}>
              <small>{label}</small>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
      {data?.role === "admin" && (
        <details
          className="panel preseason-settings"
          open={data.settings.registration_status === "draft"}
        >
          <summary>
            <CalendarDays size={18} /> Season setup and eligibility rules
          </summary>
          <form
            className="form-grid"
            key={String(data.settings.rules_version)}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await act(
                () =>
                  command("configure", {
                    enabled: f.get("enabled") === "on",
                    season_name: f.get("season_name"),
                    season_start: f.get("season_start"),
                    cutoff_date: f.get("cutoff_date"),
                    registration_status: f.get("registration_status"),
                    questionnaire_deadline: new Date(
                      String(f.get("questionnaire_deadline")),
                    ).toISOString(),
                    roster_deadline: new Date(
                      String(f.get("roster_deadline")),
                    ).toISOString(),
                    verification_deadline: new Date(
                      String(f.get("verification_deadline")),
                    ).toISOString(),
                    min_roster: Number(f.get("min_roster")),
                    max_roster: Number(f.get("max_roster")),
                    document_retention_days: Number(f.get("retention")),
                    allowed_document_types: f.getAll("document_types"),
                  }),
                "Season rules saved. Age-rule changes require renewed administrator review.",
              );
            }}
          >
            <label className="checkbox-label">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={Boolean(data.settings.enabled)}
              />{" "}
              Enforce preseason readiness before scheduling
            </label>
            <div className="two-fields">
              <Field label="Season name">
                <input
                  name="season_name"
                  required
                  defaultValue={String(data.settings.season_name)}
                />
              </Field>
              <Field label="Opening weekend">
                <input
                  name="season_start"
                  type="date"
                  required
                  defaultValue={String(data.settings.season_start)}
                />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="Age cutoff date">
                <input
                  name="cutoff_date"
                  type="date"
                  required
                  defaultValue={String(data.settings.cutoff_date)}
                />
              </Field>
              <Field label="Registration status">
                <select
                  name="registration_status"
                  defaultValue={String(data.settings.registration_status)}
                >
                  <option value="draft">Draft · registration closed</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            </div>
            <div className="preseason-fields">
              {["questionnaire", "roster", "verification"].map((name) => (
                <Field
                  key={name}
                  label={`${name[0].toUpperCase() + name.slice(1)} deadline (device timezone)`}
                >
                  <input
                    name={`${name}_deadline`}
                    type="datetime-local"
                    required
                    defaultValue={localDate(data.settings[`${name}_deadline`])}
                  />
                </Field>
              ))}
            </div>
            <div className="preseason-fields">
              <Field label="Minimum active roster">
                <input
                  name="min_roster"
                  type="number"
                  min={1}
                  max={20}
                  required
                  defaultValue={Number(data.settings.min_roster)}
                />
              </Field>
              <Field label="Maximum active roster">
                <input
                  name="max_roster"
                  type="number"
                  min={1}
                  max={30}
                  required
                  defaultValue={Number(data.settings.max_roster)}
                />
              </Field>
              <Field label="Proof retention (days)">
                <input
                  name="retention"
                  type="number"
                  min={1}
                  max={30}
                  required
                  defaultValue={Number(data.settings.document_retention_days)}
                />
              </Field>
            </div>
            <fieldset>
              <legend>Acceptable proof of age</legend>
              <div className="inline-actions">
                {["birth_certificate", "passport", "government_id"].map(
                  (type) => (
                    <label className="checkbox-label" key={type}>
                      <input
                        type="checkbox"
                        name="document_types"
                        value={type}
                        defaultChecked={(
                          data.settings.allowed_document_types as string[]
                        ).includes(type)}
                      />
                      {documentType(type)}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <p className="form-note">
              Only photo formats JPEG, PNG and WebP are accepted (6 MB maximum).
              Retention deletion removes document bytes and guardian-name
              fields; the decision audit remains. Never upload real children's
              documents for a hackathon demo.
            </p>
            <Button disabled={busy}>Save season rules</Button>
          </form>
          <h3>Age categories and divisions</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Division</th>
                  <th>Category / tier</th>
                  <th>Eligible age at cutoff</th>
                </tr>
              </thead>
              <tbody>
                {data.divisions.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>
                      {d.age_category} · {d.tier}
                    </td>
                    <td>
                      {d.min_age}–{d.max_age}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await act(
                () =>
                  command("configure_division", {
                    name: f.get("division_name"),
                    age_category: f.get("category"),
                    tier: Number(f.get("tier")),
                    min_age: Number(f.get("min_age")),
                    max_age: Number(f.get("max_age")),
                  }),
                "Division saved. Affected players require eligibility review.",
              );
            }}
          >
            <div className="two-fields">
              <Field label="Division name">
                <input
                  name="division_name"
                  required
                  placeholder="U14 · Premier"
                />
              </Field>
              <Field label="Division age category">
                <input name="category" required defaultValue="U14" />
              </Field>
            </div>
            <div className="preseason-fields">
              <Field label="Division tier">
                <select name="tier">
                  <option value="1">1 · Premier</option>
                  <option value="2">2 · Competitive</option>
                  <option value="3">3 · Development</option>
                </select>
              </Field>
              <Field label="Minimum age">
                <input
                  name="min_age"
                  type="number"
                  min={0}
                  max={20}
                  defaultValue={0}
                  required
                />
              </Field>
              <Field label="Maximum age">
                <input
                  name="max_age"
                  type="number"
                  min={5}
                  max={20}
                  defaultValue={13}
                  required
                />
              </Field>
            </div>
            <Button variant="secondary" disabled={busy}>
              Save division
            </Button>
          </form>
        </details>
      )}
      {data && (
        <Section
          title="Team readiness"
          description="All active roster players must have guardian consent and an administrator document decision. Changes invalidate stale schedule drafts."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Questionnaire</th>
                  <th>Placement</th>
                  <th>Roster</th>
                  <th>Verified</th>
                  <th>Scheduling</th>
                </tr>
              </thead>
              <tbody>
                {data.readiness.map((r) => (
                  <tr key={r.team_id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setTeam(r.team_id)}
                      >
                        {data.teams.find((t) => t.id === r.team_id)?.name}
                      </button>
                    </td>
                    <td>
                      {r.questionnaire_completed
                        ? "Submitted"
                        : "Draft / missing"}
                    </td>
                    <td>{r.placement_approved ? "Approved" : "Pending"}</td>
                    <td>{r.roster_submitted ? "Submitted" : "Pending"}</td>
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
                        {r.eligible_for_scheduling ? "Ready" : "Blocked"}
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
      <Section
        title="Coach assessment and placement"
        description="Save a draft, return later, then submit a comprehensive assessment. A league administrator owns the final placement."
      >
        <Field label="Preseason team">
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setInvitation(null);
            }}
          >
            <option value="">Register a new team</option>
            {data?.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
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
              <select name="experience" defaultValue={q.experience ?? 1}>
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
              <select name="preferredTier" defaultValue={q.preferredTier ?? 3}>
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
            <Button disabled={busy}>Submit questionnaire</Button>
            {questionnaire && (
              <span className="badge">
                {questionnaire.status} · revision {questionnaire.revision}
              </span>
            )}
          </div>
        </form>
        {questionnaire?.recommendation && (
          <div className="preseason-recommendation">
            <h3>Initial placement evidence</h3>
            <span className="badge badge-green">
              Deterministic rubric · Tier {questionnaire.recommendation.tier}
            </span>
            <p>{questionnaire.recommendation.explanation}</p>
            <p>
              Evidence confidence:{" "}
              {Math.round(questionnaire.recommendation.confidence * 100)}% ·
              Rating {questionnaire.recommendation.rating}
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
                    {questionnaire.meta_analysis.recommendedTier} · model
                    confidence{" "}
                    {Math.round(questionnaire.meta_analysis.confidence * 100)}%
                  </p>
                  <ul>
                    {[
                      ...questionnaire.meta_analysis.inconsistencies,
                      ...questionnaire.meta_analysis.clarifyingQuestions,
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
                    : "Prepared integration · paused until credits are confirmed. No model response has been recorded for this assessment."}
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
                        body: JSON.stringify({ league, team_id: team }),
                      }),
                    "Meta interpretation saved with its model response evidence.",
                  )
                }
              >
                <Sparkles size={15} /> Interpret with Muse Spark
              </Button>
            </div>
            {data?.role === "admin" && selected?.status === "pending" && (
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
                            override_reason: f.get("override_reason"),
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
                          (d.age_category ?? "U14") === selected.age_category,
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
                  <CheckCheck size={16} /> Approve preseason placement
                </Button>
              </form>
            )}
          </div>
        )}
      </Section>
      {selected && data && (
        <Section
          title="Roster and guardian invitations"
          description="Coaches enter the roster. The guardian provides consent and proof. Only administrators inspect documents."
        >
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
                      action: "add_player",
                      payload: {
                        team_id: team,
                        display_name: f.get("display_name"),
                        jersey: f.get("jersey"),
                        birth_date: f.get("birth_date"),
                        guardian_consent: false,
                      },
                    }),
                  }),
                "Player added. Create a private guardian invitation next.",
              );
            }}
          >
            <div className="preseason-fields">
              <Field label="Player name (synthetic for demo)">
                <input name="display_name" required maxLength={100} />
              </Field>
              <Field label="Jersey number">
                <input name="jersey" required maxLength={4} />
              </Field>
              <Field label="Declared birth date">
                <input name="birth_date" type="date" required />
              </Field>
            </div>
            <Button variant="secondary" disabled={busy}>
              <Users size={16} /> Add preseason player
            </Button>
          </form>
          <div className="preseason-roster">
            {roster.map((p) => (
              <article className="panel" key={p.id}>
                <div className="panel-heading">
                  <div>
                    <h3>
                      #{p.jersey} {p.display_name}
                    </h3>
                    <p>
                      Declared DOB {p.birth_date} · Age {p.age} at cutoff
                    </p>
                  </div>
                  <span
                    className={`badge ${p.verification_status === "approved" ? "badge-green" : "badge-orange"}`}
                  >
                    {p.verification_status}
                  </span>
                </div>
                {!p.age_eligible && (
                  <p className="text-orange">
                    Outside current division age range; administrator approval
                    is blocked.
                  </p>
                )}
                {p.duplicate_identity && (
                  <p className="text-orange">
                    Possible duplicate roster identity. Administrator review
                    required.
                  </p>
                )}
                {p.verification_status !== "approved" && (
                  <form
                    className="form-grid"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const saved = await act(
                        () =>
                          command("invite_guardian", {
                            player_id: p.id,
                            email: f.get("guardian_email") || "",
                            send_email: f.get("send_email") === "on",
                          }),
                        "Private invitation created. Share the link only with the expected guardian.",
                      );
                      if (saved)
                        setInvitation({
                          url: saved.invitationUrl,
                          expires: saved.expires_at,
                          email: saved.emailState,
                        });
                    }}
                  >
                    <Field
                      label={`Guardian email for ${p.display_name} (optional)`}
                    >
                      <input
                        name="guardian_email"
                        type="email"
                        placeholder="guardian@example.invalid"
                      />
                    </Field>
                    <label className="checkbox-label">
                      <input name="send_email" type="checkbox" /> Send
                      invitation email if configured
                    </label>
                    <Button variant="secondary" size="sm" disabled={busy}>
                      <LinkIcon size={14} /> Create guardian invitation
                    </Button>
                  </form>
                )}
                <div className="inline-actions">
                  {data.invitations
                    .filter(
                      (i) =>
                        i.player_id === p.id &&
                        !i.revoked_at &&
                        +new Date(i.expires_at) > Date.now(),
                    )
                    .map((i) => (
                      <Button
                        key={i.id}
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              command("revoke_invitation", {
                                invitation_id: i.id,
                              }),
                            "Invitation revoked. Existing sessions can no longer access it.",
                          )
                        }
                      >
                        Revoke invitation
                      </Button>
                    ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => command("withdraw_player", { player_id: p.id }),
                        "Player withdrawn from the active roster; submit the roster again.",
                      )
                    }
                  >
                    Withdraw from roster
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {invitation && (
            <div className="preseason-invite">
              <h3>Private guardian link</h3>
              <p>
                Expires {new Date(invitation.expires).toLocaleString()}. Email:{" "}
                {invitation.email.replaceAll("_", " ")}. A copied link works
                independently of email delivery.
              </p>
              <Field label="New guardian invitation link">
                <input readOnly value={invitation.url} />
              </Field>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitation.url);
                    setNotice("Private invitation link copied.");
                  } catch {
                    setNotice("Select the private link and copy it directly.");
                  }
                }}
              >
                Copy private invitation link
              </Button>
              <p>
                Keep this link private. Only a hash is stored; creating another
                link revokes earlier invitations.
              </p>
            </div>
          )}
          <Button
            disabled={busy || !roster.length}
            onClick={() =>
              void act(
                () => command("submit_roster", { team_id: team }),
                "Roster submitted. Scheduling stays blocked until every active player is approved.",
              )
            }
          >
            <ClipboardCheck size={16} /> Submit roster for preseason review
          </Button>
        </Section>
      )}
      {data?.role === "admin" && (
        <Section
          title="Administrator document verification queue"
          description="Open the original, compare the child's name and date of birth, check guardian consent, and record a reasoned human decision. Age calculations cannot replace this review."
        >
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
                    {data.teams.find((t) => t.id === p.team_id)?.name} · DOB{" "}
                    {p.birth_date} · Age {p.age} · Consent{" "}
                    {p.guardian_consent ? "provided" : "missing"}
                  </p>
                  <p>
                    Guardian attestation: {doc.guardian_name ?? "Not recorded"}{" "}
                    · {doc.relationship ?? "—"}
                    {doc.consent_at
                      ? ` · ${new Date(doc.consent_at).toLocaleString()}`
                      : ""}
                    . Details confirmed: {doc.confirmed_details ? "yes" : "no"}.
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
                        Private URL expires after 60 seconds. Open again if
                        needed.
                      </small>
                    </div>
                  )}
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
                            duplicate_acknowledged: f.get("duplicate") === "on",
                          }),
                        "Administrator verification decision recorded.",
                      );
                      setPreview(null);
                    }}
                  >
                    <Field label={`Review decision for ${p.display_name}`}>
                      <select name="decision">
                        <option value="resubmission">
                          Request resubmission
                        </option>
                        <option value="approved">
                          Approve verified document and eligibility
                        </option>
                        <option value="rejected">Reject verification</option>
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
                      I inspected the original proof, matched name and birth
                      date, and checked guardian consent.
                    </label>
                    <label className="checkbox-label">
                      <input name="duplicate" type="checkbox" /> I investigated
                      any duplicate flags and explained the decision in my
                      reason.
                    </label>
                    <Button disabled={busy}>
                      <ShieldCheck size={16} /> Record verification decision
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
                    p.id === d.player_id && p.verification_status === "pending",
                )),
          ) && (
            <p className="small-muted">
              No pending documents. A guardian must submit genuine file bytes
              before a review appears here.
            </p>
          )}
          <details>
            <summary>Review history and document retention</summary>
            <p className="small-muted">
              Expired originals are removed by daily cleanup. You can also run
              due deletion now. Reviewer links expire within 60 seconds; a
              retained eligibility decision does not retain its proof image.
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
                      <td>{new Date(d.retain_until).toLocaleDateString()}</td>
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
                      {r.reason} · {new Date(r.created_at).toLocaleString()}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </Section>
      )}
    </div>
  );
}
