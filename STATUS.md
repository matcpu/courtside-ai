# Status — October 28, 2026

Live: [courtside-ai-one.vercel.app](https://courtside-ai-one.vercel.app). Source: [matcpu/courtside-ai](https://github.com/matcpu/courtside-ai). Database: existing `xdmkgoradmbnjofmbojs` only. See [feature audit](FEATURE_AUDIT.md), [preseason security/limits](PRESEASON.md) and [Meta judging/evidence](META_HACKATHON.md).

## Implemented and tested

- Dedicated preseason setup for season/opening date, age-category divisions/rules, deadlines, registration state, roster limits and proof retention. New ordinary seasons enforce readiness; historical/demo leagues are explicitly legacy until configured.
- Comprehensive coach assessment with saved/resumable drafts, submission revisions, evidence-based rubric/explanation/confidence/flags, and administrator placement approval or reasoned override.
- Real guardian invitation → private signed upload → explicit consent → administrator original-document review → decision/resubmission/history. Revocation, expiry, wrong roles, duplicate flags, over-age rejection and withdrawal are exercised using synthetic actual file bytes.
- Current questionnaire/placement, submitted size-compliant roster, guardian consent, human document approval and current age rules gate scheduling. SQL rechecks readiness, opening date and stale revisions. Rules/roster/consent changes invalidate relevant readiness.
- Manual origin deletion and authenticated retention cleanup remove actual files and preserve decision receipts. Daily Vercel cron configuration and server secret are deployed; the endpoint passed integration checks, but its first future scheduled invocation has not been observed.
- Existing verified-results, corrections/Elo replay, standings/private recorded statistics, balancing, revised publication, private coach inbox and public-privacy workflows remain connected.
- 65 Vitest tests and typecheck passed, including durable pre-dispatch attempt markers and the human-review gate between perception and operations. A fresh isolated production build passed without copying private environment files or touching the stale OneDrive cache. No unit fixture is live inference.
- 97 PostgreSQL assertions passed and rolled back: 65 league operations + 32 preseason. The Storage rows in these SQL suites are metadata fixtures; separate integration/browser tests upload actual bytes.
- All 18 desktop/iPhone-sized Chromium browser tests passed against the production URL, including signed-out judge browsing/signup-screen restrictions, visible admin/coach logins and a separate guardian context, draft return, proof upload/resubmission, explicit review and opening-weekend publication. Physical iOS/Safari capture is not certified by emulation.
- All 21 real preseason API/file integration checks passed locally and in production, including malformed bytes, cross-origin rejection, one-player capability scoping, duplicate/age decisions, actual deletion and retention. The separate 23-check production operations audit also passed, including ordinary seasons' enforced readiness gates.
- All 24 public tables have RLS and direct client writes are revoked. New sensitive tables have explicit direct-client denial policies. Both buckets are private. Private environment/audit files are ignored and commit-blocked; configured private values are checked against client build artifacts.

## Meta and external-provider status

**Meta remains disabled until the human owner confirms credits and authorizes use.** No billable model call, authentication-validation call, actual vision response or model-selected tool run has been made.

The three prepared jobs are image-to-structured scoresheet recognition, contextual preseason interpretation and model-selected operations tools. The private activity view records actual provider identities, digests, parsed output and actions; browser roles cannot forge receipts. The live validator now separates two perception calls from the agent's maximum six turns with an explicit human result-confirmation pause. Its ceiling is eight provider requests/23,000 output tokens, zero transport retries and durable attempt markers even across crashes. Input/image/reasoning usage is additional. No paid stage has run. The disabled three-endpoint preflight passed.

The official rubric and agentic prize were reviewed again. The guide excludes generic sports analyzers/coaches; COURTSIDE's scope is league administration and workflow coordination. Organizer eligibility and live Meta effectiveness are not guaranteed by that positioning.

Readiness work configured a dedicated sending-only test credential privately and verified an actual smoke-test email in Gmail Inbox. Resend requires the account's registered dotted spelling of that same authorized inbox. Supabase SMTP uses `onboarding@resend.dev`; normal UI signup, receipt of its confirmation email and following the received link returned a genuine confirmed session. Coach notification passed controlled pre-send failure → real outbox/backoff → actual provider retry → Gmail Inbox receipt, with no duplicate on repeated dispatch. Guardian invitations arrived but initially landed in Spam; this is not a general deliverability pass. An exposed synthetic invitation was revoked and replaced. All other recipients are suppressed, never redirected. No jewellery domain is used, no domain was purchased and no paid plan/overage was enabled. A verified COURTSIDE domain remains required for general signup/delivery. SMS stays disabled. See [EMAIL_READINESS.md](EMAIL_READINESS.md).

## Deployment evidence

Application source `6f806c4` is Ready in production as Vercel deployment `dpl_5pKoduCWESyCNcVAZ8x37xwvjWT9` and passed [GitHub CI](https://github.com/matcpu/courtside-ai/actions/runs/40738266522). Both stable aliases point to it. The complete rehearsal passed all 18 browser tests, 21 preseason API/file checks, 23 league-operations checks, three disabled-Meta preflight checks and repository/deployed-client scans. Canonical fingerprints confirm the public reference data is unchanged. Follow-up changes refine rehearsal scripts, scans and submission materials; application runtime code is unchanged. Server-only secrets are private; health reports Meta disabled and restricted test email configured. Database checks confirm zero model requests and zero actual provider receipts.

Direct Vercel Hobby CLI deployment works. Automatic GitHub-to-Vercel connection still requires repository-specific owner authorization; no unrelated repository permissions were granted.

## Remaining limits and submission priorities

The production limits below are disclosed for accuracy; they are deferred, not additional hackathon work or submission blockers.

- Human document review is more than declared-date validation, but does not authenticate an issuer, independently establish guardianship or detect every forgery. Only visibly synthetic documents were tested. No facial recognition or Meta processing of guardian documents is used.
- No 500-concurrent-user benchmark, large-season pagination, recovery exercise or production youth-data rollout has been verified. The domain scheduler has a 500-team/250-game unit case. Advanced scheduling, referees, reports, awards and general parent features remain deferred.
- Auth leaked-password protection is disabled; see [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid upgrade was authorized. Informational unused-index notices on the synthetic dataset do not justify removing protective indexes.
- Private synthetic audit seasons/accounts are retained for reproducibility and isolated from the public reference. Only the explicitly authorized adult test mailbox received readiness emails; no actual coaches/parents or real children's records were involved. No purchase, billing authorization, credit redemption or final form submission occurred. Submission fields were inspected read-only; matching draft answers, narration, judge packet and organizer question are prepared.

1. After explicit credit confirmation/authorization, complete both bounded Meta stages and inspect actual receipts/actions. Keep inference off until then. Final model quality remains unverified.
2. Resolve organizer eligibility ambiguity concerning the listed sports analyzer/coach anti-project examples. League-administration positioning is documented, not an organizer approval. No organizer message has been sent.
3. Record/review the 180-second video, provide its accessible URL, confirm the representative's track/team/permission choices and securely hand off private access if needed before submitting by November 4, 2026, 9 PM Eastern.

Restricted email testing is accepted as complete and is **not** a hackathon blocker. No domain purchase, sender expansion, extra email test or product feature is authorized for this readiness pass. Judges can use the working public demo or normal preprovisioned synthetic logins. Fresh role checks passed on desktop/mobile with exactly the two intended synthetic tenants; deadlines now cover judging through November 10. Guardian links remain intentionally short-lived and must be refreshed before handoff; account retirement is manual and disclosed. The public reference fingerprint is unchanged.
