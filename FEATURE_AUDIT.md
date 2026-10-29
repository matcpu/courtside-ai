# Product completion audit — October 29, 2026

Scope: every feature in the original COURTSIDE AI request. **Working** means exercised against the real Supabase project or, for model quality, the actual provider cases stated below. It does not mean unlimited production scale or general accuracy. **Partial** identifies the exact limitation. The three core Meta capabilities have genuine provider responses and actual action receipts; extra image/questionnaire/document cases and tool-error recovery were evaluated. [EVALUATION_REPORT.md](EVALUATION_REPORT.md) preserves successes and misses. [META_VERIFICATION.md](META_VERIFICATION.md) records the current cumulative 120/30 promotional-credit safeguard, replacing the historical eight-request limit.

## Feature-by-feature assessment

| Original requirement | Completion and evidence | Remaining limitation |
|---|---|---|
| League creation and season configuration | Working: preseason setup editor for opening date, cutoff, category/tier age ranges, deadlines, registration status, roster limits and retention | No season rollover or archive workflow |
| Team registration | Working: real coach login, questionnaire submission, persistence and administrator approval; desktop/mobile browser walkthrough | Invitations require an existing confirmed account; no invitation-email onboarding |
| Coach skill assessment | Working comprehensive draft/submission/revision flow and independent rubric; three actual Muse Spark cases cover contradictions, consistent competition context and missing history, with relevant follow-up questions | Self-report and cross-league comparability are not independently verified; model confidence is not a calibrated placement probability |
| Initial competitive placement | Working: administrator approval/override with explanation and questionnaire-revision binding; coach cannot approve | Rubric is an MVP operational policy, not a calibrated scouting model |
| Player roster and age eligibility | Working real-file guardian consent/upload and human original review; local OCR consistency, deterministic age/exact reuse, versioned combined image-similarity hints and TD3 checksums; escalation, resubmission and derived-data deletion | Synthetic tests only; no issuer authentication or general forgery detector. Combined hashing fixes one recompression regression but can still miss transforms or flag shared layouts. Separate synthetic Meta study detected 4/4 inconsistencies and only 1/2 explicit visual anomalies; see DOCUMENT_SCREENING.md |
| Guardian onboarding | Working mobile-friendly one-player expiring/revocable invitation portal; pending/approved/resubmission status, no account bypass or public youth data | Invitation possession and guardian identity attestation are not independent identity proof; automated email delivery needs Resend |
| Team preseason readiness | Working questionnaire → placement → submitted roster → every active player consented/document-approved/currently age-eligible; SQL and scheduler enforce opening weekend and readiness | Existing historical/demo leagues are explicitly legacy mode until configured; seed rosters are never represented as document-verified |
| Gym/court availability | Working: administrator creates courts and confirmed time blocks; unconfirmed/out-of-window scheduling rejected | No permit approval process or recurring-calendar editor |
| Automated game scheduling | Working deterministic round-robin round, court/team collision/rest checks, confirmed availability, opening-date and preseason-readiness gates; DB independently validates drafts/publication | One replacement round at a time; no whole-season optimizer, team blackout calendar, referee constraints, travel fairness or concurrent-user load certification |
| Scoresheet photo upload | Working: actual PNG uploaded/downloaded from private Storage through real coach/admin sessions; duplicate hash blocked; mobile upload exercised | Physical iOS/Safari camera capture and image-retention cleanup remain untested |
| AI scoresheet extraction | Working on six actual synthetic images: original 78–43, printed/rotated/compressed partial statistics, absent statistics, obscured score and contradictory period totals; new cases passed field/null/warning checks | No general handwriting/camera/language accuracy claim. Obscured values remain null; conflicting totals require scorer review. Only the owner-confirmed baseline became an official result |
| Result validation and corrections | Working: original photo review, names/scores/stat validation, human confirmation, correction reason, immutable history and Elo replay; unauthorized coach confirmation denied | No league dispute/appeal workflow |
| Standings and competitive ratings | Working: only confirmed results count; Elo recomputes after corrections; division filter | No historical division-membership standings or season rollover |
| Player statistics | Working persistence and private display of explicitly recorded jersey-level rows; SQL tests cover correction replacement, null preservation and opponent privacy | No player profiles, imported box-score mapping or awards; sample photo intentionally contains no individual statistics |
| Dynamic competitive rebalancing | Working: verified three-game evidence, one-tier proposal and stale-evidence invalidation | Simple policy; no calibrated predictive model or automatic unattended division moves |
| Proposed division adjustments | Working: approve/reject, actor audit and persisted placement; coach cannot approve; administrator browser approval verified on live desktop/mobile | Schedule regeneration requires the administrator's next action |
| Schedule regeneration and changes | Working: new same-division pairs, stale revision rejection, human publication, rejected drafts and version history | Each draft explicitly replaces prior future fixtures; regeneration is not an unattended background process |
| Email notifications | Working for the authorized test inbox: dedicated sending-only credential/testing sender, actual Gmail receipt, real outbox failure/backoff/retry and duplicate prevention; other recipients suppressed | Guardian invitation initially landed in Spam; general delivery requires a verified COURTSIDE domain. No recurring retry worker or delivery webhook |
| SMS notifications | Partial: consent, phone validation and opt-out setting saved; fail-closed adapter | Twilio credentials, signed inbound STOP handling and real SMS verification absent; sending stays disabled |
| Coach notification history | Working: publication creates actual private in-app messages for every approved team, including teams losing fixtures; coach read receipts persist | External email/SMS remain separate and incomplete as above |
| Referee assignments | Not implemented; referee read role exists | Availability, assignment/conflict rules and screens deferred outside hackathon scope |
| Administrator dashboard | Working preseason progress, settings, placement override, private proof-review queue, flags, reasoned decisions, history and retention controls alongside existing operations | No large-season pagination or disaster-recovery exercise |
| Coach portal | Working saved/resumable assessments, own roster/invitations/readiness, private inbox and published fixtures; desktop/mobile tested | No coach blackout-date editor or general parent portal beyond secure verification |
| Public league schedule/results | Working whitelisted public snapshot; signed-out browser tests verify no roster, contacts, photo paths or approving-account IDs | No youth player profiles or private box scores are exposed |
| Weekly/monthly league insights | Partial: verified dashboard totals and balance evidence | No scheduled reporting or period summaries |
| Player recognition/awards | Not implemented (P2) | Must use verified, explicitly recorded stats when added |
| Meaningful Meta agent orchestration | Working actual model-selected inspection/history/readiness/proposal/draft execution, saved records and two genuine failed-lookup/recovery runs; protected human approvals remain | Original secondary team-name narrative error is retained and visibly cross-checked against canonical records. First recovery reached its server bound without a final model summary; second explicitly explained failure/recovery |
| Visible Meta evidence | Working private server-only provider IDs, request digests, usage, structured outputs and actual tool errors/actions, grouped by run; canonical current record checks remain separate from raw model narrative | Finite development cases do not prove flawless model behavior. Unit/mock fixtures never populate provider evidence; synthetic document responses are explicitly experimental |

## Security and production boundaries

All public tables have RLS; direct client writes are revoked. Ordinary league commands use the caller's verified JWT. A guarded server-only service-role bridge signs/finalizes/deletes private guardian documents and records actual provider receipts; browser roles cannot invoke those elevated writers. The private global Meta budget/scopes/case/ledger tables are also RLS-protected and unavailable to browser roles. Proofs have no direct client Storage policy. Tests exercise tenant isolation, guardian capabilities and reviewer boundaries. Public snapshots exclude youth identities, coach contacts, original photos, guardian details and private statistics.

Audit accounts are prepared through the supported Auth Admin API. Administrative keys are never stored in test credentials or Git. The document bridge's server-only credential lives in ignored `.env.local` and Vercel Secrets; a build scan checks private values do not occur in client artifacts. Synthetic test passwords stay in ignored, commit-blocked `.local/`. Normal confirmation settings are unchanged. Browser tests use real password/JWT sessions; guardians use narrow HttpOnly invitation sessions.

The latest advisor reports four informational notices for private budget tables with RLS enabled and no policies: this intentionally denies browser access, alongside revoked grants and service-only RPCs. The existing warning is Auth leaked-password protection disabled. Review [Supabase's password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before accepting real users; no paid upgrade was authorized.

The preseason workflow is tested with actual uploaded synthetic files, not merely Storage metadata. It does not certify document authenticity or guardianship. Real youth-data rollout, general provider quality beyond the stated cases, physical iOS/Safari capture, production-scale load and disaster recovery remain outside the verified scope. Actual model tool-error recovery is documented separately from infrastructure recovery. See [PRESEASON.md](PRESEASON.md).

## Improvements completed during this audit

- Added the dedicated coach–guardian–administrator preseason journey, configurable readiness and opening-weekend gates, real document decisions/resubmissions and deletion/retention controls.
- Verified actual Meta placement, scoresheet and model-selected investigation/action tools, then expanded synthetic evaluation and genuine tool-error recovery. Added canonical action checks without rewriting the observed model-name error; see [META_HACKATHON.md](META_HACKATHON.md).
- Added service-only serialized cumulative credit reservations/settlement, duplicate-request guards and pause-on-uncertainty/freshness checks under the owner's expanded 120/30 allowance. No public/background inference or automatic paid retry is enabled.
- Evaluated local and synthetic Meta document warnings, preserved the visual-anomaly miss, and improved private image-similarity regression coverage without claiming issuer authentication.
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

1. Review the actual outputs, errors, canonical saved actions and current human decisions in the consolidated package. The result and two synthetic moves have explicit owner decisions; their recorded/runtime status is in STATUS.md.
2. Review the three-minute recording and honest evaluation limits, including the original summary-name error and one missed visual-anomaly observation. Preserve saved evidence for retakes; do not create unnecessary new inference.
3. Confirm final track/team/permission choices and approve public video publication and entry submission. The owner reports registration acceptance, so further eligibility discussion is not a gate. Public access and synthetic private roles work without unrestricted signup. Restricted email testing is complete; domain expansion and deferred features are not submission blockers.
