# Multi-sport rules: implementation and review

This branch extends the existing Next.js application and tenant model. It is a review candidate, **not deployed**. The existing production basketball release, hosted data, local recording runtime on 3301/3302, provider settings and billing are unchanged.

## Inspection findings

Inspected application routes/components, all ordered Supabase migrations, Auth and Storage policies, scheduling/result commands, standings and test harnesses. Hosted inspection was limited to read-only schema/migration metadata for `xdmkgoradmbnjofmbojs`; no hosted records were copied into development.

| Existing assumption | Location | Treatment in this change |
| --- | --- | --- |
| No sport identity; every league implicitly basketball | `leagues`, `src/lib/domain.ts`, `src/lib/launchpad.ts` | Explicit league sport, versioned policy and revision. Existing leagues default to basketball. |
| Fixed standings: win 2, draw 1, loss 0 | TypeScript `standings`; SQL `private.launch_site_data` | Configurable win/draw/regulation-loss/OT-or-shootout-loss points. Existing basketball points stay identical. |
| No result decision; all scores 0–300 | `games`, extraction schema and `confirm_result` | Regulation/overtime/shootout decisions, configured score bounds, immutable rules snapshot on new confirmations. Old games retain legacy regulation/default policy. |
| Points, rebounds, assists and player-points checksum | extraction schema, `player_statistics`, scoresheet review | Retained for basketball. Hockey is team-score only and rejects basketball stat rows, including direct RPC attempts. No goals/assists/penalty data is fabricated. |
| Basketball image prompt and OCR grammar | `meta-prompts.ts`, local OCR utilities | Basketball recognition preserved. Hockey Meta recognition is rejected before provider use; manual photo review works. |
| Basketball assessment weights: 15-point mismatch threshold, tier/rating boundaries 1150/950, score-margin multiplier | `domain.ts`, `preseason.ts`, SQL recommendation/balance functions, operations agent | Basketball retained. Hockey questionnaire validation is shared, but placement uses explicitly uncalibrated coach preference, confidence 0 and human approval/override. Hockey automatic balancing and AI placement/agent calls are unavailable. |
| Elo K=32, three tiers and bounded age categories | `private.recalculate`, divisions, eligibility | Shared provisional Elo math retained; hockey starts at neutral 1000. Three tiers and the existing youth age bounds remain. Adult/open-age leagues require separate eligibility work. |
| 60-minute bookings, 30-minute rest and 30-minute search increments | scheduler, SQL schedule validator, Launchpad capacity | Booking duration and rest configurable and validated again in PostgreSQL. Search increment remains 30 minutes. Bookings include any required ice resurfacing/warm-up time; those are not separate resources yet. |
| “Court”, basketball illustration and sport-specific page copy | workspace, setup wizard, three website templates | Sport identity, rink labels, public website copy and standings adapt to hockey. Basketball illustration is suppressed for hockey. Internal `courts` names, route/view keys and old deep links remain compatible. Some legacy secondary help text still says court/gym. |
| Five-player roster default, max roster 30; proof required for new youth leagues | setup schema, Preseason and readiness | Existing defaults/bounds and all safety gates retained. Organizers must configure the appropriate roster minimum; it is not inferred from on-court/on-ice player count. |
| Basketball synthetic branding, historical demos, saved Muse evidence | synthetic fixtures and demo/public routes | Existing data and assets retained. New sport review fixtures are isolated and visibly synthetic. |
| Recreational treated as a competition kind | Launchpad `kind` | Preserved. Recreational is not a fifth scoring engine; it combines a supported sport with its league policy. |

## Supported workflows

Basketball and hockey can be selected in guided or quick setup, copied into a fresh season, saved/resumed and finished privately. The legacy create-league form also supports both. Existing-season edits retain league/team identities and the atomic safety-snapshot comparison.

Administrators configure points, draw/overtime/shootout permissions, maximum team score, booking duration, team rest and a standings tiebreaker in Rules & Safety or Settings → Sport & standings. A sport change is refused after teams register. Rule changes are refused after a schedule has been published or an official result exists; copy to a fresh season instead. This avoids retroactively reinterpreting official history.

Basketball retains its historical 2/1/0 league policy, including permitted draws. These are compatibility defaults, not a claim about every basketball competition. The sample hockey policy is win 2, draw 1, regulation loss 0, OT/SO loss 1; draws, overtime and shootouts are enabled. Hockey organizers must review the policy for their own competition. A shootout entry uses the tied score plus one deciding goal, never the shootout attempt tally.

Scoresheets remain private. A coach uploads the original photo; an authenticated administrator or scorekeeper reviews team names, final scores and result decision, explicitly checks the human-review confirmation and confirms. A coach cannot approve results. New official games store their rule snapshot and sport revision. Corrections retain the original extraction/decision and all result revisions, and recalculate ratings through the existing path.

Standings use only approved teams and confirmed non-null final results. “L (all)” includes OT/SO losses; the separate OT/SO L column identifies the subset receiving the configured loss points. Tiebreaks are points, optionally wins, score differential, then team name. Final name order is now explicitly Unicode scalar order to match PostgreSQL UTF-8 `COLLATE "C"` regardless of browser locale. This can reorder otherwise tied names compared with the old browser-locale sort; scores and point totals do not change.

All three website templates retain branding, uploaded logos, privacy/redaction, private drafts and explicit publication. Hockey sites identify the sport/rinks, show OT/SO decisions and sport-aware standings. Public websites never receive roster identities, birth dates, contacts or proofs.

## Authority and migration

- `src/lib/sports.ts` defines the typed, strictly validated version-1 policy. It contains no provider or database access.
- `src/lib/domain.ts` applies policies to standings and score warnings; the scheduler consumes configured duration/rest.
- `20261109132517_sport_rules.sql` is one ordered additive migration generated with repository-pinned CLI **2.122.0**. Older migrations are unchanged.
- PostgreSQL independently validates policy/result values, roles, tenant ownership and schedule constraints. Its existing league row lock serializes all relevant writers. Direct table mutations and private implementation functions remain inaccessible to ordinary clients.
- `sport_revision` handles stale Settings writes. Launchpad's trusted safety snapshot includes sport/rules/revision, including ABA detection. A conflicting finish returns HTTP 409 with no partial league, history or audit changes.
- An older setup client that omits sport fields preserves the current league's sport/rules under that same lock. Omission defaults to basketball only when creating a new league; it never resets a hockey league or a customized basketball policy.
- `sport_rule_revisions` has RLS and admin-only reads; rule mutations append audit/history. Existing rules are captured before their first change.
- `sport_capabilities()` lets new setup writers fail with HTTP 503 when the required migration is absent. A hockey selection cannot silently fall through a pre-sport database's basketball-only setup implementation.
- Private wrapper renames retain the existing implementations and permissions. Two guarded function-definition substitutions adapt the established questionnaire recommendation and scheduling-rest checks; migration application stops if their expected source contract differs.
- Existing accepted results retain their values. New confirmations snapshot policy; old results are not assigned invented overtime/shootout history.

Security design follows the existing PostgreSQL-authorized RPC boundary and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). No new authentication system, payment integration or hosted infrastructure is introduced.

## Reproduce locally

Node 24 and the committed lockfile are required. Tests use synthetic records only and never load hosted database credentials.

```sh
npm run typecheck
npm test
npm run test:database:local
npm run test:database:sports
npm run test:database:sports-upgrade
```

For real multi-session tests, set `LAUNCHPAD_TEST_DATABASE_URL` to an **ephemeral loopback** PostgreSQL database named `courtside_launchpad_test`, then run both `test:database:concurrency` and `test:database:sports-concurrency`. The helper refuses hosted hosts and creates/drops its own random test databases. Do not point it at a production or recording database.

For browser review without disturbing the recording runtime, use a separate terminal and the existing isolated builder:

```powershell
$env:LAUNCHPAD_REVIEW_FRONTEND_PORT='3401'
$env:LAUNCHPAD_REVIEW_BACKEND_PORT='3402'
$env:LAUNCHPAD_REVIEW_SPORTS='true'
$env:LAUNCHPAD_LOCAL_PREVIEW='false'
node scripts/review-launchpad.mjs
```

This copies the working source into a temporary directory, excludes environment files, builds and runs Next.js with an in-memory PostgreSQL/Auth/Storage contract adapter. Meta, email and SMS are disabled. It does **not** test hosted Supabase Auth, Storage or PostgREST. Fixture credentials are the existing synthetic review credentials reported by the loopback-only `/__preview` endpoint. `scripts/serve-sports-review.mjs` can run an already built 3401 frontend; it clears inherited provider credentials and verifies the temporary build location.

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3401'
$env:SPORTS_LOCAL_REVIEW='true'
npx playwright test tests/e2e/sports.spec.ts --workers=1
```

Browser cases cover guided hockey setup and custom rules, both sports' private scoresheet upload/manual review/confirmation/standings, explicit website publication, signed-out redacted public rendering, desktop/mobile overflow, coach restrictions and hockey AI rejection. Screenshots are local, ignored artifacts under `.local/sports-review/`.

The sport scoresheet fixtures explicitly disable Preseason readiness to isolate scoring tests. They do **not** manufacture document approvals or claim that the document-verification flow was revalidated for hockey. The guided new-league case retains Preseason and verifies that unready teams cannot be scheduled; the existing proof-policy/eligibility suites run unchanged.

## Release and rollback gates

Local verification: TypeScript, production build and 180 Vitest tests pass; 96 new sport PostgreSQL assertions pass; existing Launchpad/proof-policy SQL suites and 106 native multi-session assertions pass. Both new concurrent-writer directions demonstrate actual lock waits, HTTP 409 and no partial writes. The upgrade rehearsal preserves all 28 existing public-table data digests. All eight browser cases pass at desktop and mobile widths against the separate synthetic contract adapter, not hosted services.

No hosted migration, deployment, production mutation, payment enablement or model inference is authorized by this task. This PR is stacked on `codex/organizer-setup` (PR #2); do not merge both PR #1 and PR #2.

`vercel.json` disables Git-triggered deployment for **only** `codex/multi-sport-rules`, following [Vercel's branch configuration](https://vercel.com/docs/project-configuration/git-configuration), so opening the review PR does not request a preview deployment. Other branches are unchanged. No Vercel settings or deployment APIs were mutated.

Before a future rollout: review the SQL, create/verify a recoverable backup of the existing project, reconcile the known historical local/hosted migration timestamp differences without reapplying old versions, apply **only** the approved new migration, then run isolated hosted synthetic acceptance against actual Auth/Storage/PostgREST. Deploy only after separate approval. Do not run an unrestricted `db push` against the known history mismatch.

This migration is additive. Existing basketball applications can read their old fields, but **do not downgrade to a basketball-only application while hockey leagues are active**: it would display incorrect hockey points. Prefer a reviewed forward repair. A database rollback requires the verified pre-migration backup, a write freeze and reconciliation of any accepted post-backup records; restoring without reconciliation would lose those records. No destructive down migration is supplied.

## Roadmap and explicit unfinished work

1. **Hockey depth:** league-specific placement calibration and evidence evaluation; player goals/assists/penalties and goalie data; period/OT/shootout line items; validated hockey scoresheet recognition; ice-resurfacing, officials, blackout and travel constraints. Current hockey scoring/standings are team-level final results, not a full game clock or governing-body rules engine.
2. **Soccer:** introduce its own reviewed result profile (including configurable win/draw points), forfeits/abandonments, extra-time/penalty conventions, goal-based standings and competition-specific tiebreaks. Implement SQL/TypeScript parity, private score review and scheduling tests before exposing selection.
3. **Volleyball:** add ordered set scores, best-of format, set validation/deuce/caps, match points based on match result, set/point ratios and mixed match-duration policies. A volleyball match cannot safely reuse the current two-integer final-score engine.
4. **Recreational/open-age:** retain sport + recreational competition kind, then add reviewed adult/open-age eligibility, mixed divisions, optional standings and fair-play policies. Current age and roster bounds remain youth oriented; do not advertise adult league support yet.
5. **Commercial readiness:** organization/multi-league delegation beyond league memberships, tested tenant isolation at scale, data export/deletion and operational recovery, accessibility review and realistic capacity/load tests. Dedicated sender and deliverability remain outside this change. Pricing/payments are intentionally absent. These are release work, not completed SaaS capabilities.

The registry intentionally exposes **only basketball and hockey**. Adding an enum value alone is not a sport implementation. Every new policy needs an ordered migration, independent PostgreSQL validation, deterministic standings parity, score-review rules, scheduling constraints, permission tests and a browser acceptance case.
