"use client";
import { useState } from "react";
import type { DocumentScreening } from "@/lib/document-screening";
import { Button } from "./ui/button";
type Report = DocumentScreening & {
  exactDuplicates: number;
  possibleSimilarDocuments: number;
  ageEligible: boolean | null;
  ageAtCutoff: number;
  cutoffDate: string;
  minimumAge: number;
  maximumAge: number;
  humanReviewRequired: true;
};
export function DocumentScreeningPanel({
  league,
  document,
  api,
  onChanged,
}: {
  league: string;
  document: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onChanged: () => Promise<void>;
}) {
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  return (
    <section
      className="preseason-section"
      aria-label="Document screening findings"
    >
      <h4>Consistency and reuse screening · authenticity unverified</h4>
      <p>
        Local processing and deterministic checks support the reviewer. No proof
        document is sent to Meta. A clear screening result never guarantees
        authenticity.
      </p>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setReport(
              await api(
                `/api/document-screening?league=${league}&document=${document}`,
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Inspect screening findings
      </Button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div>
          <p>
            <b>
              {
                {
                  no_specific_issue: "No specific issue detected",
                  review_required: "Review required",
                  unable_to_assess: "Unable to assess",
                }[report.status]
              }
            </b>{" "}
            · Authenticity remains unverified.
          </p>
          <p>
            Local OCR: name {report.checks?.name ?? "unknown"}; birth date{" "}
            {report.checks?.birthDate ?? "unknown"}. Machine-readable checksums:{" "}
            {report.checks?.mrz?.replaceAll("_", " ") ?? "not assessed"}.
          </p>
          <p>
            Deterministic registered-date eligibility:{" "}
            {report.ageEligible === null
              ? "Unable to assess"
              : report.ageEligible
                ? "Within configured age bounds"
                : "Outside configured age bounds"}{" "}
            · Age {report.ageAtCutoff} on {report.cutoffDate} · Allowed{" "}
            {report.minimumAge}–{report.maximumAge}. OCR never changes the
            registered date.
          </p>
          <p>
            Exact duplicate proofs for other registrations:{" "}
            <b>{report.exactDuplicates}</b>. Experimentally similar images:{" "}
            <b>{report.possibleSimilarDocuments}</b>. Similar layouts can
            produce false flags; investigate the originals.
          </p>
          {report.findings.map((finding, i) => (
            <p key={i}>
              <b>
                {finding.source === "local_ocr" ? "Local OCR" : "Deterministic"}{" "}
                · {finding.code.replaceAll("_", " ")}:
              </b>{" "}
              {finding.evidence}
            </p>
          ))}
          <details>
            <summary>Screening limitations</summary>
            {report.limitations.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </details>
          <label className="field">
            <span>Additional-review escalation reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={1000}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy || reason.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("/api/document-screening", {
                  method: "POST",
                  body: JSON.stringify({ league, document, reason }),
                });
                await onChanged();
                setError(
                  "Escalation recorded. Verification remains pending; a human decision is required.",
                );
                setReason("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Escalate for additional review
          </Button>
        </div>
      )}
    </section>
  );
}
