# Proof-of-age warning screening

This extends the existing guardian upload and administrator original-document review. It is **not government-document authentication**. No issue detected never means authentic. No facial recognition, biometric matching, issuer validation or youth-document Meta call is implemented.

## Working checks

- Server-local Tesseract OCR uses bundled English language data and worker/WASM files. Proof bytes remain in the server process/worker; no remote OCR API receives them. The bounded worker decodes at most 16 million pixels and stops OCR after 18 seconds. Unsupported/failed processing is explicitly unable to assess.
- Normalized labeled names (or an exact full-name line) and labeled, unambiguous ISO birth dates are compared with the registered details. Low-confidence OCR, missing fields, unsupported scripts/date formats and ambiguity require human inspection. No extracted date silently replaces the roster date. Raw OCR text and identifying extracted values are not retained in screening outputs.
- PostgreSQL independently calculates registered-date age at the configured cutoff and division bounds. It remains the authority for eligibility, regardless of OCR findings.
- Exact SHA-256 reuse across different player registrations is checked within the authorized league. A private 64-bit difference hash supplies an **experimental** similar-image hint at Hamming distance ≤4. Hashes are not biometric templates, are not exposed through reviewer responses or public views, and are never compared across leagues. Shared layouts can collide; crops and recompression can be missed.
- Supported two-line TD3-style machine-readable fields receive 7-3-1 checksum checks, including the composite checksum. A mismatch can be an OCR error. Passing checksums does not authenticate an issuer or establish the birth century.
- Resolution below 300 pixels on either side or low grayscale contrast produces a readability warning. Compression artifacts, unusual fonts, missing metadata and text alignment are not used as proof of forgery. There is no validated arbitrary-image tampering detector.

## Human review and privacy

The private review screen displays no-specific-issue/review-required/unable-to-assess, check sources, evidence, age bounds, exact reuse and experimental similarity counts, and the authenticity limitation. The administrator can inspect the original, approve, reject, request resubmission or record an escalation. Escalation is audited and leaves verification pending. Original-inspection attestation and a reasoned human decision remain mandatory; no screening result automatically rejects, bans or approves a child.

Private Storage, existing expiring one-player guardian capabilities, consent, current age rules, readiness gates and audit trails are preserved. Only authorized league administrators can read screening results. Clients cannot write screening through the trusted finalizer. Original retention/deletion removes screening outputs, image hashes and exact hashes with the bytes; minimal human decisions/history remain. No identifying screening information enters Meta AI activity or public snapshots.

## Observed synthetic evaluation

`node scripts/prepare-fraud-experiment.mjs` creates six visibly fictional illustrations and prepared Meta requests **without calling any model**. `node --import tsx scripts/evaluate-document-screening.mjs` evaluates the local processing only.

| Illustration | Actual local result |
|---|---|
| Consistent name and ISO date | No specific issue detected; both fields matched; authenticity unverified |
| Conflicting birth dates | Review required; conflicting labeled dates |
| Obvious altered-year illustration | Review required because two visible birth-date values conflict; this does not demonstrate general visual-tampering detection |
| Same bytes assigned to another fictional player | Exact hash reused; name mismatch; human review required |
| Unreadable low-contrast image | Unable to assess |
| Attendance illustration missing identity/age evidence | Unable to assess |

The consistent illustration produced no flag in this tiny suite; this is not a measured false-positive rate. One JPEG recompression differed by six hash bits and was **missed** by the conservative four-bit similarity threshold. Similarity is an experimental hint and is not a reliable guarantee of detecting document reuse.

Synthetic Meta fraud-screening requests are prepared but **not executed or included in the authorized eight-request sequence**. They require separate explicit billable authorization. Real children's documents must never be sent to Meta. A production authenticity claim would need a separately evaluated issuer/document verification process, potentially a dedicated provider, independent guardian identity controls and youth-data/privacy review; no such service has been purchased or integrated.
