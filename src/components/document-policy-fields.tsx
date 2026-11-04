"use client";
import { useId } from "react";

export const proofTypes = [
  ["birth_certificate", "Birth certificate"],
  ["passport", "Passport"],
  ["government_id", "Government-issued ID"],
] as const;
export const proofLabel = (type: string) =>
  proofTypes.find(([value]) => value === type)?.[1] ?? type;

/** Shared by setup and preseason; values always come from the authoritative policy. */
export function DocumentPolicyFields({
  required,
  types,
  onChange,
  disabled = false,
}: {
  required: boolean;
  types: string[];
  onChange: (required: boolean, types: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="document-policy">
      <fieldset disabled={disabled} aria-describedby={id}>
        <legend>Require proof of age?</legend>
        <div className="policy-choices">
          {[true, false].map((value) => (
            <label className="checkbox-label" key={String(value)}>
              <input
                type="radio"
                name={`proof-required-${id}`}
                checked={required === value}
                onChange={() => onChange(value, types)}
              />
              {value ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <p id={id} className="form-note">
          {required
            ? "An administrator must inspect an accepted document before approving eligibility."
            : "No document is collected. Guardian confirmation and a recorded administrator eligibility decision are still required. Age, roster and placement checks remain enforced. This does not verify a document."}
        </p>
      </fieldset>
      {required && (
        <fieldset disabled={disabled}>
          <legend>Which documents will your league accept?</legend>
          <p className="form-note">
            Choose at least one. Guardians submit one of these documents.
            Originals are stored privately for authorized reviewers and deleted
            under your retention policy.
          </p>
          <div className="policy-choices">
            {proofTypes.map(([value, label]) => (
              <label className="checkbox-label" key={value}>
                <input
                  type="checkbox"
                  checked={types.includes(value)}
                  onChange={(e) =>
                    onChange(
                      required,
                      e.target.checked
                        ? [...types, value]
                        : types.filter((v) => v !== value),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {!types.length && (
            <p className="text-orange">
              Select at least one accepted document before saving.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
