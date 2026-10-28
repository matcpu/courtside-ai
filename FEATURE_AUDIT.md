# Product completion audit — October 28, 2026

Scope: every feature in the original COURTSIDE AI request. **Working** means exercised against the real Supabase project; it does not mean unlimited production scale or every possible scenario. **Partial** identifies the exact missing behavior. Provider contract tests are not live provider verification. No billable Meta calls are authorized until the owner confirms credits.

## Feature-by-feature assessment

| Original requirement | Completion and evidence | Remaining limitation |
|---|---|---|
| League creation and season configuration | Working: preseason setup editor for opening date, cutoff, category/tier age ranges, deadlines, registration status, roster limits and retention | No season rollover or archive workflow |
| Team registration | Working: real coach login, questionnaire submission, persistence and administrator approval; desktop/mobile browser walkthrough | Invitations require an existing confirmed account; no invitation-email onboarding |
| Coach skill assessment | Working comprehensive assessment, save/resume drafts, submission revisions, record/margin/continuity rubric, explanation, confidence and inconsistency flags | Self-reported evidence is not independently verified; Meta interpretation is prepared but paused |
| Initial competitive placement | Working: administrator approval/override with explanation and questionnaire-revision binding; coach cannot approve | Rubric is an MVP operational policy, not a calibrated scouting model |
| Player roster and age eligibility | Working real-file guardian invitation/upload/consent, administrator original-document review, age/duplicate flags, approve/reject/resubmission, history, withdrawal and deletion | Tested with synthetic proofs only; no issuer authentication, biometric checks or independent guardianship validation |
| Guardian onboarding | Working mobile-friendly one-player expiring/revocable invitation portal; pending/approved/resubmission status, no account bypass or public youth data | Invitation possession and guardian identity attestation are not independent identity proof; automated email delivery needs Resend |
| Team preseason readiness | Working questionnaire → placement → submitted roster → every active player consented/document-approved/currently age-eligible; SQL and scheduler enforce opening weekend and readiness | Existing historical/demo leagues are explicitly legacy mode until configured; seed rosters are never represented as document-verified |
| Gym/court availability | Working: administrator creates courts and confirmed time blocks; unconfirmed/out-of-window scheduling rejected | No permit approval process or recurring-calendar editor |
| Automated game scheduling | Working deterministic round-robin round, court/team collision/rest checks, confirmed availability, opening-date and preseason-readiness gates; DB independently validates drafts/publication | One replacement round at a time; no whole-season optimizer, team blackout calendar, referee constraints, travel fairness or concurrent-user load certification |
| Scoresheet photo upload | Working: actual PNG uploaded/downloaded from private Storage through real coach/admin sessions; duplicate hash blocked; mobile upload exercised | Physical iOS/Safari camera capture and image-retention cleanup remain untested |
| AI scoresheet extraction | Partial: strict structured Meta image adapter, validation and uncertainty contract tests | **Disabled by owner instruction. No live Meta recognition or key-validity request has been made.** Manual upload/review works and is labeled manual |
| Result validation and corrections | Working: original photo review, names/scores/stat validation, human confirmation, correction reason, immutable history and Elo replay; unauthorized coach confirmation denied | No league dispute/appeal workflow |
| Standings and competitive ratings | Working: only confirmed results count; Elo recomputes after corrections; division filter | No historical division-membership standings or season rollover |
| Player statistics | Working persistence and private display of explicitly recorded jersey-level rows; SQL tests cover correction replacement, null preservation and opponent privacy | No player profiles, imported box-score mapping or awards; sample photo intentionally contains no individual statistics |
| Dynamic competitive rebalancing | Working: verified three-game evidence, one-tier proposal and stale-evidence invalidation | Simple policy; no calibrated predictive model or automatic unattended division moves |
| Proposed division adjustments | Working: approve/reject, actor audit and persisted placement; coach cannot approve; administrator browser approval verified on live desktop/mobile | Schedule regeneration requires the administrator's next action |
| Schedule regeneration and changes | Working: new same-division pairs, stale revision rejection, human publication, rejected drafts and version history | Each draft explicitly replaces prior future fixtures; regeneration is not an unattended background process |
| Email notifications | Partial: atomic outbox, idempotency, leases, bounded retry state and adapter; unconfigured delivery returns an honest error | Resend sending credential/authorized sender absent; no real email acceptance or delivery, recurring retry worker or delivery webhook |
| SMS notifications | Partial: consent, phone validation and opt-out setting saved; fail-closed adapter | Twilio credentials, signed inbound STOP handling and real SMS verification absent; sending stays disabled |
| Coach notification history | Working: publication creates actual private in-app messages for every approved team, including teams losing fixtures; coach read receipts persist | External email/SMS remain separate and incomplete as above |
| Referee assignments | Not implemented; referee read role exists | Availability, assignment/conflict rules and screens deferred (P1) |
| Administrator dashboard | Working preseason progress, settings, placement override, private proof-review queue, flags, reasoned decisions, history and retention controls alongside existing operations | No large-season pagination or disaster-recovery exercise |
| Coach portal | Working saved/resumable assessments, own roster/invitations/readiness, private inbox and published fixtures; desktop/mobile tested | No coach blackout-date editor or general parent portal beyond secure verification |
| Public league schedule/results | Working whitelisted public snapshot; signed-out browser tests verify no roster, contacts, photo paths or approving-account IDs | No youth player profiles or private box scores are exposed |
| Weekly/monthly league insights | Partial: verified dashboard totals and balance evidence | No scheduled reporting or period summaries |
| Player recognition/awards | Not implemented (P2) | Must use verified, explicitly recorded stats when added |
| Meaningful Meta agent orchestration | Prepared: model chooses inspection/history/readiness/proposal/draft tools, with bounded execution, mutation limits and protected approvals | Paused; actual autonomous model choices and provider effectiveness remain unverified |
| Visible Meta evidence | Prepared: private activity screen, server-only actual-response receipts, exact request digests, parsed output and resulting actions; browser-forgery test passes | No live model evidence exists yet; test fixtures are never shown as provider responses |

## Security and production boundaries

All 24 public tables have RLS; direct client writes are revoked. Ordinary league commands use the caller's verified JWT. A guarded server-only service-role bridge signs/finalizes/deletes private guardian documents and records actual provider receipts; browser roles cannot invoke those elevated writers. Proofs have no direct client Storage policy. Tests exercise tenant isolation, guardian capabilities and reviewer boundaries. Public snapshots exclude youth identities, coach contacts, original photos, guardian details and private statistics.

Audit accounts are prepared through the supported Auth Admin API. Administrative keys are never stored in test credentials or Git. The document bridge's server-only credential lives in ignored `.env.local` and Vercel Secrets; a build scan checks private values do not occur in client artifacts. Synthetic test passwords stay in ignored, commit-blocked `.local/`. Normal confirmation settings are unchanged. Browser tests use real password/JWT sessions; guardians use narrow HttpOnly invitation sessions.

The latest advisor pass has no database security findings, but reports Auth leaked-password protection disabled. Review [Supabase's password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before accepting real users; no paid plan upgrade was authorized. Informational unused-index notices on this small synthetic database are retained, rather than removing protective indexes prematurely.

The preseason document workflow is tested with genuine synthetic files, not merely Storage metadata. It is not a certification of government-document authenticity or guardianship. Real youth-data rollout, actual provider quality, physical iOS/Safari capture, production-scale load and recovery remain outside the verified scope. See [PRESEASON.md](PRESEASON.md).

## Improvements completed during this audit

- Added the dedicated coach–guardian–administrator preseason journey, configurable readiness and opening-weekend gates, real document decisions/resubmissions and deletion/retention controls.
- Added Meta placement interpretation, deeper agent investigation tools and a private actual-response/action evidence view. All remain paused until credits are confirmed; see [META_HACKATHON.md](META_HACKATHON.md).
- Preserved the last selected league across draft-return visits; refreshed connected views and discarded stale/in-flight snapshots after session changes.

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
