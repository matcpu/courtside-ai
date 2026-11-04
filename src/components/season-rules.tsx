"use client";
import {
  cloneElement,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "./ui/button";
import { DocumentPolicyFields } from "./document-policy-fields";
import { settingsSchema, type PreseasonData } from "@/lib/preseason";
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
export function SeasonRules({
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
  const [proofRequired, setProofRequired] = useState(
    data.settings.proof_required !== false,
  );
  const [types, setTypes] = useState<string[]>(
    data.settings.allowed_document_types as string[],
  );
  const [policyEnabled, setPolicyEnabled] = useState<boolean | null>(null);
  const [validation, setValidation] = useState("");
  const validationRef = useRef<HTMLParagraphElement>(null);
  const id = useId();
  return (
    <div
      className="preseason-settings"
      id="season-eligibility-settings"
      aria-labelledby={id}
    >
      <h2 id={id}>Season rules & eligibility</h2>
      <p>
        Set the league-wide requirements once. Teams and scheduling use these
        saved rules.
      </p>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const parsed = settingsSchema.safeParse({
            enabled: f.get("enabled") === "on",
            proof_required: proofRequired,
            expected_rules_version: Number(data.settings.rules_version),
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
            allowed_document_types: types,
          });
          if (!parsed.success) {
            setValidation(parsed.error.issues.map((i) => i.message).join(" "));
            requestAnimationFrame(() => validationRef.current?.focus());
            return;
          }
          setValidation("");
          await act(
            () => command("configure", parsed.data),
            "Season rules saved. Age-rule changes require renewed administrator review.",
          );
        }}
      >
        {validation && (
          <p
            className="notice notice-error"
            role="alert"
            tabIndex={-1}
            ref={validationRef}
          >
            {validation}
          </p>
        )}
        <h3>Scheduling readiness</h3>
        <label className="checkbox-label">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={Boolean(data.settings.enabled)}
            onChange={(e) => setPolicyEnabled(e.target.checked)}
          />{" "}
          Enforce preseason readiness before scheduling
        </label>
        <p>
          Enforces questionnaires, approved placements, roster bounds, guardian
          consent and human eligibility decisions before scheduling. Proof
          requirements below are a separate policy. Published fixtures are not
          changed.
        </p>
        {policyEnabled !== null &&
          policyEnabled !== Boolean(data.settings.enabled) && (
            <label className="checkbox-label policy-confirmation">
              <input name="confirm_policy_change" type="checkbox" required /> I
              understand this changes future scheduling eligibility, may block
              new drafts, and does not verify seeded players or change published
              fixtures.
            </label>
          )}
        <h3>Season & registration</h3>
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
        <h3>Roster limits & retention</h3>
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
        <h3>Proof of age & privacy</h3>
        <DocumentPolicyFields
          required={proofRequired}
          types={types}
          disabled={busy}
          onChange={(required, selected) => {
            setProofRequired(required);
            setTypes(selected);
            setValidation("");
          }}
        />
        {proofRequired !== (data.settings.proof_required !== false) && (
          <label className="checkbox-label policy-confirmation">
            <input type="checkbox" required />I understand this changes the
            evidence collected. Guardian confirmation, human eligibility review
            and all other readiness checks remain required; affected players may
            need to submit again.
          </label>
        )}
        <p className="form-note">
          Only photo formats JPEG, PNG and WebP are accepted (6 MB maximum).
          Retention deletion removes document bytes and guardian-name fields;
          the decision audit remains. Never upload real children's documents for
          a hackathon demo.
        </p>
        <Button disabled={busy}>Save season rules</Button>
      </form>
      <details className="preseason-divisions">
        <summary>Age categories and divisions</summary>{" "}
        <p className="form-note">
          Age is calculated at the league cutoff. Editing a category requires
          renewed eligibility review.
        </p>
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
    </div>
  );
}
