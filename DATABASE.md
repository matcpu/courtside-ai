# Database

Target: **courtside-ai / xdmkgoradmbnjofmbojs / ca-central-1 / PostgreSQL 17**. No other Supabase project is used.

The ordered, tracked migrations in `supabase/migrations/` are authoritative. Local filenames are aligned with the server's applied migration history. Root-level generation scratch files are not part of deployment.

| Entity | Purpose |
|---|---|
| leagues, memberships | Tenant, season, owner, role and revision counters |
| divisions, teams | Approved placement, questionnaire, coach contact and Elo state |
| players | Private roster, birth date, consent and eligibility state |
| courts, availability | Confirmed venue time intervals |
| games | Stable matchup identity and current official result |
| schedule_versions, fixtures | Immutable version snapshots and publication history |
| scoresheets | Private upload path, unique hash, extraction, source and review state |
| player_statistics | Explicitly recorded jersey-level statistics; absent values stay null |
| result_revisions | Previous/new score, approving actor, reason and reviewed extraction |
| division_proposals | Deterministic evidence, source/target tier and decision state |
| notifications | Outbox, destination, consented channel, retry and lease state |
| audit_events | Database-generated actor/action history |
| workflow_runs, ai_requests | Bounded agent trace and AI request reservations |
| preseason_settings, coach_questionnaires | Configurable deadlines/readiness policy and versioned comprehensive assessments |
| guardian_invitations, age_documents | Hashed/revocable one-player capabilities and private document/consent state |
| eligibility_reviews | Human reviewer, reason, document-open event, age policy and decision history |
| meta_evidence | Server-written actual provider identity, parsed output and selected-tool/action receipts |

Composite `(league_id, id)` foreign keys prevent moving entities across tenant boundaries. A league row lock serializes all impactful commands. There is exactly one published schedule per league. A draft records both schedule revision and data revision, which are rechecked at publication.

Publication also creates actual `in_app` notifications for every approved team's current coach, including teams without a future fixture. `recipient_id` and `read_at` keep receipts private. External queue claims exclude in-app rows. Administrators can inspect history but cannot mark another user's receipt. Coach reassignment validates membership, clears prior phone/consent, and suppresses old pending external messages.

Private snapshots expose explicitly recorded player-stat rows to administrators/scorekeepers and the owning coach. RLS enforces the same restriction on direct reads. Public snapshots return empty statistics; absent fields remain null.

## Access

- Administrator: league operations and approval authority.
- Coach: own team contacts and rosters, team registration, own team's scoresheet submission. Cannot confirm official results or publish.
- Scorekeeper: league scoresheet review and official result confirmation; no placement/publication authority.
- Referee: read league operations information only; assignment tooling is deferred.
- Public visitor: explicit whitelisted public RPC only. No raw table access.

All public tables have RLS. Direct table writes are revoked from `anon` and `authenticated`. API mutation paths are `league_command`, `create_demo`, `record_workflow` and `reserve_ai`. These invoker wrappers delegate to `private` implementations with actor and membership checks. Internal seeding, rating replay and schedule validation functions are not executable by clients.

## Storage

`scoresheets` and `youth-documents` are **private**, capped at 6 MB, with explicit MIME restrictions. Object names begin with `<league UUID>/<uploader UUID>/`. Scoresheet review uses five-minute signed URLs. Youth-document upload/review UI and retention/deletion processes are not implemented; no real youth documents should be added for the hackathon.

## Deterministic rules

Initial rating: `800 + experience×75 + min(yearsTogether,4)×25 + min(practicesPerWeek,4)×15`. Tier 1 begins at 1150, tier 2 at 950, tier 3 below 950. All initial decisions remain pending human approval.

Elo uses K=32, a 400-point logistic expected score and rounded zero-sum changes. Games are replayed by `played_at,id`. Standings count confirmed games only: win 2, draw 1, loss 0; ties sort by differential then team name.

U14 defaults to maximum age 13 on the season cutoff. Divisions now have configurable category/minimum/maximum ages. Legacy `verify_player` checks declared date/consent only and is blocked in enforced preseason seasons. The new flow requires private proof submission, a reviewer-open audit and an explicit administrator decision. It is human document inspection, **not independent issuer authentication or guardianship proof**. Only synthetic documents have been tested.

Result correction replaces the current official game score, supersedes a prior confirmed scoresheet, records a result revision, clears/replaces recorded player stats and replays ratings. A confirmed scoresheet can be reopened with a correction reason, reusing its original photo and preserving its first extraction. Reopening leaves the official score unchanged; rejecting that correction restores the confirmed sheet. Proposals become stale after corrected/new results. Rejected drafts do not change public fixtures.

## Verification

`tests/database.sql` exercises real PostgreSQL commands, actual RLS roles and storage visibility, then rolls back. The storage test creates temporary metadata, not a pretend uploaded image. A real upload/download/Meta recognition test is a separate integration check. Review security and performance advisors after schema changes; unused-index informational notices are expected immediately after a fresh installation.
