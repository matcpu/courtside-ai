# Product completion audit — October 28, 2026

Scope: every feature in the original COURTSIDE AI request. **Working** means exercised against the real Supabase project; it does not mean unlimited production scale or every possible scenario. **Partial** identifies the exact missing behavior. Provider contract tests are not live provider verification. No billable Meta calls are authorized until the owner confirms credits.

## Feature-by-feature assessment

| Original requirement | Completion and evidence | Remaining limitation |
|---|---|---|
| League creation and season configuration | Working: private season creation, tenant membership, season name and cutoff; isolated demo creation via deployed API | No season rollover, archive, or full configuration editor |
| Team registration | Working: real coach login, questionnaire submission, persistence and administrator approval; desktop/mobile browser walkthrough | Invitations require an existing confirmed account; no invitation-email onboarding |
| Coach skill assessment | Working deterministic questionnaire/rating rubric; initial recommendation is pending approval | Meta interpretation is implemented but paused and not provider-verified |
| Initial competitive placement | Working: approved division and starting rating persisted; coach cannot approve own placement | Rubric is an MVP policy rather than a calibrated scouting model |
| Player roster and age eligibility | Working declared birth-date/cutoff and guardian-consent review, coach ownership, private roster | Document authenticity, document review UI and retention/deletion are not implemented |
| Gym/court availability | Working: administrator creates courts and confirmed time blocks; unconfirmed/out-of-window scheduling rejected | No permit approval process or recurring-calendar editor |
| Automated game scheduling | Working deterministic round-robin round, court/team collision and rest checks, byes and historical fixture preservation; DB independently validates drafts | One replacement round at a time; no whole-season optimizer, team blackout calendar, referee constraints, travel fairness or concurrent-user load certification |
| Scoresheet photo upload | Working: actual PNG uploaded/downloaded from private Storage through real coach/admin sessions; duplicate hash blocked; mobile upload exercised | Physical iOS/Safari camera capture and image-retention cleanup remain untested |
| AI scoresheet extraction | Partial: strict structured Meta image adapter, validation and uncertainty contract tests | **Disabled by owner instruction. No live Meta recognition or key-validity request has been made.** Manual upload/review works and is labeled manual |
| Result validation and corrections | Working: original photo review, names/scores/stat validation, human confirmation, correction reason, immutable history and Elo replay; unauthorized coach confirmation denied | No league dispute/appeal workflow |
| Standings and competitive ratings | Working: only confirmed results count; Elo recomputes after corrections; division filter | No historical division-membership standings or season rollover |
| Player statistics | Working persistence and private display of explicitly recorded jersey-level rows; SQL tests cover correction replacement, null preservation and opponent privacy | No player profiles, imported box-score mapping or awards; sample photo intentionally contains no individual statistics |
| Dynamic competitive rebalancing | Working: verified three-game evidence, one-tier proposal and stale-evidence invalidation | Simple policy; no calibrated predictive model or automatic unattended division moves |
| Proposed division adjustments | Working: approve/reject, actor audit and persisted placement; coach cannot approve | Schedule regeneration requires the administrator's next action |
| Schedule regeneration and changes | Working: new same-division pairs, stale revision rejection, human publication, rejected drafts and version history | Each draft explicitly replaces prior future fixtures; regeneration is not an unattended background process |
| Email notifications | Partial: atomic outbox, idempotency, leases, bounded retry state and adapter; unconfigured delivery returns an honest error | Resend sending credential/authorized sender absent; no real email acceptance or delivery, recurring retry worker or delivery webhook |
| SMS notifications | Partial: consent, phone validation and opt-out setting saved; fail-closed adapter | Twilio credentials, signed inbound STOP handling and real SMS verification absent; sending stays disabled |
| Coach notification history | Working: publication creates actual private in-app messages for every approved team, including teams losing fixtures; coach read receipts persist | External email/SMS remain separate and incomplete as above |
| Referee assignments | Not implemented; referee read role exists | Availability, assignment/conflict rules and screens deferred (P1) |
| Administrator dashboard | Working database-backed approvals, results, courts, schedule history, balance proposals, member invitations and coach assignment | No operations monitoring, large-season pagination or disaster-recovery exercise |
| Coach portal | Working own registration/roster/upload controls, private inbox, published fixtures; desktop and mobile emulation tested | No parent portal or coach blackout-date editor |
| Public league schedule/results | Working whitelisted public snapshot; signed-out browser tests verify no roster, contacts, photo paths or approving-account IDs | No youth player profiles or private box scores are exposed |
| Weekly/monthly league insights | Partial: verified dashboard totals and balance evidence | No scheduled reporting or period summaries |
| Player recognition/awards | Not implemented (P2) | Must use verified, explicitly recorded stats when added |
| Meaningful Meta agent orchestration | Partial: bounded tool orchestration, strict schemas and human approval boundaries implemented | Paused with all other Meta calls; actual model tool selection and multimodal quality remain unverified |

## Security and production boundaries

All 18 public tables have RLS; direct client writes are revoked. Runtime APIs use the caller's verified JWT, not a service-role key. Private files use short-lived signed URLs. Tests exercise tenant isolation and role boundaries. Public snapshots exclude youth identities, coach contacts, original photos and private statistics.

The separate audit-account preparation script uses the authenticated Supabase CLI to access the supported Auth Admin API. Its administrative key stays in memory and is never stored in the app, test credentials file or Git. Synthetic passwords are saved only under ignored `.local/`, which the commit guard also blocks even if force-added. Normal account confirmation settings are unchanged. Browser tests issue real passwords/JWTs; database tests additionally exercise roles in a rolled-back transaction.

The latest advisor pass has no database security findings, but reports Auth leaked-password protection disabled. Review [Supabase's password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before accepting real users; no paid plan upgrade was authorized. Informational unused-index notices on this small synthetic database are retained, rather than removing protective indexes prematurely.

This is a working core operations MVP, not a certification for a live youth league. Real children, paid delivery, production-scale load and document processing should wait for their respective verification and operational controls.

## Improvements completed during this audit

- Added actual private coach inbox delivery and read receipts in the publication transaction.
- Fixed notification coverage for approved teams without a future fixture after publication.
- Added administrator coach reassignment, clearing previous contact/consent and suppressing old pending destinations.
- Connected verified player statistics to private API snapshots and the Standings screen; restricted raw statistics to authorized operations roles/owning coaches.
- Added division standings filtering and limited coach upload choices to their own teams' games.
- Fixed unreachable sidebar authentication controls on short screens, notification banners blocking mobile review controls, hidden dialog errors, and duplicate browser Auth clients.
- Cleared private snapshot/photo state immediately on sign-out.
- Added repeatable live API and real authenticated desktop/mobile browser audits, with no provider mocks in these workflows.

Verification counts, deployed revision and final live results are recorded in [STATUS.md](STATUS.md) and the reproduction steps in [TESTING.md](TESTING.md).

## Three highest-priority submission tasks

1. **After the owner confirms credits:** enable Meta deliberately, verify the eligible configured model, run real questionnaire/image/agent requests and record their actual outputs and human approvals. Until then `META_API_ENABLED=false` remains enforced.
2. Configure an authorized Resend sender and sending secret, verify delivery to a controlled recipient, then exercise retries and delivery events. Keep SMS disabled until its credentials and signed STOP handling are verified.
3. Rehearse and record the three-minute synthetic demo, verify judge access to the public repository/live site/video, and finish the participant/submission forms. Clearly disclose deferred referee/reporting/scale work and keep secrets off-screen.
