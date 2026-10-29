# Actual Meta verification — October 28, 2026 Eastern

The owner confirmed $150 promotional credits and authorized one bounded sequence. The existing key authenticated against the non-inference model catalog, which lists `muse-spark-1.3`. The billing dashboard showed $150 free credits in use. No billing setting, purchase or plan was changed.

Two real requests completed through `https://api.meta.ai/v1/responses` using `muse-spark-1.3`. They ran through a loopback-only server against the existing private synthetic Supabase fixtures. Production inference remained disabled. Trusted server receipts are visible in Meta AI activity in the two private seasons; no browser can manufacture them.

| Job | Actual provider response | Observed result | Input tokens | Output tokens, including reasoning |
|---|---|---|---:|---:|
| Placement | `resp_6ae2aaf0f442588ab0f040a6` | Identified scoring margins without any recorded games, 90% returning players despite zero years together, and unsupported top-tier certainty; asked specific follow-up questions. Suggested tier 2 with 0.2 evidential confidence. Independent rubric remained tier 2/rating 970. No placement approved. | 611 | 1,300 |
| Scoresheet | `resp_6ae2aaf57943f7b1407c4f16` | Read Eastside Eagles 78–43 Riverside Ravens from the uploaded image. No unrecorded player statistics, no extraction warnings. Matches the original synthetic image. Result remains unconfirmed pending the owner's explicit human decision. | 2,087 | 322 |
| Operations agent | Not run | Protected human result-confirmation gate. No tool-selection or saved agent-action success is claimed yet. | — | — |

Total so far: **2 requests, 2,698 input tokens, 1,622 output tokens, 4,320 total tokens**, including 1,026 reasoning tokens already counted within output. At the [published standard rates](https://dev.meta.ai/docs/pricing-rate-limits) of $1.25/M input and $4.25/M output, the conservative estimate is **US$0.010266**. This is a rate calculation, not a provider invoice or exact credit debit. The provider usage dashboard still showed zero while warning of up to one hour of reporting delay; no zero-cost claim is made.

The remaining allowance is at most six operations requests, 2,500 output tokens each. The original sequence ceiling stays eight requests/23,000 output tokens. Reasoning tokens count toward provider output; input/image tokens are additional. No transport retries, background inference, public inference, document AI calls or additional paid runs are authorized.

`src/lib/meta-control.ts` enforces fixture actors/tenants, model, per-feature request ceilings and output budgets. It also stops on unexpectedly large reported input above 100,000 tokens per request. An fsynced journal is written before provider dispatch. A timeout, failed/uncertain response, missing usage or excessive output stops further dispatch. Attempt markers cannot be deleted to bypass the authorization. The local process is disabled while awaiting human review. Production and saved `.env.local` stay disabled.

## Resume only after explicit human confirmation

1. Review the original and extraction; obtain the owner's explicit confirmation of the fictional 78–43 result. Record that human-authorized action through the normal administrator review UI. Do not rerun perception.
2. Start the loopback-only controlled launcher: `node scripts/serve-meta-verification.mjs --credits-confirmed`.
3. In a separate PowerShell terminal, set `E2E_BASE_URL=http://127.0.0.1:3000` and `META_VERIFICATION_LOCAL=true`, then run `node scripts/verify-meta-live.mjs --credits-confirmed --stage operations` once. The existing private manifest and durable journals must remain intact.
4. Inspect actual selected tools, arguments, outcomes and NEW pending records. A tool error is not a success. Preserve failures and stop after provider/billing uncertainty; additional paid runs require separate owner authorization.
5. Stop the controlled server and restart ordinary paused mode. Confirm local and production health report `meta:false` before retakes, deterministic redrafting or deployment. Human move/publication decisions remain separate.

Private reports and journals stay under ignored `.local/`. No final video or entry has been published or submitted.
