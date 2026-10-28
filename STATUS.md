# Status — October 28, 2026

This document distinguishes implementation from verification. The entire P0 workflow is **not yet certified end to end**: live Meta, email and confirmed-account browser mutations still need account credentials/owner actions.

## Completed and tested

- Connected the existing public `matcpu/courtside-ai` repository and fetched `main`; baseline was README-only commit `6865228`.
- Installed compatible pinned Next.js 16.4.3 / React 19.3.1 / Supabase JS 2.118.0 / TypeScript / Tailwind / Vitest / Playwright tooling.
- Applied and verified schema/RLS/private storage only in `xdmkgoradmbnjofmbojs`. Security advisor reports no findings.
- Created a real, synthetic reference league: 12 teams, three divisions, two courts, 18 historical results and versioned fixtures.
- Implemented command center, coach registration/assessment, roster review, court availability, schedule drafts/publication/history, scoresheet review, standings, Elo monitor, division approvals, notification history and member access controls.
- Typecheck and production build passed; 39 unit assertions passed. Scheduler test includes 500 teams / 250 games; new tests verify disabled Meta requests never call the provider and private environment files are rejected even when force-staged.
- 53 real PostgreSQL assertions passed and rolled back: placement, eligibility/consent, balance evidence, rejections, court conflicts, publication, multi-team notification leases/retry state, duplicate sheets, result correction/replay, human-review gates, tenant isolation and public privacy. The suite includes an approved division move followed by a regenerated and approved schedule with frozen completed games, and reopening the same original scoresheet with permanent correction history.
- 12 desktop/mobile browser/API assertions passed against both the local app and the public production deployment, using the real database and no Vercel login or bypass token.
- [GitHub-hosted CI passed](https://github.com/matcpu/courtside-ai/actions/runs/40706519482) for pushed commit `f09f827` on Linux: installation, typecheck, 35 unit tests and production build.
- npm audit reports zero vulnerabilities after moving the Vercel CLI outside project dependencies and regenerating the portable lockfile.
- Vercel global CLI 65.5.0 authenticated as `matcpu`; free Hobby project `matcpus-projects/courtside-ai` created and linked. Shared Vercel MCP OAuth completed in user configuration. Standalone Vercel guidance installed after the plugin marketplace installation failed.
- Linux Vercel production deployment built successfully and is marked Ready. Public application: [courtside-ai-one.vercel.app](https://courtside-ai-one.vercel.app). Stable alternate origin: [courtside-ai-matcpus-projects.vercel.app](https://courtside-ai-matcpus-projects.vercel.app).
- Supabase Site URL is set to the stable production origin; explicit localhost and production redirects were saved and visually verified. Signup supplies the current origin as its return URL.
- Application and documentation milestones `b08c657` / `f09f827` are pushed to public `main`; no secret environment files are tracked. Latest application deployment `dpl_FqG6cGhvqmLmnftPNq4TSQ6Eeoec` is Ready and the production tests passed again after it was promoted.
- Final database verification: all 18 public tables have RLS; both file buckets are private; rolled-back tests left zero test users and only the intended synthetic reference league.

## Implemented but unverified

- Meta Muse Spark questionnaire interpretation, strict image extraction, schedule explanations and bounded tool-calling agent. Mock contract tests pass; **no live model call has been made**.
- Resend sending adapter with idempotency, durable claims, retries and truthful `accepted` state. **No real email has been sent or delivered by this application**.
- Actual Supabase email signup/confirmation and a complete signed-in browser mutation walkthrough. Database authorization/workflow assertions pass; these are not an Auth token issuance test.
- Manually dispatched Vercel workflow needs repository deployment secrets/variables before it can run. Hosted CI is verified above.

## In progress

- GitHub-to-Vercel automatic deployment connection. CLI attempt was rejected by the provider; direct CLI deployment works.

## Blocked by credentials or account-owner action

- Meta API key setup is complete: the owner pasted the key directly into ignored `.env.local` in Notepad; it is stored as a Vercel Secret in Production and Preview. `META_API_ENABLED=false` keeps inference and agent requests paused while participant credits are pending. No model call or key-validity request was made. Credential presence does not prove provider authentication.
- Meta participant credits have not been claimed or verified. The guide requires a card for API use; no payment authorization was made. See CREDIT_SETUP.md.
- Resend API sending credential and an authorized sender for Courtside. The connected account has a verified unrelated business domain; it has not been repurposed or changed.
- Actual confirmed Courtside user session for signed-in live browser testing. No shared password or authentication bypass was created.
- Vercel GitHub app installation: the provider approval page is open. It requests repository write permissions; access must be restricted to `matcpu/courtside-ai` and approved by the owner. Browser input/capture timed out on this permission page; no access to other repositories was granted.
- Twilio credentials, consented test destination and complete signed opt-out integration. SMS sending remains disabled.

## Not started / deferred

- Recurring notification retry/agent worker and provider delivery webhooks. Configured publication automatically starts one delivery pass; subsequent retries/larger queues currently need another pass.
- Referee availability and assignment screens; referee read role exists.
- Youth document authenticity review, permit workflows and document retention/deletion policies.
- Advanced reporting, verified player awards, parent portal, payments and predictive analytics.
- Production concurrency/load testing, pagination for very large seasons and disaster-recovery exercise.

No paid services, phone numbers, credit redemptions or external participant forms have been authorized or submitted by the build.
