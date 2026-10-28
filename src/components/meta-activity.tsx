"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  FileImage,
  Workflow,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
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
export function MetaActivity({
  league,
  api,
  isAdmin,
  enabled,
  onPlacement,
  onScoresheet,
  onAgent,
}: {
  league: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  isAdmin: boolean;
  enabled: boolean;
  onPlacement: () => void;
  onScoresheet: () => void;
  onAgent: () => void;
}) {
  const [data, setData] = useState<{
      model: string;
      evidence: Evidence[];
    } | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setData(await api(`/api/evidence?league=${league}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, league, isAdmin]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="preseason-stack">
      <div className="info-banner">
        <Sparkles />
        <div>
          <b>Meta turns observations into coordinated league work.</b>
          <p>
            Read a scoresheet, interpret uncertain preseason evidence, then
            select operations tools to prepare decisions. Deterministic
            validators and human approvals remain authoritative.
          </p>
        </div>
      </div>
      {!enabled && (
        <div className="notice">
          Meta is paused until credits are confirmed. No live response is
          implied by these prepared capabilities. Contract-test fixtures never
          appear as model evidence.
        </div>
      )}
      <div className="preseason-fields">
        {[
          {
            title: "1 · Understand the scoresheet",
            icon: FileImage,
            text: "Muse Spark reads the original image into structured scores and explicitly recorded statistics, with uncertainty. A person reviews the photo before confirming.",
            action: onScoresheet,
            label: "Open scoresheets",
          },
          {
            title: "2 · Interpret preseason evidence",
            icon: ClipboardCheck,
            text: "Muse Spark compares the coach’s record, margins, continuity and placement preference, flags contradictions and asks useful follow-up questions.",
            action: onPlacement,
            label: "Open preseason placement",
          },
          {
            title: "3 · Coordinate league operations",
            icon: Workflow,
            text: "The agent chooses tools, investigates verified team history, checks readiness, creates proposals and prepares feasible drafts for human decisions.",
            action: onAgent,
            label: "Open operations agent",
          },
        ].map(({ title, icon: Icon, text, action, label }) => (
          <section className="panel preseason-section" key={title}>
            <Icon size={23} />
            <h2>{title}</h2>
            <p>{text}</p>
            <Button
              variant="secondary"
              onClick={action}
              disabled={!isAdmin && label === "Open operations agent"}
            >
              {label}
            </Button>
            <p className="small-muted">
              {enabled
                ? "Provider calls enabled by configuration"
                : "Integration prepared · live verification pending"}
            </p>
          </section>
        ))}
      </div>
      <section className="panel preseason-section">
        <div className="panel-heading">
          <div>
            <h2>Actual model responses and resulting actions</h2>
            <p>
              Private, server-recorded provider receipts. Model ID, response ID
              and linked actions are retained; credentials, document images and
              hidden reasoning are excluded.
            </p>
          </div>
          {isAdmin && (
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw size={15} /> Refresh AI evidence
            </Button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        {!isAdmin ? (
          <p>
            Only authorized league administrators can inspect model-response
            history.
          </p>
        ) : data?.evidence.length ? (
          <div className="history-list">
            {data.evidence.map((e) => (
              <details key={e.id}>
                <summary>
                  <span className="badge badge-green">
                    Actual Meta response
                  </span>{" "}
                  {e.feature} · {new Date(e.created_at).toLocaleString()}
                </summary>
                <p>
                  Model: <b>{e.model}</b> · Response:{" "}
                  <code>{e.response_id}</code>
                </p>
                <p>
                  Linked record: <code>{e.object_id}</code>
                </p>
                <h3>Structured output / answer</h3>
                <pre>{JSON.stringify(e.response, null, 2)}</pre>
                {e.tool_calls.length > 0 && (
                  <>
                    <h3>Chosen tools and resulting actions</h3>
                    <pre>{JSON.stringify(e.tool_calls, null, 2)}</pre>
                  </>
                )}
                <small>Request SHA-256: {e.request_digest}</small>
              </details>
            ))}
          </div>
        ) : (
          <div className="empty">
            <ShieldCheck size={30} />
            <h3>No live Meta evidence recorded</h3>
            <p>
              Once credits are confirmed and calls are authorized, complete a
              scoresheet extraction, placement interpretation and operations
              run. Their actual responses and resulting records will appear
              here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
