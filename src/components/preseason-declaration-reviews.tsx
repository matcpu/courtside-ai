"use client";
import { Button } from "./ui/button";
import type { PreseasonData } from "@/lib/preseason";

export function DeclarationReviews({
  data,
  busy,
  command,
  act,
}: {
  data: PreseasonData;
  busy: boolean;
  command: (action: string, payload: unknown) => Promise<any>;
  act: (fn: () => Promise<any>, message: string) => Promise<any>;
}) {
  if (data.settings.proof_required !== false) return null;
  const pending = data.players.filter(
    (p) =>
      p.active && p.guardian_consent && p.verification_status === "pending",
  );
  return (
    <div className="declaration-reviews">
      <div className="info-banner">
        <p>
          <b>Guardian declarations only.</b> This league does not collect
          proof-of-age documents. Review the declared details, age rules and
          duplicate flags before deciding. Approval records eligibility under
          this policy; it does not verify a document.
        </p>
      </div>
      {!pending.length && <p>No guardian declarations awaiting review.</p>}
      {pending.map((p) => (
        <article className="panel preseason-review" key={p.id}>
          <h3>{p.display_name} · guardian declaration</h3>
          <p>
            {data.teams.find((t) => t.id === p.team_id)?.name} · Declared DOB{" "}
            {p.birth_date} · Age {p.age} at cutoff · Guardian consent provided
          </p>
          {(!p.age_eligible || p.duplicate_identity) && (
            <p className="notice notice-error">
              {!p.age_eligible ? "Outside current age range. " : ""}
              {p.duplicate_identity
                ? "Possible duplicate identity. Investigate before approval."
                : ""}
            </p>
          )}
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await act(
                () =>
                  command("review_declaration", {
                    player_id: p.id,
                    decision: f.get("decision"),
                    reason: f.get("reason"),
                    details_checked: f.get("checked") === "on",
                    duplicate_acknowledged: f.get("duplicate") === "on",
                  }),
                "Human declaration review recorded. No document was verified.",
              );
            }}
          >
            <label className="field">
              <span>Declaration decision for {p.display_name}</span>
              <select
                name="decision"
                aria-label={`Declaration decision for ${p.display_name}`}
              >
                <option value="resubmission">
                  Request guardian resubmission
                </option>
                <option value="approved">
                  Approve eligibility under declaration policy
                </option>
                <option value="rejected">Reject eligibility</option>
              </select>
            </label>
            <label className="field">
              <span>Declaration review reason for {p.display_name}</span>
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={1000}
              />
            </label>
            <label className="checkbox-label">
              <input name="checked" type="checkbox" required />I reviewed the
              guardian confirmation, declared birth date, age rules and consent.
              No original document was inspected.
            </label>
            <label className="checkbox-label">
              <input name="duplicate" type="checkbox" />I investigated duplicate
              flags and explained my decision.
            </label>
            <Button disabled={busy}>Record declaration decision</Button>
          </form>
        </article>
      ))}
    </div>
  );
}
