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
        Names and current status below come from the authorized league records.
        Model narrative remains unchanged and can contain mistakes. This limited
        check is not a complete validation of every sentence.
      </p>
      <p className="small-muted">
        These are current saved actions for this operations run. Each provider
        turn's own selected calls and actual results remain in its original
        receipt.
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
