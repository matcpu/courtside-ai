# Proof-of-age warning screening

This extends the existing guardian upload and administrator original-document review. It is **not government-document authentication**. No issue detected never means authentic. No facial recognition, biometric matching or issuer validation is implemented. Actual Meta visual-reasoning experiments use only separately generated fictional illustrations; there is no real guardian-document Meta pathway.

## Working checks

- Server-local Tesseract OCR uses bundled English language data and worker/WASM files. Proof bytes remain in the server process/worker; no remote OCR API receives them. The bounded worker decodes at most 16 million pixels and stops OCR after 18 seconds. Unsupported/failed processing is explicitly unable to assess.
- Normalized labeled names (or an exact full-name line) and labeled, unambiguous ISO birth dates are compared with the registered details. Low-confidence OCR, missing fields, unsupported scripts/date formats and ambiguity require human inspection. No extracted date silently replaces the roster date. Raw OCR text and identifying extracted values are not retained in screening outputs.
- PostgreSQL independently calculates registered-date age at the configured cutoff and division bounds. It remains the authority for eligibility, regardless of OCR findings.
- Exact SHA-256 reuse across different player registrations is checked within the authorized league. Version-2 image features combine a 64-bit DCT perceptual hash and a separate difference hash: candidates need comparable aspect ratio within 3%, pHash distance ≤4 and dHash distance ≤8. Both features are private, stripped from reviewer responses and public views, and never compared across leagues. Older feature versions are not silently treated as compatible new hashes. Privacy relies on authorization and retention, not a claim that these features are cryptographically irreversible. Shared layouts can collide and transformed images can be missed.
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

The consistent illustration produced no flag in this tiny local suite; this is not a real-document false-positive rate. The initial dHash-only rule missed a controlled JPEG recompression at distance 6 against a four-bit cutoff. The revised combined features measured pHash distance 2/dHash distance 6 on that regression, within the new joint rule. This fixes that specific example; it does not establish reliable duplicate detection across arbitrary crops, layouts or editing. Similarity remains a review hint.

## Actual Meta illustration experiment

The owner's expanded promotional-credit authorization superseded the historical eight-request limit. Eight SHA-bound, visibly synthetic document illustrations were actually evaluated with Muse Spark through an operator-only script accepting generated fixtures, not guardian uploads. Genuine model IDs/responses, observations, limitations and usage are retained in private Meta AI activity and summarized in [EVALUATION_REPORT.md](EVALUATION_REPORT.md).

- All four text/name/date inconsistency cases received applicable review findings.
- Both benign controls—consistent illustration and its JPEG recompression—received no suspicion observations: 0 flags in 2 selected benign examples, not a validated false-positive rate.
- Both unreadable/missing-evidence examples were unable to assess, with unknown matches rather than invented identity information.
- Only one of two explicit visual-anomaly examples received a `possible_visual_anomaly` finding. The red altered-year example was flagged for conflicting text but missed that separate visual-observation check. The localized year patch received a possible shading/color observation with stated uncertainty. This is an **observed miss**, not a general visual-forgery detector.
- Every response kept authenticity unverified and human review required. The structured output distinguishes an inconsistency from a possible unconfirmed anomaly, unreadability or unsupported evidence. No result rejected, approved or banned a player.

Real children's documents must never be sent to Meta. The experiment is separate from production-facing local processing and deterministic eligibility. A production authenticity claim would require a separately evaluated issuer/document verification process, potentially a dedicated provider, independent guardian identity controls and youth-data/privacy review; no such service has been purchased or integrated. The current cumulative spending guard and observation-freshness requirements are in [META_VERIFICATION.md](META_VERIFICATION.md).
