"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileImage,
  ClipboardCheck,
  Workflow,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { AgentActionReceipts } from "./agent-action-receipts";
import {
  operationMessage,
  operationRunTrace,
  type AgentEvidenceContext,
} from "@/lib/agent-evidence";
import { toolStory } from "@/lib/meta-presentation";
type Evidence = {
  id: string;
  feature: string;
  model: string;
  response_id: string;
  object_id: string;
  request_digest: string;
  response: unknown;
  tool_calls: unknown[];
  created_at: string;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const percent = (v: unknown) =>
  typeof v === "number" ? `${Math.round(v * 100)}%` : "Not reported";
const titles: Record<string, string> = {
  scoresheet: "Scoresheet recognition",
  placement: "Preseason placement",
  operations: "League operations",
  evaluation_scoresheet: "Scoresheet evaluation",
  evaluation_placement: "Placement evaluation",
  experimental_document: "Synthetic document experiment",
};
function Answer({
  e,
  all,
  context,
}: {
  e: Evidence;
  all: Evidence[];
  context: AgentEvidenceContext;
}) {
  const r = obj(e.response),
    operation = e.feature === "operations";
  const trace = operationRunTrace(
    [...all].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    e.object_id,
  );
  return (
    <div className="ai-answer">
      <div className="ai-source">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <b>Saved Meta response</b> · {e.model} ·{" "}
          {new Date(e.created_at).toLocaleString()}
          <br />
          <span>
            Previously recorded output; opening it does not start a new AI run.
          </span>
        </p>
      </div>
      {e.feature.includes("scoresheet") ? (
        <>
          <h3>What Meta read</h3>
          <p>
            A scoresheet image linked to this record. Inspect the original in
            Scoresheets before confirming a result.
          </p>
          <div className="ai-score">
            <div>
              {typeof r.homeTeam === "string" ? r.homeTeam : "Home team"}
              <strong>
                {typeof r.homeScore === "number" ? r.homeScore : "Uncertain"}
              </strong>
            </div>
            <span>vs</span>
            <div>
              {typeof r.awayTeam === "string" ? r.awayTeam : "Away team"}
              <strong>
                {typeof r.awayScore === "number" ? r.awayScore : "Uncertain"}
              </strong>
            </div>
          </div>
          <p>
            Model confidence: {percent(r.confidence)} ·{" "}
            {Array.isArray(r.players) ? r.players.length : "Unknown"} recorded
            player-stat rows
          </p>
          <p className="ai-boundary">
            A person checks the original and confirms the official result.
            Missing statistics remain missing.
          </p>
          {strings(r.warnings).length > 0 && (
            <ul>
              {strings(r.warnings).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </>
      ) : e.feature.includes("placement") ? (
        <>
          <h3>What Meta interpreted</h3>
          <p>
            Coach-reported results, experience, continuity and preferred initial
            division.
          </p>
          <div className="ai-placement">
            <b>
              Suggested Tier{" "}
              {typeof r.recommendedTier === "number"
                ? r.recommendedTier
                : "not reported"}
            </b>
            <span>Model confidence: {percent(r.confidence)}</span>
          </div>
          {typeof r.summary === "string" && <p>{r.summary}</p>}
          <h3>Questions worth investigating</h3>
          <ul>
            {strings(r.inconsistencies).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <details>
            <summary>Clarifying questions and supplied evidence</summary>
            <ul>
              {strings(r.clarifyingQuestions).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <ul>
              {strings(r.evidence).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </details>
          <p className="ai-boundary">
            The independent placement rubric and administrator approval remain
            in control.
          </p>
        </>
      ) : operation ? (
        <>
          <h3>How the agent investigated this run</h3>
          <p>
            League information and verified results, team history and readiness
            counts. No guardian documents or child identities are supplied to
            these tools.
          </p>
          <ol className="ai-tool-timeline">
            {trace.map((t, i) => {
              const s = toolStory(t);
              return (
                <li key={i}>
                  <span className="ai-step">{i + 1}</span>
                  <div>
                    <h4>{s.title}</h4>
                    <p>{s.detail}</p>
                    <span
                      className={`badge ${s.state === "recorded" ? "badge-green" : ""}`}
                    >
                      {s.state === "recorded"
                        ? "Outcome recorded"
                        : s.state === "blocked"
                          ? "Blocked or failed"
                          : "Outcome unverified"}
                    </span>
                    <details>
                      <summary>Tool arguments and original outcome</summary>
                      <code>{t.tool}</code>
                      <pre>
                        {JSON.stringify(
                          { arguments: t.arguments, outcome: t.outcome },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                </li>
              );
            })}
          </ol>
          <AgentActionReceipts
            message={operationMessage(e.response)}
            trace={trace}
            context={context}
          />
          <details>
            <summary>Original model explanation</summary>
            <p className="ai-model-text">
              {operationMessage(e.response) ||
                "No final model explanation recorded for this turn."}
            </p>
          </details>
          <p className="ai-boundary">
            The agent can prepare proposals and drafts. Only an authorized
            administrator can approve moves or publish a schedule.
          </p>
        </>
      ) : (
        <p>
          This saved evaluation has its original output below. Experimental
          document screening does not authenticate identity or determine
          eligibility.
        </p>
      )}
      <details className="ai-original">
        <summary>Original response and audit identifiers</summary>
        <dl>
          <dt>Provider response</dt>
          <dd>
            <code>{e.response_id}</code>
          </dd>
          <dt>Linked record</dt>
          <dd>
            <code>{e.object_id}</code>
          </dd>
          <dt>Request SHA-256</dt>
          <dd>
            <code>{e.request_digest}</code>
          </dd>
        </dl>
        <h4>Structured output / answer</h4>
        <pre>{JSON.stringify(e.response, null, 2)}</pre>
        {e.tool_calls.length > 0 && (
          <>
            <h4>Chosen tools and resulting actions</h4>
            <pre>{JSON.stringify(e.tool_calls, null, 2)}</pre>
          </>
        )}
      </details>
    </div>
  );
}
export function MetaActivity({
  league,
  api,
  isAdmin,
  enabled,
  onPlacement,
  onScoresheet,
  onAgent,
  actionContext,
}: {
  league: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  isAdmin: boolean;
  enabled: boolean;
  onPlacement: () => void;
  onScoresheet: () => void;
  onAgent: () => void;
  actionContext: AgentEvidenceContext;
}) {
  const [data, setData] = useState<{
      model: string;
      evidence: Evidence[];
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const request = useRef(0),
    cards = useRef(new Map<string, HTMLDetailsElement>());
  const load = useCallback(async () => {
    if (!isAdmin) return;
    const id = ++request.current;
    setLoading(true);
    try {
      const next = await api(`/api/evidence?league=${league}`);
      if (request.current === id) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (request.current === id) setError((e as Error).message);
    } finally {
      if (request.current === id) setLoading(false);
    }
  }, [api, league, isAdmin]);
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  function open(feature: string) {
    const row = data?.evidence.find((e) => e.feature === feature);
    if (!row) return;
    const d = cards.current.get(row.id);
    if (d) {
      d.open = true;
      d.scrollIntoView({ block: "start", behavior: "auto" });
      d.querySelector("summary")?.focus();
    }
  }
  const capabilities = [
    {
      feature: "scoresheet",
      title: "Read the game",
      Icon: FileImage,
      text: "Turn a scoresheet photo into structured results ready for review.",
      action: onScoresheet,
      label: "Open scoresheets",
    },
    {
      feature: "placement",
      title: "Place teams fairly",
      Icon: ClipboardCheck,
      text: "Interpret preseason assessments and highlight questions worth investigating.",
      action: onPlacement,
      label: "Open preseason placement",
    },
    {
      feature: "operations",
      title: "Keep the league balanced",
      Icon: Workflow,
      text: "Investigate results, recommend adjustments and prepare schedule changes.",
      action: onAgent,
      label: isAdmin ? "Start a new AI run" : "View league schedule",
    },
  ];
  return (
    <div className="ai-workspace preseason-stack">
      <header className="ai-intro">
        <span className="ai-eyebrow">
          <Sparkles size={16} aria-hidden="true" /> Powered by Meta Muse Spark
        </span>
        <h2>Intelligence for a fairer season.</h2>
        <p>
          From the first assessment to the next round: inspect what Meta
          understood, the tools it chose, and the work people approved.
        </p>
      </header>
      {!enabled && (
        <p className="ai-paused" role="status">
          <span aria-hidden="true" />
          Live AI processing is paused for this demonstration. Explore verified
          results from previous Meta AI runs below.
        </p>
      )}
      <div className="ai-capabilities">
        {capabilities.map(({ feature, title, Icon, text, action, label }) => {
          const count =
            data?.evidence.filter((e) => e.feature === feature).length ?? 0;
          return (
            <section className="panel ai-capability" key={feature}>
              <span className="ai-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="ai-availability">
                {!isAdmin
                  ? "Saved history: administrators only"
                  : loading
                    ? "Checking saved evidence…"
                    : count
                      ? `${count} genuine saved response${count === 1 ? "" : "s"}`
                      : "No saved response in this season"}
              </span>
              <div className="ai-card-actions">
                {isAdmin && count > 0 ? (
                  <>
                    <Button variant="secondary" onClick={() => open(feature)}>
                      Explore saved{" "}
                      {feature === "operations"
                        ? "agent run"
                        : feature === "placement"
                          ? "interpretation"
                          : "recognition"}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={action}
                      disabled={feature === "operations" && !enabled}
                    >
                      {label}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={action}
                    disabled={feature === "operations" && isAdmin && !enabled}
                  >
                    {label}
                  </Button>
                )}
              </div>
              {feature === "operations" && isAdmin && !enabled && (
                <small>
                  New runs become available when live processing is authorized.
                </small>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel ai-history">
        <div className="panel-heading">
          <div>
            <h2>Meta AI evidence</h2>
            <p>
              Recorded interpretations, selected tools and saved actions. Expand
              an entry to follow the work.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {loading ? "Refreshing…" : "Refresh AI evidence"}
            </Button>
          )}
        </div>
        {error && <p role="alert">{error} Try refreshing the evidence.</p>}
        {!isAdmin ? (
          <p>
            Only authorized league administrators can inspect model-response
            history.
          </p>
        ) : loading && !data ? (
          <p role="status">Loading saved Meta evidence…</p>
        ) : data?.evidence.length ? (
          <div className="history-list">
            {data.evidence.map((e) => (
              <details
                key={e.id}
                ref={(el) => {
                  if (el) cards.current.set(e.id, el);
                  else cards.current.delete(e.id);
                }}
              >
                <summary>
                  <span className="badge badge-green">
                    Actual Meta response
                  </span>{" "}
                  {titles[e.feature] ?? "Meta evaluation"} ·{" "}
                  {new Date(e.created_at).toLocaleString()}
                </summary>
                <Answer e={e} all={data.evidence} context={actionContext} />
              </details>
            ))}
          </div>
        ) : (
          !error && (
            <div className="empty">
              <ShieldCheck size={30} aria-hidden="true" />
              <h3>No saved Meta responses in this season</h3>
              <p>
                Choose a season with recorded AI work, or open its scoresheets
                and preseason workspace. New processing requires authorization.
              </p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
