"use client";
import {
  inspectAgentEvidence,
  type AgentEvidenceContext,
  type ToolReceipt,
} from "@/lib/agent-evidence";
export function AgentActionReceipts({
  message,
  trace,
  context,
}: {
  message: string;
  trace: ToolReceipt[];
  context: AgentEvidenceContext;
}) {
  const { actions, warnings } = inspectAgentEvidence(message, trace, context);
  if (!actions.length && !warnings.length) return null;
  return (
    <section
      aria-label="Verified agent action receipts"
      className="preseason-section"
    >
      <h3>Action receipts · deterministic record check</h3>
      <p>
        These names and statuses come from saved league records. Compare them
        with the original model explanation, which can contain mistakes.
      </p>
      <p className="small-muted">
        A proposed move needs administrator approval. A draft needs a separate
        publication decision. Original tool outcomes remain available below.
      </p>
      {warnings.length > 0 && (
        <div className="notice notice-error" role="status">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      {actions.map((action) => (
        <div key={action.id} className="panel preseason-section">
          <b>{action.label}</b>
          <p>{action.detail}</p>
          <small>
            {action.recordVerified
              ? "Matched to saved record"
              : "Record match requires review"}{" "}
            · {action.kind} <code>{action.id}</code>
          </small>
        </div>
      ))}
    </section>
  );
}
