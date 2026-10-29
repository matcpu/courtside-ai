# Actual Meta verification — October 29, 2026 Eastern

The owner confirmed $150 promotional credits and later authorized autonomous development, prompt improvement and synthetic evaluation within approximately 120 of the original 150 credit units, preserving at least 30. This supersedes the initial eight-request/23,000-output-token ceiling. The saved key authenticated against Meta's non-inference catalog, which lists `muse-spark-1.3`. No billing setting, purchase or plan was changed.

Actual requests use `https://api.meta.ai/v1/responses`, model `muse-spark-1.3`, with provider storage disabled. Operator runs use existing private synthetic Supabase environments while production inference stays paused. Trusted receipts are visible in Meta AI activity; browser clients cannot manufacture them. Case-level outputs and observed limitations are in [EVALUATION_REPORT.md](EVALUATION_REPORT.md).

| Job | Actual provider response | Observed result | Input tokens | Output tokens, including reasoning |
|---|---|---|---:|---:|
| Placement | `resp_6ae2aaf0f442588ab0f040a6` | Identified scoring margins without any recorded games, 90% returning players despite zero years together, and unsupported top-tier certainty; asked specific follow-up questions. Suggested tier 2 with 0.2 evidential confidence. Independent rubric remained tier 2/rating 970. No placement approved. | 611 | 1,300 |
| Scoresheet | `resp_6ae2aaf57943f7b1407c4f16` | Read Eastside Eagles 78–43 Riverside Ravens from the actual uploaded image, with no unrecorded statistics. The owner explicitly confirmed it; the normal administrator UI recorded the result before the agent ran. | 2,087 | 322 |
| Operations agent, five responses | Initial `resp_6ae2bece5b25df23cd854120`; final `resp_6ae2bedc8c80d9be196847f9` | Model selected all five allowed tool types and saved two pending proposals and a feasible draft, without approving or publishing. Original secondary team-name mislabel is preserved and visibly checked against canonical saved records. | 47,238 | 2,043 |

The original end-to-end sequence completed with **7 provider responses**, 49,936 input and 3,665 output tokens. Its five agent continuations were genuine model choices, not a replayed tool script. The initial pending records were Eastside Eagles up one tier, Riverside Ravens down one tier, and a draft using the divisions approved at that time. The owner subsequently approved the two synthetic moves. Their actual current decision/publication state is recorded in [STATUS.md](STATUS.md); the original agent draft is distinct from a later deterministic redraft after human division decisions.

The expanded evaluation added **15 genuine responses**: five new scoresheet images, two additional questionnaires and eight synthetic document illustrations. The original image/contradictory questionnaire evidence was reused without another request. Two further actual operations recovery runs contributed ten responses, bringing the accounting snapshot below to 32. The first recovered and saved actions before the server's time bound; the second also produced a final model summary explicitly acknowledging the failed lookup before successful recovery. See the evaluation report for the difference between successful tool outcomes and complete model narration.

## Cumulative accounting snapshot

| Measure | Observed ledger value |
|---|---:|
| Genuine completed provider responses | 32 |
| Input tokens | 164,392 |
| Output tokens, including reasoning | 18,482 |
| Cached input tokens reported by Meta | 94,902 |
| Uncertain provider reservations | 0 |
| Conservative estimate, all input priced uncached | US$0.2840385 |
| Software safety debit, two-times conservative estimate | 0.568077 credit guard units |

At the [published standard rates](https://dev.meta.ai/docs/pricing-rate-limits) of US$1.25/M input and US$4.25/M output, the uncached calculation above deliberately ignores cache discounts. It is a safety estimate, not a provider invoice or exact credit debit. Reasoning is already counted in reported output; image input is counted in provider input usage.

The last successful **real billing-UI observation** was **149.98 free credit units at 2026-10-29 03:30 UTC**. Later portal attempts remained loading, so that figure must not be described as a freshly verified balance. Subtracting every cumulative guard debit from that older observation gives 149.411923 units of software accounting headroom; it is not a current provider balance or a guarantee. The observation expired at 04:30 UTC and the budget is paused. Further inference requires a fresh genuine credit check; other review work can continue.

## Controls for further authorized work

The service-only, RLS-protected global Supabase ledger serializes a conservative reservation before every dispatch, including concurrent operator work. It imports the original seven responses into cumulative accounting, blocks duplicate attempted requests and enforces both the 120-unit allowance and a projected 30-unit reserve against a recent real observation. A two-times safety multiplier and three-unit in-flight reservation buffer protect against pricing/currency/reporting uncertainty.

Every request must match an approved private actor/tenant scope, configured model and bounded output contract. Evaluation cases are registered as generated synthetic inputs and bound to exact input digests. Provider failure, unverifiable usage or an uncertain transport outcome keeps the reservation and pauses further inference. Responses and safe usage summaries survive structured-output validation errors. Automatic transport retries and background/public inference remain disabled.

These software controls are not a guaranteed provider hard cap or permission to charge a card. Keep saved local/production inference paused outside deliberate operator evaluations and during recording retakes. Do not clear durable attempt records to repeat work. New materially useful synthetic evaluations may use the owner's expanded allowance only while the guard and credit freshness checks pass. No real guardian documents may be supplied to Meta under that authorization.

Private reports and journals stay under ignored `.local/`. No final video or entry has been published or submitted.
