# Status — October 28, 2026

Live: [courtside-ai-one.vercel.app](https://courtside-ai-one.vercel.app). Source: [matcpu/courtside-ai](https://github.com/matcpu/courtside-ai). Database: existing `xdmkgoradmbnjofmbojs` only. See [feature audit](FEATURE_AUDIT.md), [preseason security/limits](PRESEASON.md) and [Meta judging/evidence](META_HACKATHON.md).

## Implemented and tested

- Dedicated preseason setup for season/opening date, age-category divisions/rules, deadlines, registration state, roster limits and proof retention. New ordinary seasons enforce readiness; historical/demo leagues are explicitly legacy until configured.
- Comprehensive coach assessment with saved/resumable drafts, submission revisions, evidence-based rubric/explanation/confidence/flags, and administrator placement approval or reasoned override.
- Real guardian invitation → private signed upload → explicit consent → administrator original-document review → decision/resubmission/history. Revocation, expiry, wrong roles, duplicate flags, over-age rejection and withdrawal are exercised using synthetic actual file bytes.
- Current questionnaire/placement, submitted size-compliant roster, guardian consent, human document approval and current age rules gate scheduling. SQL rechecks readiness, opening date and stale revisions. Rules/roster/consent changes invalidate relevant readiness.
- Manual origin deletion and authenticated retention cleanup remove actual files and preserve decision receipts. Daily Vercel cron configuration and server secret are deployed; the endpoint passed integration checks, but its first future scheduled invocation has not been observed.
- Existing verified-results, corrections/Elo replay, standings/private recorded statistics, balancing, revised publication, private coach inbox and public-privacy workflows remain connected.
- 58 Vitest tests, typecheck and production build passed. This includes Meta schema/receipt/tool-boundary contracts, not live inference.
- 97 PostgreSQL assertions passed and rolled back: 65 league operations + 32 preseason. The Storage rows in these SQL suites are metadata fixtures; separate integration/browser tests upload actual bytes.
- All 16 desktop/iPhone-sized Chromium browser tests passed locally and against the production URL, including visible admin/coach logins and a separate guardian context, draft return, proof upload/resubmission, explicit review and opening-weekend publication. Physical iOS/Safari capture is not certified by emulation.
- All 21 real preseason API/file integration checks passed locally and in production, including malformed bytes, cross-origin rejection, one-player capability scoping, duplicate/age decisions, actual deletion and retention. The separate 23-check production operations audit also passed, including ordinary seasons' enforced readiness gates.
- All 24 public tables have RLS and direct client writes are revoked. New sensitive tables have explicit direct-client denial policies. Both buckets are private. Private environment/audit files are ignored and commit-blocked; configured private values are checked against client build artifacts.

## Meta and external-provider status

**Meta remains disabled until the human owner confirms credits and authorizes use.** No billable model call, authentication-validation call, actual vision response or model-selected tool run has been made.

The three prepared capabilities are substantive model jobs: image-to-structured scoresheet recognition; contextual/uncertainty-aware preseason interpretation; and a bounded operations agent selecting league/history/readiness/proposal/draft tools. The private activity view records actual provider IDs, models, exact request digests, parsed output and resulting actions. Browser roles cannot forge receipts. No contract fixture is shown as live model output. The guarded live validator is prepared but has not been run.

The official rubric and agentic prize were reviewed again. The guide excludes generic sports analyzers/coaches; COURTSIDE's scope is league administration and workflow coordination. Organizer eligibility and live Meta effectiveness are not guaranteed by that positioning.

Resend sending credentials/authorized sender are absent; actual invitation/schedule email acceptance and receipt remain unverified. Private copied invitations and in-app updates work. SMS remains disabled pending credentials and complete signed opt-out handling. Signup confirmation-email receipt is also unverified; synthetic test accounts use supported Auth Admin confirmation, then normal issued sessions.

## Deployment evidence

Application source `97da04d` is Ready in production as Vercel deployment `dpl_JBeWphurnTJYSTFRyDSEv7DCJRKz` and passed [GitHub CI](https://github.com/matcpu/courtside-ai/actions/runs/40730966642). Both stable aliases point to that deployment. Its real-URL verification passed all 16 browser tests, 21 preseason API/file checks and 23 league-operations checks. Follow-up changes only stabilize the repeatable test fixtures and record these results; application runtime code is unchanged. Server-only document/retention secrets are configured privately in Production and Preview; live health reports Meta disabled. Database checks confirm zero model requests and zero actual provider receipts.

Direct Vercel Hobby CLI deployment works. Automatic GitHub-to-Vercel connection still requires repository-specific owner authorization; no unrelated repository permissions were granted.

## Remaining limits and submission priorities

- Human document review is more than declared-date validation, but does not authenticate an issuer, independently establish guardianship or detect every forgery. Only visibly synthetic documents were tested. No facial recognition or Meta processing of guardian documents is used.
- No 500-concurrent-user benchmark, large-season pagination, recovery exercise or production youth-data rollout has been verified. The domain scheduler has a 500-team/250-game unit case. Advanced scheduling, referees, reports, awards and general parent features remain deferred.
- Auth leaked-password protection is disabled; see [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid upgrade was authorized. Informational unused-index notices on the synthetic dataset do not justify removing protective indexes.
- Private synthetic audit seasons/accounts are retained for reproducibility and isolated from the public reference. No real children, real recipient messages, purchase, billing authorization, credit redemption or participant-form submission was involved.

1. After explicit credit confirmation, verify all three real Meta capabilities and inspect their actual receipts/actions; keep the flag off until then.
2. Configure an authorized Resend sender/key and verify controlled delivery, retry behavior and delivery events. Keep SMS disabled until safeguards are complete.
3. Rehearse/record the three-minute model-centered operations demo, verify organizer/judge eligibility/access and finish participant/submission materials before November 4, 2026, 9 PM Eastern.
