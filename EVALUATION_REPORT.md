# Observed Meta and local-screening evaluation

Updated October 29, 2026 Eastern. This report describes actual `muse-spark-1.3` responses and local processing of visibly synthetic fixtures. It is not a government-document authentication study, a real-league field trial or a general accuracy benchmark. No real child's identity, guardian proof, photograph or personal record was supplied to Meta.

The primary artifacts are trusted Meta AI activity receipts and private evaluation reports containing input digests, provider IDs, structured outputs and explicit checks. Unit/mock fixtures are separate and never appear as provider evidence. [META_VERIFICATION.md](META_VERIFICATION.md) records cumulative usage, conservative cost accounting and the limits of the last real credit observation.

## Evaluation scope

- Original connected demonstration: one submitted contradictory questionnaire, one actually uploaded 78–43 scoresheet image and five model-selected agent continuations. The owner explicitly confirmed the extracted result through the normal administrator review before the agent.
- Expanded perception study: **15 new provider responses**—five scoresheet images, two questionnaire cases and eight fictional document illustrations. The original questionnaire/image evidence was reused rather than called again.
- Agent recovery study: two genuine multistep runs. Both preserved a failed lookup and recovered using actual league data; the second also returned a final model explanation of the failure and subsequent actions.
- Local document study: deterministic age/reuse/checksum rules, bounded local OCR, readable/unreadable synthetic images and image-similarity regression cases. These are independent from the model's document observations.

The cases were selected to exercise known failure boundaries. They are a small development set, not a held-out statistical sample. Passing a case does not establish performance on real handwriting, every camera condition, other languages or government documents.

## Scoresheet image recognition

| Visibly synthetic image | Actual result | Provider evidence |
|---|---|---|
| Original Eastside Eagles / Riverside Ravens | Correct 78–43; no unrecorded player statistics. Owner confirmation made this private result official | `resp_6ae2aaf57943f7b1407c4f16` |
| Printed partial box score | Correct Fictional Comets 64–58 Fictional Otters; three explicitly recorded jersey rows; unrecorded rebounds/assists remained null | `resp_6ae2c6499a753a3ae2f54a7d` |
| Rotated, JPEG-compressed partial box score | Correct 64–58 and the same recorded/null statistics | `resp_6ae2c65d2232b37775474433` |
| Obscured home final | Home score null, away score 58, explicit unreadability warning; empty player array | `resp_6ae2c662e37dad7941004aaf` |
| Conflicting period sum and final | Read the printed final 64–58 and specifically warned that home periods sum to 62 rather than 64; scorer review required | `resp_6ae2c666c878bd892fab4364` |
| No player statistics recorded | Correct 51–47; empty player array rather than invented statistics | `resp_6ae2c669ecd7c33e906a405a` |

All five new image cases passed their declared field/null/warning checks. The ambiguous score remained missing instead of being guessed. Synthetic scores/statistics are evaluation facts, not real children or games. The extra evaluations did not automatically confirm results, alter standings or publish schedules. The application's independent validators and human review remain necessary even when the model reports high confidence.

## Questionnaire interpretation

| Team-level case | Observed behavior | Provider evidence |
|---|---|---|
| Contradictory high-confidence assessment | Flagged margins despite zero games, 90% returning despite zero years together, eight competitive players despite new-team experience, and unsupported top-tier certainty. Asked concrete clarification questions. Suggested tier 2, confidence 0.2; deterministic rubric remained tier 2/rating 970 | `resp_6ae2aaf0f442588ab0f040a6` |
| Consistent competition context | Identified the 12–6 record, continuity and prior division while explaining uncertain cross-league comparability; requested roster context. Suggested tier 1 with 0.62 evidential confidence | `resp_6ae2c6a28d2268dc48a94acd` |
| Missing competition history | Treated zero-valued history as no supplied evidence rather than verified poor performance; identified the unfinished roster and requested relevant context. Suggested tier 3 with weak support | `resp_6ae2c6aace5092002e5c4d96` |

Both new cases passed declared relevance/missing-history/human-decision checks. The consistent case still included questions and uncertainties; that is not proof of contradictions. The model's confidence measures its reported evidential support, not verified truth or a calibrated placement probability. Numerical ratings and official placement remain deterministic and human-approved respectively.

## Autonomous operations and recovery

The original agent selected `inspect_league`, `inspect_team_history`, `inspect_preseason_readiness`, `propose_balance` and `draft_schedule` using `tool_choice: "auto"`. Actual function-call IDs and outputs were returned through the provider conversation. It investigated repeated +35 Eastside Eagles margins, saved the Eagles-up/Riverside-down proposals and a feasible current-division draft. The draft contained 19 retained completed fixtures and six new games. No team move, result approval or publication was performed by the model.

The original final narrative mislabeled the secondary Riverside Ravens proposal as Parkdale Panthers. The saved team/proposal IDs were correct. That response remains unchanged in evidence. The interface now separates canonical record checks from raw narrative and warns about the mismatch; proposal-tool outputs include canonical team/division labels and the source of candidate investigation. This is an observed model error and a software mitigation, not a claim of flawless narration.

| Actual recovery run | Failure and recovery | Limit |
|---|---|---|
| First recovery run | A lookup of a nonexistent team was rejected. The model then selected the real Eastside ID from league data, inspected history/readiness, saved proposal `a7560aeb-412a-4656-8f97-ba4e54345014` and draft `1060569d-9fbf-4eb3-bda7-55f480b907ae` | The server time bound stopped the run before a final natural-language model summary. The returned bounded-stop message is system text, not a fabricated model response |
| Second recovery run | A malformed team-ID lookup failed validation. The model explicitly acknowledged that failure, selected the valid team ID, then inspected history/readiness and saved proposal `75ef0ef8-f9ee-4119-9565-c62ab6d33e60` plus draft `2e39109e-876e-4d67-bf36-c8a34664ae86` | Its final response stopped at human approval and did not portray the failed lookup as successful |

These are tool-level failures and recovery, not hidden transport retries. Actual error receipts are retained. The model may recover within a bounded run; it cannot bypass authorization, alter eligibility, approve proposals or publish. Historical operations fixtures are explicitly legacy mode and must not be described as document-verified preseason rosters. Current human decisions and any later deterministic redraft/publication are recorded separately in [STATUS.md](STATUS.md).

## Synthetic document visual reasoning

All eight images are generated fictional illustrations with prominent synthetic/not-real markings. The operator evaluator binds each input to a registered digest; it accepts no guardian upload. Every actual response retained `authenticity: unverified` and `requiresHumanReview: true`.

| Synthetic illustration | Model output | Observed check outcome |
|---|---|---|
| Consistent name/date | No specific issue; both matched | Benign control: no suspicion flag |
| Conflicting labeled dates | Review required; identified two different birth-date values | Inconsistency detected |
| Red altered-year illustration | Review required; identified conflicting black/red date text | Text inconsistency detected, but **no explicit visual-anomaly observation**: that check failed |
| Same document for a different fictional player | Review required; read name differed from fictional registration | Name inconsistency detected; deterministic hashing separately establishes exact byte reuse |
| Unreadable low-contrast illustration | Unable to assess; unknown name/date matches | Did not invent missing fields |
| Attendance illustration without age evidence | Unable to assess; identified absent name/date and unsupported evidence | Did not treat missing evidence as authentic or fraudulent |
| Benign JPEG recompression of consistent illustration | No specific issue; both matched | Second benign control: no suspicion flag |
| Localized single-year patch | Review required; identified a mismatched year and a possible localized shading/color difference near the year | Explicit visual anomaly noticed, with uncertainty and no forgery claim |

Measured counts in this development set: all **4/4 inconsistency cases** produced applicable inconsistency findings; **0/2 benign controls** received suspicion flags; both **2/2 unreadable/unsupported cases** were unable to assess. Only **1/2 explicitly visual-anomaly cases** produced a `possible_visual_anomaly` observation. The other image still received an appropriate review warning for contradictory text, but that does not turn its missed visual-anomaly check into a pass. These counts are not real-document detection accuracy, specificity or a guarantee against false positives.

The localized patch response described an unconfirmed image observation, not proof of forgery. Fonts, compression artifacts, missing metadata, shared layouts and the required synthetic watermark are not treated as authentication evidence. The full structured results distinguish inconsistency, possible anomaly, unreadability and unsupported evidence.

## Local checks and similarity limits

Real synthetic guardian upload/review integration exercises local OCR, registered-date eligibility, private original inspection, resubmission, exact duplicates and retention/deletion. OCR does not change registered dates. Exact SHA-256 reuse is scoped to the authorized league; image similarity is a review hint, not identity matching.

The first dHash-only implementation missed the controlled JPEG recompression at distance 6 against a cutoff of 4. The revised, versioned approach uses a 64-bit DCT pHash plus a separate difference hash, comparable aspect ratio within 3%, pHash distance ≤4 and dHash distance ≤8. The controlled recompression measured pHash distance 2/dHash distance 6 and falls within that rule. Both image features remain private and are stripped from reviewer/API responses and removed with original deletion. Older feature versions are not silently compared as compatible new hashes.

This fixes that specific regression; crops, strong transformations and small edits can still be missed, and similar layouts can still collide. No facial recognition, biometric identity profiling or cross-league matching exists. Local OCR supports a limited text/date format and can report inability to assess. No independent issuer authentication or production identity-verification service was evaluated or purchased.

## Review implications

Use actual saved responses, timestamps, arguments, errors and record IDs in the demonstration. Keep the original agent draft distinct from a later draft after human-approved moves. Show document warnings as assistance to a reviewer, not certified authenticity. No unit/mock output, synthetic seeded history or system bounded-stop message should be presented as a new successful model response.

Final video publication, submission fields/permissions and the public hackathon entry remain owner decisions. See [STATUS.md](STATUS.md) for deployment/test status and [META_VERIFICATION.md](META_VERIFICATION.md) for the latest accounting snapshot; this report alone does not certify an uninspected final recording or runtime revision.
