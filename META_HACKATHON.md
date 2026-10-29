# Meta-powered operations and evidence

The [official participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) was reviewed again on October 28, 2026. Its weights are Impact 30%, Meta tooling 25%, Technical Depth/Execution 20% and Demo 25%. Best Agentic Use-Case rewards useful autonomy and completion of meaningful multi-step tasks. The three-minute video, code and live product are judging artifacts.

The guide also excludes generic sports analyzers/coaches. COURTSIDE's intended scope is league administration and operational coordination: registration, uncertainty resolution, verified results, division proposals and feasible schedule changes. It provides no tactical coaching or individual-player ability advice. The owner reports that this league-administration concept was disclosed at registration and accepted; further organizer eligibility discussion is not a work gate.

## Three substantive model jobs

| Capability | Meta's actual responsibility | Deterministic/human boundary | Evidence |
|---|---|---|---|
| Multimodal scoresheet recognition | Read real scoresheet image bytes, return structured names/scores/recorded stats, confidence and uncertainty | Validate types/names/totals/hash; human compares original and confirms the official result | Actual provider response ID/model, structured extraction, linked scoresheet and request digest |
| Preseason placement interpretation | Interpret prior competition context, contradictory assessment fields, coach confidence and division preference; suggest clarification and an explained tier | PostgreSQL recomputes the evidence rubric; administrator approves or explains an override | Actual interpretation receipt linked to an exact questionnaire revision; no guardian data or documents |
| Operations agent | Select tools, investigate verified team history, inspect readiness, prepare a supported balance proposal and feasible schedule draft | Strict allowlist, bounded turns, deterministic proposal/scheduler validation, no approval/publication/messaging tools | Actual selected calls, arguments, outcomes, draft/proposal IDs and provider replies linked to an auditable run |
| Synthetic document experiment | Examine SHA-bound fictional illustrations for text inconsistencies, unreadability and possible visual anomalies | Operator-only generated cases, never guardian-file AI input; no authenticity claim or automatic eligibility decision | Eight actual experimental responses, including an explicit visual-anomaly miss and benign controls |

The agent's tools are `inspect_league`, `inspect_team_history`, `inspect_preseason_readiness`, `propose_balance` and `draft_schedule`. It must inspect successfully before acting and investigate game history before proposing competitive changes. Mutating tools run at most once per run. A draft uses currently approved divisions; a proposed move is never silently applied. The model can explain a blocker rather than claim an impossible task succeeded.

## Visible product evidence

**Meta AI activity** presents all three jobs and private server-recorded receipts. Each actual call can show model ID, provider response ID, timestamp, parsed output, chosen tools, resulting actions and the SHA-256 of the exact request body. Hidden reasoning, raw images, API keys and guardian information are not retained in this view. Browser roles cannot write a forged provider receipt; only the server writer can do so after provider completion. Unit-test fixtures never populate it.

**Current observed status:** All three core Meta capabilities have genuine provider evidence. The owner-confirmed 78–43 result preceded the actual model-selected operations run. Further real evaluations covered challenging scoresheets, questionnaire context, eight synthetic document illustrations, and failed tool lookups followed by recovery. The finite cases and failures are documented in [EVALUATION_REPORT.md](EVALUATION_REPORT.md). This does not establish broad recognition or fraud-detection accuracy.

The initial agent narrative called a Riverside Ravens proposal “Parkdale Panthers” despite correct saved IDs/tool outcomes. Its original response is preserved. Canonical record cards and limited deterministic narrative checks now display the discrepancy; enriched proposal-tool results include the correct team/division labels. Failed tools remain explicit rather than receiving unconditional success icons. Local guardian-document processing stays separate from the operator-only synthetic Meta experiment; see [DOCUMENT_SCREENING.md](DOCUMENT_SCREENING.md).

## Authorized spending and verification

The owner confirmed promotional credits and superseded the historical eight-request/23,000-output-token limit with autonomous development/evaluation authorization within approximately **120 of the original 150 credit units**, preserving at least **30**. The earlier ceiling is historical evidence, not the current cumulative budget. No billing settings, payment methods or plans were changed.

Every paid dispatch now requires a serialized, service-only Supabase reservation, approved private actor/tenant scope, bounded model/output contract and a recent real credit observation. Exact attempted requests cannot be silently repeated. Settlements preserve actual provider identity, usage and sanitized output. Conservative uncached pricing and a two-times safety multiplier debit the global ledger. Uncertain usage retains its reservation and pauses inference; stale observations, insufficient promotional headroom and unexpectedly high usage also stop further requests. These are software-side safeguards, not a guaranteed Meta card-spending hard cap.

The original two-stage validator completed: genuine perception responses, explicit human result confirmation, then the agent. Retakes should inspect saved responses and timestamps, not repeat that sequence or fabricate new model output. Additional materially useful evaluations remain subject to the current cumulative spending guard. See [META_VERIFICATION.md](META_VERIFICATION.md) for accounting, freshness and reporting limitations.

Production and saved local inference remain paused outside deliberate operator work. Actual receipts remain available for review and recording without inference. No public/background inference or automatic paid retry is enabled. The agent cannot grant the human approvals that its saved proposals and drafts still require.

Current API contracts were checked against [image understanding](https://dev.meta.ai/docs/image-understanding), [tool calling](https://dev.meta.ai/docs/tool-calling), [structured output](https://dev.meta.ai/docs/structured-output) and the [Responses schema](https://dev.meta.ai/docs/api-reference/responses/schemas). Tool calls are model-selected (`auto`); outputs are returned with matching call IDs. Applications still validate schemas and permissions independently.

## Submission demonstration

The final video should spend its time on observed model work, useful saved actions and approval boundaries. Show the original image and actual extraction; a contradictory assessment and actual clarification; then the agent's tool selection and resulting draft. Display response IDs in the activity view and conclude with a human-approved change in the private synthetic schedule. Preserve the original public reference.

Use the upcoming preseason tenant and separate historical operations tenant, and identify them as separate seasons. The legacy historical seed is fictional input, not document-verified youth data. Preserve real failed-tool evidence and the observed summary correction. The synthetic document experiment is explicitly experimental; it does not authenticate government documents or send real guardian proofs to Meta. Final video publication and submission require owner approval. See [DEMO.md](DEMO.md).
