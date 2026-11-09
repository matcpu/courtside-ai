"use client";
import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { DocumentPolicyFields } from "./document-policy-fields";
import { SportRulesFields } from "./sport-rules-fields";
import { defaultSportRules, sportProfiles } from "@/lib/sports";
import {
  newSetup,
  setupIssues,
  formatLeagueDate,
  type Setup,
  type SetupDraft,
} from "@/lib/launchpad";
export type LaunchApi = (path: string, options?: RequestInit) => Promise<any>;
export const launchCommand = (
  api: LaunchApi,
  action: string,
  payload: unknown,
) =>
  api("/api/launchpad", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  const id = useId();
  return (
    <label className="field">
      <span>{label}</span>
      {cloneElement(
        children as ReactElement<{
          "aria-label"?: string;
          "aria-describedby"?: string;
        }>,
        { "aria-label": label, "aria-describedby": help ? id : undefined },
      )}
      {help && <small id={id}>{help}</small>}
    </label>
  );
}
const steps = [
  "League basics",
  "Season & divisions",
  "Facilities",
  "Rules & safety",
  "Review & finish",
];
export function OrganizerSetup({
  api,
  onComplete,
  onClose,
  initialDraft,
  initialData,
  startMode,
}: {
  api: LaunchApi;
  onComplete: (id: string) => Promise<void>;
  onClose: () => void;
  initialDraft?: SetupDraft;
  initialData?: Setup;
  startMode?: "guided";
}) {
  const [mode, setMode] = useState<"guided" | "quick" | "copy" | null>(
    initialDraft ? "guided" : (startMode ?? null),
  );
  const [data, setData] = useState<Setup>(
    initialDraft?.data ?? initialData ?? newSetup,
  );
  const [drafts, setDrafts] = useState<SetupDraft[]>([]),
    [sources, setSources] = useState<
      { id: string; name: string; season: string }[]
    >([]);
  const [source, setSource] = useState(""),
    [step, setStep] = useState(0),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [brief, setBrief] = useState(""),
    [category, setCategory] = useState("");
  const [validationStep, setValidationStep] = useState<number | null>(null);
  const current = useRef<SetupDraft | undefined>(initialDraft),
    latest = useRef(data),
    saved = useRef(initialDraft ? JSON.stringify(initialDraft.data) : ""),
    pending = useRef<Promise<SetupDraft> | null>(null),
    active = useRef(true);
  latest.current = data;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    api("/api/launchpad")
      .then((r) => {
        if (live) {
          setSources(r.sources);
          setDrafts(r.drafts);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api]);
  const save = useCallback(async (): Promise<SetupDraft> => {
    if (pending.current) {
      await pending.current;
      return save();
    }
    const values = latest.current,
      serialized = JSON.stringify(values);
    if (current.current && saved.current === serialized) return current.current;
    setSaving(true);
    setError("");
    const promise = launchCommand(api, "save_draft", {
      id: current.current?.id ?? null,
      revision: current.current?.revision ?? null,
      base_revision: current.current?.base_revision ?? 0,
      league_id: current.current?.league_id ?? null,
      data: values,
    }) as Promise<SetupDraft>;
    pending.current = promise;
    try {
      const result = await promise;
      current.current = result;
      saved.current = serialized;
      if (active.current)
        setStatus("Draft saved privately. You can return later.");
      return result;
    } catch (e) {
      if (active.current)
        setError(
          (e as Error).message + " Your unsaved changes remain in this window.",
        );
      throw e;
    } finally {
      pending.current = null;
      if (active.current) setSaving(false);
    }
  }, [api]);
  useEffect(() => {
    if (!mode || (mode === "copy" && !current.current)) return;
    setStatus("Unsaved changes…");
    const id = setTimeout(() => {
      void save().catch(() => {});
    }, 700);
    return () => clearTimeout(id);
  }, [data, mode, save]);
  const patch = <K extends keyof Setup>(key: K, value: Setup[K]) =>
    setData((s) => ({ ...s, [key]: value }));
  const field = (
    key: keyof Setup,
    label: string,
    type = "text",
    help?: string,
  ) => (
    <Field label={label} help={help}>
      <input
        type={type}
        value={String(data[key])}
        onChange={(e) =>
          patch(
            key,
            (type === "number"
              ? Number(e.target.value)
              : e.target.value) as never,
          )
        }
        maxLength={type === "email" ? 150 : 100}
      />
    </Field>
  );
  const loadDraft = (d: SetupDraft) => {
    current.current = d;
    saved.current = JSON.stringify(d.data);
    setData(d.data);
    setMode("guided");
    setStep(0);
    setError("");
  };
  const issues = setupIssues(data);
  const blockers = issues.map((issue) => issue.message);
  const goStep = (target: number) => {
    if (
      target > step &&
      target !== 4 &&
      (step === 2 || step === 3) &&
      issues.some((issue) => issue.step === step)
    ) {
      setValidationStep(step);
      requestAnimationFrame(() =>
        document.getElementById("setup-step-errors")?.focus(),
      );
      return;
    }
    setValidationStep(null);
    setStep(target);
    requestAnimationFrame(() =>
      document.getElementById("setup-step-title")?.focus(),
    );
  };
  const closeSaved = async () => {
    setBusy(true);
    try {
      await save();
      onClose();
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const copySeason = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await launchCommand(api, "copy", { league_id: source });
      loadDraft(d);
      setStatus(
        "Rules, divisions and courts copied. Add fresh dates and confirmed availability.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fillBrief = () => {
    const teams = brief.match(/\b(\d{1,4})[ -]*teams?\b/i),
      city = brief.match(/\b(?:around|in)\s+([\p{L} .'-]{2,60})/u);
    if (teams)
      patch("expectedTeams", Math.max(2, Math.min(1000, Number(teams[1]))));
    if (city) patch("city", city[1].trim().replace(/[.!?].*$/, ""));
    setStatus(
      "Team count/location picked out with simple rules. Review and complete the fields; no AI inference was used.",
    );
  };
  if (!mode)
    return (
      <div className="organizer-start">
        <span className="launch-eyebrow">COURTSIDE LAUNCHPAD</span>
        <h2>What do you want to run?</h2>
        <p>
          Start with the league you have in mind. We’ll help turn it into a
          season.
        </p>
        <div className="setup-paths">
          <button onClick={() => setMode("guided")}>
            <Sparkles />
            <strong>Help me set up a league</strong>
            <span>
              A guided path with practical recommendations. Best for first-time
              organizers.
            </span>
            <b>Start guided setup →</b>
          </button>
          <button onClick={() => setMode("copy")}>
            <Copy />
            <strong>Copy a previous season</strong>
            <span>
              Reuse rules, divisions and gyms. Start fresh registration and
              schedules.
            </span>
            <b>Choose a season →</b>
          </button>
          <button onClick={() => setMode("quick")}>
            <MapPin />
            <strong>I know what I need</strong>
            <span>
              Go straight to configuration. Jump between the five sections at
              your own pace.
            </span>
            <b>Open quick setup →</b>
          </button>
        </div>
        {error && (
          <p role="alert" className="launch-error">
            {error}
          </p>
        )}
        {drafts.length > 0 && (
          <section className="setup-resume">
            <h3>Pick up where you left off</h3>
            {drafts.map((d) => (
              <button key={d.id} onClick={() => loadDraft(d)}>
                <span>
                  <strong>{d.data.name || "Untitled league"}</strong>
                  <small>{d.data.season || "Season dates to be added"}</small>
                </span>
                <span>Resume draft →</span>
              </button>
            ))}
          </section>
        )}
      </div>
    );
  if (mode === "copy" && !current.current)
    return (
      <div className="organizer-start">
        <button className="text-link" onClick={() => setMode(null)}>
          ← All starting options
        </button>
        <h2>A new season. A familiar foundation.</h2>
        <p>
          Copy a season you administer. Participants, private contacts,
          documents, invitations, results and dated availability are never
          copied.
        </p>
        <Field label="Previous season">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Choose a season</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.season}
              </option>
            ))}
          </select>
        </Field>
        {!sources.length && (
          <p>
            You don’t administer a previous season yet. Start with guided or
            quick setup.
          </p>
        )}
        {error && (
          <p role="alert" className="launch-error">
            {error}
          </p>
        )}
        <Button disabled={!source || busy} onClick={() => void copySeason()}>
          Copy configuration
        </Button>
      </div>
    );
  return (
    <div className="organizer-wizard">
      <header className="setup-header">
        <div>
          <span className="launch-eyebrow">
            {mode === "quick" ? "DIRECT CONFIGURATION" : "GUIDED LEAGUE SETUP"}
          </span>
          <h2>{data.name || "Let’s build your next season."}</h2>
          <p>
            Private until you choose to publish. All settings can be reviewed
            before launch.
          </p>
        </div>
        <span className="setup-save-status" role="status">
          {saving ? (
            <>
              <LoaderCircle size={15} className="spin" /> Saving…
            </>
          ) : (
            status
          )}
        </span>
      </header>
      <nav className="setup-progress" aria-label="League setup steps">
        {steps.map((title, i) => (
          <button
            key={title}
            aria-current={step === i ? "step" : undefined}
            onClick={() => goStep(i)}
          >
            <span>{i < step ? <Check size={16} /> : i + 1}</span>
            <strong>{title}</strong>
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="launch-error">
          {error}
        </p>
      )}
      <section className="setup-step" aria-labelledby="setup-step-title">
        <span className="launch-eyebrow">STEP {step + 1} OF 5</span>
        <h3 id="setup-step-title" tabIndex={-1}>
          {steps[step]}
        </h3>
        {validationStep === step &&
          issues.some((issue) => issue.step === step) && (
            <div
              id="setup-step-errors"
              className="launch-error"
              role="alert"
              tabIndex={-1}
            >
              <strong>Check this step before continuing</strong>
              <ul>
                {issues
                  .filter((issue) => issue.step === step)
                  .map((issue) => (
                    <li key={issue.message}>{issue.message}</li>
                  ))}
              </ul>
            </div>
          )}
        {step === 0 && (
          <>
            <div className="setup-brief">
              <Field
                label="Describe the league you want to run"
                help="Optional. This helper picks out a team count and location using simple rules; it does not call Meta."
              >
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  maxLength={300}
                  placeholder="I want to run a 40-team youth basketball league around Toronto."
                />
              </Field>
              <Button
                variant="secondary"
                onClick={fillBrief}
                disabled={!brief.trim()}
              >
                Use this starting brief
              </Button>
            </div>
            <div className="setup-fields">
              {field("name", "League name")}
              <Field label="Sport">
                <select
                  value={data.sport ?? "basketball"}
                  onChange={(e) => {
                    const sport = e.target.value as Setup["sport"];
                    setData((previous) => ({
                      ...previous,
                      sport,
                      sportRules: defaultSportRules(sport),
                    }));
                  }}
                >
                  {Object.entries(sportProfiles).map(([key, profile]) => (
                    <option key={key} value={key}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="League type">
                <select
                  value={data.kind}
                  onChange={(e) =>
                    patch("kind", e.target.value as Setup["kind"])
                  }
                >
                  <option value="competitive">Competitive / rep</option>
                  <option value="recreational">Recreational</option>
                  <option value="tournament">Tournament planning</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              {field("country", "Country")}
              {field("region", "Province / state")}
              {field("city", "Primary city")}
              {field("expectedTeams", "Expected number of teams", "number")}
              <Field label="League timezone">
                <select
                  value={data.timezone}
                  onChange={(e) => patch("timezone", e.target.value)}
                >
                  {[
                    ...new Set([
                      data.timezone,
                      "America/Toronto",
                      "America/Vancouver",
                      "America/Edmonton",
                      "America/Winnipeg",
                      "America/Halifax",
                      "America/New_York",
                      "America/Chicago",
                      "America/Los_Angeles",
                      "Europe/London",
                      "Australia/Sydney",
                      "UTC",
                    ]),
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              {field(
                "adminContact",
                "Administrator email (private)",
                "email",
                "Never copied to the public website. Publish a separate contact only if you choose.",
              )}
            </div>
            <details>
              <summary>Additional operating area</summary>
              {field(
                "area",
                "Other cities / regions",
                "text",
                "Planning context only. Travel-distance enforcement is not implemented.",
              )}
            </details>
          </>
        )}
        {step === 1 && (
          <>
            <div className="setup-fields">
              {field("season", "Season name")}
              {field("start", "Season start", "date")}
              {field("end", "Season end", "date")}
              {field("opening", "Expected opening day", "date")}
              {field(
                "cutoff",
                "Age eligibility cutoff",
                "date",
                "Age is calculated on this chosen date. Review the applicable local eligibility policy.",
              )}
              {field(
                "registrationDeadline",
                "Registration / questionnaire deadline",
                "date",
              )}
              {field("rosterDeadline", "Roster deadline", "date")}
              {field("verificationDeadline", "Verification deadline", "date")}
              {field(
                "gamesPerTeam",
                "Planned games per team",
                "number",
                "A planning target for estimating volume; not an automatic round-robin or playoff promise.",
              )}
            </div>
            <div className="setup-guidance">
              <strong>Start with understandable competition groups.</strong>
              <p>
                Age categories can include boys, girls or coed labels. Three
                tiers per category connect to the existing placement rubric. Age
                ranges are editable; division placement stays a human decision.
              </p>
            </div>
            <div className="setup-divisions">
              {data.divisions.map((d, i) => (
                <div key={i}>
                  <Field label={`Division ${i + 1} name`}>
                    <input
                      value={d.name}
                      maxLength={100}
                      onChange={(e) =>
                        patch(
                          "divisions",
                          data.divisions.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={`Division ${i + 1} age category`}>
                    <input
                      value={d.age_category}
                      maxLength={30}
                      onChange={(e) =>
                        patch(
                          "divisions",
                          data.divisions.map((x, j) =>
                            j === i
                              ? { ...x, age_category: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={`Division ${i + 1} minimum age`}>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={d.min_age}
                      onChange={(e) =>
                        patch(
                          "divisions",
                          data.divisions.map((x, j) =>
                            j === i
                              ? { ...x, min_age: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={`Division ${i + 1} maximum age`}>
                    <input
                      type="number"
                      min={5}
                      max={20}
                      value={d.max_age}
                      onChange={(e) =>
                        patch(
                          "divisions",
                          data.divisions.map((x, j) =>
                            j === i
                              ? { ...x, max_age: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <small>Tier {d.tier}</small>
                </div>
              ))}
            </div>
            <div className="setup-add-group">
              <Field label="Add an age category">
                <input
                  value={category}
                  maxLength={30}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="U12 Girls"
                />
              </Field>
              <Button
                variant="secondary"
                disabled={
                  category.trim().length < 2 ||
                  data.divisions.length > 21 ||
                  data.divisions.some(
                    (d) =>
                      d.age_category.toLowerCase() ===
                      category.trim().toLowerCase(),
                  )
                }
                onClick={() => {
                  patch("divisions", [
                    ...data.divisions,
                    ...["Premier", "Competitive", "Development"].map(
                      (name, i) => ({
                        name: `${category.trim()} · ${name}`,
                        age_category: category.trim(),
                        tier: i + 1,
                        min_age: 0,
                        max_age: 13,
                      }),
                    ),
                  ]);
                  setCategory("");
                }}
              >
                Add three tiers
              </Button>
            </div>
            {data.kind === "tournament" && (
              <p className="form-note">
                Tournament format, pools and playoffs need separate planning.
                Current scheduling remains the existing constrained fixture
                workflow.
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <p>
              Add your {sportProfiles[data.sport ?? "basketball"].facility}{" "}
              identities now, or continue and arrange them later. A venue is not
              a booking: confirmed dated availability is added in Courts & gyms
              after setup.
            </p>
            {data.courts.map((c, i) => (
              <div className="setup-court" key={i}>
                <Field
                  label={`${sportProfiles[data.sport ?? "basketball"].facilityName} ${i + 1} name`}
                >
                  <input
                    required
                    aria-invalid={
                      (validationStep === 2 &&
                        (!c.name.trim() ||
                          data.courts.some(
                            (other, j) =>
                              j !== i &&
                              other.name.trim().toLowerCase() ===
                                c.name.trim().toLowerCase(),
                          ))) ||
                      undefined
                    }
                    value={c.name}
                    maxLength={100}
                    onChange={(e) =>
                      patch(
                        "courts",
                        data.courts.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field
                  label={`${sportProfiles[data.sport ?? "basketball"].facilityName} ${i + 1} venue / address`}
                >
                  <input
                    required
                    aria-invalid={
                      (validationStep === 2 && !c.venue.trim()) || undefined
                    }
                    value={c.venue}
                    maxLength={180}
                    onChange={(e) =>
                      patch(
                        "courts",
                        data.courts.map((x, j) =>
                          j === i ? { ...x, venue: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  aria-label={`Remove court ${i + 1} from plan`}
                  onClick={() =>
                    patch(
                      "courts",
                      data.courts.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={data.courts.length >= 30}
              onClick={() =>
                patch("courts", [...data.courts, { name: "", venue: "" }])
              }
            >
              <Plus size={16} /> Add a{" "}
              {sportProfiles[data.sport ?? "basketball"].facility}
            </Button>
            <div className="setup-guidance">
              <strong>
                {Math.ceil((data.expectedTeams * data.gamesPerTeam) / 2)}{" "}
                planned games · capacity not yet confirmed
              </strong>
              <p>
                No dated court slots are saved in this draft. Confirm
                availability after finishing setup; the dashboard then counts
                merged{" "}
                {(data.sportRules ?? defaultSportRules(data.sport)).gameMinutes}
                -minute facility slots. Team readiness, division matchups and{" "}
                {(data.sportRules ?? defaultSportRules(data.sport)).restMinutes}
                -minute team rest still constrain feasibility. Copies start with
                fresh availability.
              </p>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <SportRulesFields
              sport={data.sport ?? "basketball"}
              rules={data.sportRules ?? defaultSportRules(data.sport)}
              onChange={(sport, sportRules) =>
                setData((previous) => ({ ...previous, sport, sportRules }))
              }
              disabled={busy}
            />
            <div className="setup-fields">
              {field("minRoster", "Minimum active roster", "number")}
              {field("maxRoster", "Maximum active roster", "number")}
              {field(
                "retentionDays",
                "Document retention days",
                "number",
                "1–30 days. Existing retention and deletion controls remain in effect.",
              )}
            </div>
            <DocumentPolicyFields
              required={data.proofRequired !== false}
              types={data.allowedDocumentTypes}
              disabled={busy}
              onChange={(required, types) =>
                setData((previous) => ({
                  ...previous,
                  proofRequired: required,
                  allowedDocumentTypes: types as Setup["allowedDocumentTypes"],
                }))
              }
            />
            <ul className="setup-safety">
              <li>
                Guardian consent and a human eligibility decision are required
                before scheduling; accepted documents are inspected when the
                league requires proof.
              </li>
              <li>
                Coaches submit their own scoresheets. Authorized humans confirm
                official results.
              </li>
              <li>
                Placement, corrections, schedule publication and agent proposals
                retain human approvals.
              </li>
              <li>
                Scheduling uses{" "}
                {(data.sportRules ?? defaultSportRules(data.sport)).gameMinutes}
                -minute slots and at least{" "}
                {(data.sportRules ?? defaultSportRules(data.sport)).restMinutes}
                -minute rest for a team.
              </li>
              <li>
                Notifications use the existing in-app inbox. Email remains
                restricted to the authorized test inbox; SMS is disabled.
              </li>
              <li>
                Saving setup keeps the league private. Registration and website
                publication have separate controls.
              </li>
            </ul>
            <p className="form-note">
              Fees, payment collection, automated cancellations, advanced travel
              constraints and new notification channels are outside this
              preview.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <div className="setup-review">
              <article>
                <span>League</span>
                <strong>{data.name || "Name needed"}</strong>
                <p>
                  {[data.city, data.region, data.country]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  · {data.expectedTeams} expected teams
                </p>
                <button className="setup-edit-link" onClick={() => goStep(0)}>
                  Edit league details ↗
                </button>
              </article>
              <article>
                <span>Season</span>
                <strong>{data.season || "Season needed"}</strong>
                <p>
                  {formatLeagueDate(data.start, "Start needed")} –{" "}
                  {formatLeagueDate(data.end, "End needed")}
                </p>
                <p>
                  Opening day: {formatLeagueDate(data.opening, "Needed")}
                  <br />
                  {data.timezone}
                </p>
                <button className="setup-edit-link" onClick={() => goStep(1)}>
                  Edit season & dates ↗
                </button>
              </article>
              <article>
                <span>Competition</span>
                <strong>
                  {sportProfiles[data.sport ?? "basketball"].name} ·{" "}
                  {data.divisions.length} divisions
                </strong>
                <p>
                  {(data.sportRules ?? defaultSportRules(data.sport)).winPoints}{" "}
                  points per win ·{" "}
                  {
                    (data.sportRules ?? defaultSportRules(data.sport))
                      .drawPoints
                  }{" "}
                  per draw ·{" "}
                  {
                    (data.sportRules ?? defaultSportRules(data.sport))
                      .overtimeLossPoints
                  }{" "}
                  per OT/SO loss
                </p>
                <p>Age cutoff: {formatLeagueDate(data.cutoff, "Needed")}</p>
                <ul>
                  {data.divisions.map((division, i) => (
                    <li key={i}>
                      <b>{division.name}</b> · {division.age_category} · ages{" "}
                      {division.min_age}–{division.max_age}
                    </li>
                  ))}
                </ul>
                <button className="setup-edit-link" onClick={() => goStep(1)}>
                  Edit divisions ↗
                </button>
              </article>
              <article>
                <span>Facilities</span>
                <strong>
                  {data.courts.length}{" "}
                  {data.courts.length === 1 ? "court" : "courts"}
                  {data.courts.length > 0 &&
                    ` · ${new Set(data.courts.map((court) => court.venue.trim())).size} ${new Set(data.courts.map((court) => court.venue.trim())).size === 1 ? "venue" : "venues"}`}
                </strong>
                {data.courts.length > 0 ? (
                  <ul>
                    {data.courts.map((court, i) => (
                      <li key={i}>
                        <b>{court.name || "Court name needed"}</b>
                        <br />
                        {court.venue || "Venue / address needed"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Add facilities later in{" "}
                    {sportProfiles[data.sport ?? "basketball"].facilities}.
                  </p>
                )}
                <p>
                  Confirmed availability still required. Nothing scheduled or
                  published.
                </p>
                <button className="setup-edit-link" onClick={() => goStep(2)}>
                  Edit facilities ↗
                </button>
              </article>
              <article>
                <span>Roster & eligibility</span>
                <strong>
                  {data.minRoster}–{data.maxRoster} active players per team
                </strong>
                <p>
                  {data.proofRequired !== false
                    ? `Proof required: ${data.allowedDocumentTypes.map((type) => ({ birth_certificate: "Birth certificate", passport: "Passport", government_id: "Government-issued ID" })[type]).join(", ") || "Select accepted documents"}`
                    : "Guardian declaration · No document upload required"}
                </p>
                <p>
                  Document retention: {data.retentionDays} days. Human
                  eligibility approval required.
                </p>
                <button className="setup-edit-link" onClick={() => goStep(3)}>
                  Edit rules & safety ↗
                </button>
              </article>
              <article>
                <span>Registration deadlines</span>
                <strong>Ready before opening day</strong>
                <dl className="setup-review-dates">
                  <div>
                    <dt>Questionnaire</dt>
                    <dd>
                      {formatLeagueDate(data.registrationDeadline, "Needed")}
                    </dd>
                  </div>
                  <div>
                    <dt>Roster</dt>
                    <dd>{formatLeagueDate(data.rosterDeadline, "Needed")}</dd>
                  </div>
                  <div>
                    <dt>Verification</dt>
                    <dd>
                      {formatLeagueDate(data.verificationDeadline, "Needed")}
                    </dd>
                  </div>
                </dl>
                <button className="setup-edit-link" onClick={() => goStep(1)}>
                  Edit deadlines ↗
                </button>
              </article>
            </div>
            {blockers.length > 0 ? (
              <div className="setup-guidance">
                <h4>Complete these before finishing</h4>
                <ul>
                  {issues.map((issue) => (
                    <li key={issue.message}>
                      {issue.message}{" "}
                      <button
                        className="setup-edit-link"
                        onClick={() => goStep(issue.step)}
                      >
                        Go to {steps[issue.step]} ↗
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="setup-guidance">
                <strong>Ready to create your private workspace.</strong>
                <p>
                  Next: confirm court availability, invite coaches, prepare a
                  website draft and decide when registration should open.
                </p>
              </div>
            )}
            <p className="form-note">
              Finish Setup saves configuration atomically. It never opens
              registration, publishes a website or schedule, sends messages, or
              runs Meta.
            </p>
          </>
        )}
      </section>
      <footer className="setup-footer">
        <Button
          variant="ghost"
          disabled={busy || step === 0}
          onClick={() => goStep(step - 1)}
        >
          <ArrowLeft size={16} /> Back
        </Button>
        <Button
          id="organizer-save-exit"
          variant="secondary"
          disabled={busy || saving}
          onClick={() => void closeSaved()}
        >
          <Save size={16} /> Save draft & exit
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => {
              if (issues.some((issue) => issue.step === step)) {
                setValidationStep(step);
                requestAnimationFrame(() =>
                  document.getElementById("setup-step-errors")?.focus(),
                );
              } else goStep(step + 1);
            }}
          >
            Continue <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            disabled={busy || blockers.length > 0}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const d = await save();
                const r = await launchCommand(api, "finish", {
                  id: d.id,
                  revision: d.revision,
                });
                await onComplete(r.league_id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}{" "}
            Finish setup
          </Button>
        )}
      </footer>
    </div>
  );
}
