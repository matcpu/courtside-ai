# Meta-first operations and evidence

The [official participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) was reviewed again on October 28, 2026. Its weights are Impact 30%, Meta tooling 25%, Technical Depth/Execution 20% and Demo 25%. Best Agentic Use-Case rewards useful autonomy and completion of meaningful multi-step tasks. The three-minute video, code and live product are judging artifacts.

The guide also excludes generic sports analyzers/coaches. COURTSIDE's intended scope is league administration and operational coordination: registration, uncertainty resolution, verified results, division proposals and feasible schedule changes. It provides no tactical coaching or individual-player ability advice. This positioning does not itself guarantee organizer eligibility; that remains an organizer decision.

## Three substantive model jobs

| Capability | Meta's actual responsibility | Deterministic/human boundary | Evidence |
|---|---|---|---|
| Multimodal scoresheet recognition | Read real scoresheet image bytes, return structured names/scores/recorded stats, confidence and uncertainty | Validate types/names/totals/hash; human compares original and confirms the official result | Actual provider response ID/model, structured extraction, linked scoresheet and request digest |
| Preseason placement interpretation | Interpret prior competition context, contradictory assessment fields, coach confidence and division preference; suggest clarification and an explained tier | PostgreSQL recomputes the evidence rubric; administrator approves or explains an override | Actual interpretation receipt linked to an exact questionnaire revision; no guardian data or documents |
| Operations agent | Select tools, investigate verified team history, inspect readiness, prepare a supported balance proposal and feasible schedule draft | Strict allowlist, bounded turns, deterministic proposal/scheduler validation, no approval/publication/messaging tools | Actual selected calls, arguments, outcomes, draft/proposal IDs and provider replies linked to an auditable run |

The agent's tools are `inspect_league`, `inspect_team_history`, `inspect_preseason_readiness`, `propose_balance` and `draft_schedule`. It must inspect successfully before acting and investigate game history before proposing competitive changes. Mutating tools run at most once per run. A draft uses currently approved divisions; a proposed move is never silently applied. The model can explain a blocker rather than claim an impossible task succeeded.

## Visible product evidence

**Meta AI activity** presents all three jobs and private server-recorded receipts. Each actual call can show model ID, provider response ID, timestamp, parsed output, chosen tools, resulting actions and the SHA-256 of the exact request body. Hidden reasoning, raw images, API keys and guardian information are not retained in this view. Browser roles cannot write a forged provider receipt; only the server writer can do so after provider completion. Unit-test fixtures never populate it.

At present **Meta is disabled**. The product explicitly shows prepared/paused integrations and an empty evidence history. No actual model response, vision-quality result or autonomous tool-selection success is claimed. The current passing tests are provider contracts and real deterministic/Supabase workflows, not proof of live model behavior.

## Verification after credits are confirmed

Do not enable the flag or run a paid request until the human owner confirms credits and authorizes use. Credential presence does not prove credit availability or model authentication. No billing change or credit redemption is automated.

After that authorization, deliberately enable `META_API_ENABLED` in the intended environment, keep the eligible model configurable, and run the prepared controlled validator:

```sh
node scripts/verify-meta-live.mjs --credits-confirmed --stage perception
# STOP: administrator reviews and confirms the actual scoresheet in the UI.
node scripts/verify-meta-live.mjs --credits-confirmed --stage operations
```

It requires enabled local/server configuration and explicit owner authorization. Prepared fixtures cover an inconsistent questionnaire, actual image bytes and a model-selected operations run. The two-stage sequence pauses for human result confirmation BEFORE the agent, preventing a later confirmation from invalidating its proposals/draft. It requires successful tools, NEW pending records, genuine receipts and unchanged public state. Output goes to ignored `.local/meta-live-<fixture-run>.json` and private activity screens. Durable per-feature markers are written before dispatch, so a timeout/crash cannot trigger another automatic paid attempt. The ceiling is eight provider requests and 23,000 output tokens; input/image/reasoning usage is additional and no dollar ceiling is implied. Transport retries are zero. Live mode has **not run**; the safe `--preflight` passed. See [RECORDING_RUNBOOK.md](RECORDING_RUNBOOK.md).

Current API contracts were checked against [image understanding](https://dev.meta.ai/docs/image-understanding), [tool calling](https://dev.meta.ai/docs/tool-calling), [structured output](https://dev.meta.ai/docs/structured-output) and the [Responses schema](https://dev.meta.ai/docs/api-reference/responses/schemas). Tool calls are model-selected (`auto`); outputs are returned with matching call IDs. Applications still validate schemas and permissions independently.

## Submission demonstration

The final video should spend its time on observed model work, useful saved actions and approval boundaries. Show the original image and actual extraction; a contradictory assessment and actual clarification; then the agent's tool selection and resulting draft. Display response IDs in the activity view and conclude with a human-approved change reflected in the public schedule.

Use a prepared upcoming-season preseason tenant and a separate current-season synthetic historical tenant if needed. Say explicitly that these are separate seasons. Do not imply the legacy historical seed has document-verified rosters, show contract fixtures as live output, or hide missing provider delivery. Re-record the final demo only after actual Meta verification. See [DEMO.md](DEMO.md).
