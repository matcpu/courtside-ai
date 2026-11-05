# Current-design release preparation — November 4, 2026 — PRODUCTION BLOCKED

The owner requested committing/pushing the current design and verifying an existing-project Vercel preview before promotion. Read-only hosted checks confirm both reviewed Launchpad migrations are absent and both organizer/configured-site RPCs do not exist. No verified recoverable backup exists; the prior zero-byte roles file is not a backup. The first table probe failed with SQLSTATE 42501 because the CLI login role had not assumed postgres; follow-up confirms TLS and permission to assume that role, matching the official CLI dump template. Do not misreport that probe as missing credentials. No hosted mutation or production promotion may proceed through the backup/approval gates.

Latest application source: TypeScript/isolated production build and 160 unit tests pass; full desktop local creation/customization/publication/return retested after removing newly introduced hardcoded local passwords. The existing local runtime remains active and the original backend has not restarted. Preview verification and Git publication are in progress; no remote pass is claimed yet. See [HOSTED_RELEASE_REVIEW.md](HOSTED_RELEASE_REVIEW.md) for exact limits and release steps. Earlier local-only/uncommitted checkpoints below are historical and do not imply a production release.

---

# Credential-free interactive Launchpad — November 4, 2026 — LOCAL / UNCOMMITTED

The development-only homepage now establishes an isolated synthetic organizer session server-side. Create opens the guided wizard without credentials; Explore opens that session's populated Scoreboard; Open demo dashboard opens its authorized workspace. Tokens stay server-side behind an opaque HttpOnly/Strict cookie. Existing tenant membership authorization, private drafts and explicit website publication approval remain in force. Session bootstrap and cookie writes require same-origin requests. Activation requires the exact loopback adapter, development artifact and disabled outbound services; production artifacts cannot opt in via the preview flag.

Verified: 6 desktop/mobile positive browser cases and 2 actual production-artifact negative cases; TypeScript and final production build; 160 unit tests / 22 files; isolated database/RLS/permission/clean-setup/upgrade assertions. Browser tests include immediate Create/Explore clicks, full setup/customization/local publication/return, separate-user tenant isolation, original-recording denial and forged-cookie/origin rejection. The original recording workspace baseline and all three design-review leagues' authoritative facts remain unchanged. The original backend PID 14516 on 3302 was not restarted; the development frontend remains running on 3301. No hosted change, migration, commit, push, merge, deployment, message, inference, billing or video edit occurred.

See [INTERACTIVE_DEMO_REVIEW.md](INTERACTIVE_DEMO_REVIEW.md) for the credential-free recording path and session lifetime. Direct browser Storage upload workflows are outside this cookie-only Launchpad verification. Earlier manual-sign-in guides below describe normal production/authenticated mode, not the current automatic local session.

---

# Public website header return link — November 4, 2026 — LOCAL / UNCOMMITTED

Added the visible “← Back to Courtside AI” anchor with direct `href="/"` to the shared Arena/Clubhouse/Scoreboard header and the legacy public website header. Logo, league navigation, footer/product links and authorization are preserved. The link wraps onto its own header row and retains visible keyboard focus.

Verified signed-out homepage → Scoreboard → homepage, plus all three themes and the legacy website, on desktop and a narrow 320px mobile viewport. Two targeted browser tests pass with no horizontal overflow; 153 unit tests, TypeScript and production build pass. Current source matches the local built runtime, the original recording workspace baseline is unchanged and the original backend on 3302 remains running. No database mutation, hosted action, merge, deployment or commit occurred in this change. Screenshots: `.local/public-back-link`.

---

# Connected product experience — November 4, 2026 — LOCAL / UNCOMMITTED

The existing Next.js app now opens a product entry at `/`, offering the published Scoreboard demo, league creation and prominent sign-in. The existing Supabase authentication form/session is reused. Successful root sign-in shows an explicit authorized league chooser; no first-public-league or unrelated remembered fallback is selected. `/workspace/<id>` and allowlisted `?view=` links identify the tenant; the original public portal URLs remain available.

The private league-list API now distinguishes actual membership from public-row visibility using PostgreSQL private snapshots. A small authenticated navigation endpoint returns management/published-site metadata only. All three themes and the legacy website link back to the product and onboarding; only authorized admins see Manage league. Organizer headers link to the selected league's actually public website. Session/user changes clear private snapshots; league switching keeps navigation mounted while suppressing mismatched snapshots. Private reads and writes still require independent server/PostgreSQL authorization.

Verified: current 76 source/asset files match the built local runtime; TypeScript and production build pass; 150 unit tests / 21 files and 32 desktop/mobile browser cases pass; isolated SQL/permissions/RLS/clean-bootstrap/upgrade checks pass. Actual password sign-in, explicit choice, A–E round trips, all themes, legacy portal/header sign-in, coach restrictions, 401/403 reads and publication denial, public redaction and atomic 409/no-partial-write regression are covered. The discovered mobile transition race is fixed and retested. Original recording workspace hash matches its baseline; all three review leagues retain ages 12–13, September 1 cutoff, 12 teams / 25 fixtures / 18 finals and the pending state. Meta remains false. The original backend PID 14516 on port 3302 was not restarted.

See [CONNECTED_EXPERIENCE_REVIEW.md](CONNECTED_EXPERIENCE_REVIEW.md) for URLs, exact local synthetic credentials, screenshot boards and test scope. No hosted validation is claimed; mobile uses browser emulation. All changes remain local and uncommitted. No merge, push, deployment, migration, billing change, inference, message or video edit occurred.

---

# Design-v2 final data/disclosure check — November 4, 2026 — LOCAL / UNCOMMITTED

Only the three populated Harbour Hoops design-review leagues were configured through authenticated atomic Launchpad edits: all three U14 divisions per league now have ages 12–13, retaining the September 1, 2026 cutoff. Production eligibility defaults and logic are unchanged. Before/after public data and core snapshots confirm unchanged teams, fixtures, courts/availability, scores, standings and schedule versions. The original recording workspace matches its baseline hash.

Declared synthetic pages now show “Demo league · All teams, venues and results are fictional.” immediately below navigation, as a named accessible disclosure. The existing footer disclosure remains. Only the legacy terminal “· Fictional venue” annotation is omitted from demo venue presentation; stored names and real-league presentation remain intact. No results or venue records were rewritten.

Verified: TypeScript/build, 147 unit tests / 20 files and all 6 design browser workflow tests pass. All three actual previews pass desktop/tablet/mobile checks for saved ages 12–13, September 1 cutoff, visible disclosure, normal fixture venue names, 12 teams / 25 fixtures / 18 confirmed results / 1 past pending result, and expandable complete standings/fixtures. Updated screenshots and per-theme division proof crops are in `.local/launchpad-design-v2-final`. The backend on 3302 remains the original PID 14516. No hosted write, migration, production/default change, commit, push, merge, deployment, inference or video edit occurred.

---

# Launchpad visual refinement 02 — November 4, 2026 — LOCAL / UNCOMMITTED

The three configured website themes now have a brighter athletic Arena, a warm basketball-led Clubhouse and a compact Scoreboard game centre with a standings sidebar. An authored SVG HH monogram replaces the generic logo only on the four synthetic review websites, through the existing sanitized PNG upload contract. Real leagues retain uploaded logos or typographic initials; no hard-coded demo logo fallback was added.

Four real featured games lead to an expandable complete published schedule; a six-team standings snapshot expands to all rows and columns. Presentation distinguishes upcoming, confirmed finals and past unconfirmed “Result pending” fixtures. No result/standings calculation changed. The 25-game review datasets remain 6 upcoming, 18 final and 1 pending. Original recording workspace and all review league facts matched before/after hashes. No original recording branding was changed. The original in-memory backend on port 3302 remains running.

Verified: current source/asset hashes match the local built runtime; TypeScript (including current regression tests) and production build pass; 142 Vitest tests / 20 files pass; 6 desktop/mobile browser workflow tests pass including publication/privacy and atomic HTTP 409 rejection. Nine theme/width captures plus empty-season checks passed. Long names, no-logo fallback, three custom-colour pairs and 11,740 sampled text contrast checks ≥ 4.5 passed at 1440/768/390px. Actual builder logo upload/removal, theme and colour controls, mobile preview and disabled publication pending review were checked without saved/public mutations. No migration or SQL policy was changed; the prior database verification is unchanged rather than claimed as a fresh hosted audit.

Artifacts: `.local/launchpad-design-v2` contains desktop/mobile/full-page/tablet screenshots, comparison.png, identity-board.png and favicon/display PNGs. Vector master: `public/demo/harbour-hoops-mark.svg`. See [LAUNCHPAD_DESIGN_REVIEW.md](LAUNCHPAD_DESIGN_REVIEW.md). No push, commit, merge, deployment, hosted write, feature-flag change, billing, Meta inference, messaging or video edit occurred. Mobile verification uses Chromium emulation, not physical devices.

---

# Launchpad website design review — November 4, 2026 — LOCAL ONLY

On `codex/organizer-setup`, the existing public renderer now offers distinct Arena (athletic masthead), Clubhouse (community editorial) and Scoreboard (fixtures-first season hub) compositions. Saved theme keys remain compatible. League identity, real season dates, registration, actual division ranges and grouped courts/venues replace the tilted court graphic and zero-team promotion. Empty fixtures, standings, contact and their navigation are omitted. Rules remain accessible in a keyboard-operated disclosure. Only the existing redacted public contract is rendered; no SQL, RLS, authorization or publication control changed.

Facilities and proof-policy errors are caught in their setup steps. Review includes friendly dates, division names/ages, roster bounds, court/venue details, deadlines and direct correction controls. The existing atomic finish and conflict response are preserved.

Verified on the final local runtime: TypeScript and production build; 137 Vitest tests; the local SQL/RLS/permissions/clean-bootstrap/upgrade suite; 6 new desktop/mobile browser cases including HTTP 409 and no-partial-write checks. Actual screenshots and overflow/keyboard checks cover all three themes at 1440px, 768px and 390px, with both empty and fixture-populated synthetic leagues. The builder's logo, theme, narrow preview and extreme custom-colour foreground contrast were checked; private edits did not change saved/public revisions. The original recording league's workspace hash remains unchanged. The local database process was preserved.

The app remains running at http://127.0.0.1:3301/. See [LAUNCHPAD_DESIGN_REVIEW.md](LAUNCHPAD_DESIGN_REVIEW.md) for review links, screenshots, tests and limitations. Changes are a local uncommitted review candidate, not a new PR/CI certification. No merge, push, deployment, hosted mutation, migration, Meta call, message, billing or video change occurred.

---

# Preseason onboarding UX candidate — November 4, 2026 — NOT DEPLOYED

Implemented on `codex/organizer-setup`, preserving the completed PR #2 concurrency repair. Three sections separate league rules, selected-team preparation and human age review. Shared proof controls start new leagues without implied accepted documents, preserve saved choices and validate required selections. Guardian capture/upload requires an explicit single type, preview and consent; second-child invitations now exchange correctly in the same tab.

An explicit no-document policy retains guardian confirmation, human eligibility review and all deterministic readiness gates. Declaration approval is not document verification. Requiring proof again blocks declaration-only eligibility. One subsequent ordered migration adds the contract without altering the prior repair migration; no hosted migration has run.

Verification: TypeScript/build with flags on/off, 128 unit tests, 295 WASM SQL/schema/upgrade assertions, 152 native PostgreSQL assertions and 20 desktop/mobile browser cases passed. Actual native lock waits and rejected-finish rollback remain covered. Auth/Storage browser adapters are local contracts, camera input is synthetic and physical-device/hosted acceptance is unverified. Repository audit passed. Read-only production smoke: HTTP 200, 12 public reference teams, zero public players, Meta false. No hosted writes, deployment, video edit or inference.

**GO for local review; NO-GO for production enablement pending owner-approved migrations and hosted acceptance.** See [PRESEASON_UX_REVIEW.md](PRESEASON_UX_REVIEW.md) for changes, screenshots, commands, test scope and remaining gates. PR #2 remains draft.

---

Earlier checkpoints below are historical; their counts describe those earlier commits.

# Targeted Launchpad repair — November 4, 2026 Eastern — NOT HOSTED

The confirmed stale-finish overwrite is repaired locally in implementation commit `c3f9ce9bd3351bc991567ec1a6a193e13fd63200`. Existing-season drafts bind a trusted snapshot of live league/Preseason/division configuration under the league lock. Finish rechecks after any lock wait and before writes in the same transaction. Old private autosaves cannot rebase the snapshot; conflicts return HTTP 409 and instruct the administrator to reload/review in a fresh edit. No automatic merge, retry or silent discard is added.

The SQL is promoted to **one** ordered migration, `20261104164024_organizer_launchpad.sql`, generated with repository-pinned CLI 2.122.0. The proposal file and secondary loader path are removed. All ordered migrations load exactly once; repeated clean setup verifies order, RLS and permissions. No hosted migration has run.

Local evidence: 125 Vitest tests, TypeScript and isolated production build passed. PostgreSQL/WASM passes 254 assertions (136 repaired workflow/schema, 102 existing and 16 repeat-bootstrap). Native PostgreSQL 17.11 passes 113 assertions (97 sequential/multi-session/schema and 16 repeat-bootstrap), with actual independent-session blocking observed. Synthetic team/player rows, audit/history and all other affected records survive rejected finishes unchanged. All requested safety fields, ABA and both writer orderings are covered. All 14 browser cases passed: HTTP 409 on desktop/mobile plus the 12 prior regressions. Commit/CI details are recorded in LAUNCHPAD_RELEASE.md.

**GO for review and approved hosted acceptance; NO-GO for production enablement until hosted migration/Auth/RLS/Storage/browser acceptance and explicit authorization.** Local Auth/PostgREST remain test contracts. No merge, deployment, hosted data write, external publication, message, Meta inference, billing or video change occurred. PR #2 stays draft.

Earlier preparation findings below are historical; the stale-write and proposal-promotion blockers described there have now been resolved locally.

---

# Launchpad release preparation — November 4, 2026 Eastern

`codex/organizer-setup` is being pushed for a review PR against `main`, without merging or deploying. Runtime implementation remains `3f64ce8`; release preparation adds documentation only. PR #1's helper bodies match after formatting, its three original tests are retained, there is one website route/conditional fallback, and no ordered migration was added. The new PR is the combined candidate; do not independently merge both PRs.

Release preparation reproduced a **production-blocking stale-write defect** using local synthetic PostgreSQL only: an old Launchpad edit draft silently restored minimum roster 5 after a newer Preseason configuration changed it to 7. The current revision guard does not span both writers. Fix plus cross-workflow regression is required before merge/enablement; current green tests are not evidence that this case is safe. No product/runtime or hosted change was made to mask the finding.

[LAUNCHPAD_RELEASE.md](LAUNCHPAD_RELEASE.md) records the synthetic-only hosted acceptance matrix, approval boundaries, exact migration/rollout/rollback order and remaining release gates. The pending proposal must be promoted and the local loader adjusted to apply it exactly once before any hosted rollout. Local tests are not hosted Supabase certification. GitHub CI results must be verified on the actual final PR head.

Vercel was checked read-only: this existing project has no Git repository link and Git-created deployments are disabled. No hosted migration/data change, deployment, merge, video edit, provider inference, messaging, DNS/purchase or billing change occurred. **GO for review/CI; NO-GO for production enablement until hosted acceptance and explicit authorization.**

---

# Launchpad review — November 4, 2026 Eastern — NOT DEPLOYED

Branch `codex/organizer-setup` is an isolated owner-review candidate. PR [#1](https://github.com/matcpu/courtside-ai/pull/1) was inspected at `43414f9` and its website route, starter, identity/social helpers and tests were reused. It remains unmerged. No hosted migration, deployment, video change, domain purchase/DNS, social account action, email expansion, billing change or Meta inference occurred.

## Working local scope

Three starting paths (guided/copy/direct), five steps, database-autosaved owner drafts, revision conflicts, editable age categories and private setup completion. A season copy receives fresh registration/schedules and excludes participants, contacts, documents, invitations, scores and dated availability. Existing seasons can enter setup without replacing their identity, teams, divisions or results. Removed administrators lose linked-draft access.

Launchpad shows actual registration/onboarding/invitation/verification state, readiness blockers and a conservative merged-slot capacity upper bound. The existing public website route supports three responsive themes, normalized logo, public copy/colours/contact, desktop/mobile preview, private drafts, separate human publication/unpublication and immutable publication revisions. Public output is explicitly projected from approved teams, published fixtures and confirmed scores. Private administrator contact, youth records, proofs and invitations are excluded.

Member invitations work before an account exists, expire in 72 hours and require the matching confirmed account. Membership/team assignment is atomic; revoked, expired, reused, wrong-account and stale-assignment cases fail. No invitation email is sent. Identity/social starter copy is explicitly rules based. One real official `example.com` RDAP check completed; registration lookup never claims purchase availability. Other domain suffixes, naming conflicts and Instagram handles require manual checks. Agent extension tools are documented design only.

## Verification and limits

- TypeScript and isolated production build passed; **125 Vitest tests** passed.
- **171 real PostgreSQL assertions** in the local WASM engine passed: 69 new Launchpad checks plus 65 operations and 37 preseason assertions, with the existing suites rolled back. All prior repository migrations load before the unapplied proposal.
- **12 browser cases** passed across desktop Chrome/mobile Chromium: all three setup paths, resume, real availability/capacity, current-season edits, website themes/logo/draft isolation/publication, pre-account invitation acceptance/restrictions and the PR #1 public reference fallback. Desktop/mobile screenshots were inspected in `.local/launchpad-review`.
- Actual Next API checks reject unauthenticated access, administrator-role escalation, arbitrary domain URLs and invalid image bytes without advancing the site revision. The bounded official RDAP request succeeded without retries or paid inference.
- Production database health is good and Meta is disabled. The canonical Northstar public snapshot matches its saved fingerprint. The directory contains an additional public league outside this branch; it was left untouched. The all-directory fingerprint therefore differs; no false unchanged-directory claim is made.

The preview is local synthetic PostgreSQL plus Auth/PostgREST contract adapters, **not a hosted Supabase integration certification**. Hosted migration/advisors/API acceptance remain gated on owner approval. Physical Safari/Android and general multi-region timezone/runtime parity are unverified. Current Supabase changelog notes Vancouver/Edmonton/Casablanca tzdata fixes; validate hosted/runtime timezone data before operating those regions. No production database/runtime upgrade is part of this proposal.

The additive SQL is intentionally in `supabase/proposals/organizer_launchpad.sql`, outside applied migrations. Both organizer flags default false. Existing schema-free PR #1 pages remain a fallback. New branch CI has not been run remotely because this is a local review stop; the CI workflow now includes the local SQL suite. [Review instructions](LAUNCHPAD_REVIEW.md), [scope plan](LAUNCHPAD_PLAN.md), [future agent tools](LAUNCHPAD_AGENT_DESIGN.md).

---

# Earlier PR #1 scope — preserved historical record

Draft pull request [#1](https://github.com/matcpu/courtside-ai/pull/1) adds a standalone responsive public league website at `/league/[slug]/website`, linked from the league Settings screen, and an administrator-only Launchpad starter view with generated handle/domain ideas and copyable social launch materials. This first slice uses the existing redacted `public_leagues` and `league_snapshot` RPCs: only approved teams, published fixtures and confirmed results power the site. It does not expose youth names, guardians, identification documents or coach contact details. No schema migration, external account, domain purchase, social posting, Meta inference, billing or notification was initiated. The social suggestions are **not verified available** and are not represented as model output.

The PR remains **draft and unmerged**. GitHub CI passed on commit `174874d` after an unavailable icon import was corrected. No local `npm ci`/typecheck/build could run in this limited workspace because package registry fetches failed; the repository's GitHub CI did run the verified pipeline. Existing live deployment and hackathon submission candidate remain unchanged. The larger onboarding wizard, persisted branding themes, real domain checks, authenticated social publishing and agent extensions remain future, separately reviewed phases.

---

# Status — November 3, 2026 Eastern — camera release

Live: [COURTSIDE AI](https://courtside-ai-one.vercel.app). Runtime **93f44b6031b4494a45605ce0b4956a5f8d01dd92** is Ready as **dpl_84N1SnLLBDHPW64rfQq5QehhWimS**. [CI passed](https://github.com/matcpu/courtside-ai/actions/runs/41769062687). Source, private storage, billing and the sole Supabase project remain unchanged in scope.

## Shared camera capture

Scoresheets and the private guardian portal now share Take photo, live preview/framing, Capture photo, Retake, Use photo and gallery/native-camera fallbacks. Capture/confirmation stays local; upload requires the existing explicit submission. Rear-facing camera is preferred; audio is never requested. Streams stop on capture, cancellation, hidden-page/navigation/unmount and late permission responses. Camera images normalize to bounded JPEG without upscaling; supported native files are resized/compressed locally before the unchanged 6 MB upload limit. Gallery files retain supported formats and strict limit/decoder checks.

Scoresheets show selected-image preview, honest private upload/processing stages and **Upload and review**. With inference paused this follows manual review with unknown scores until a person reviews the original. Guardian consent, private signed upload, local OCR, declared date, tenant/role permissions, human decisions, retention and audit rules are unchanged. Guardian originals never go to an external model.

**115 unit tests**, TypeScript, production build and **102 rolled-back SQL assertions** (37 preseason, 65 operations) passed. **22 production browser cases** passed: camera controls on desktop/mobile Chromium, a full guardian camera-JPEG journey, the ordinary mobile file journey, public/signup/judge/Meta evidence regressions. Camera control coverage includes capture/retake/local confirmation, real browser permission denial, injected no-device fault, cancellation/late permission cleanup, navigation cleanup, invalid/oversized files, oversized native-photo normalization, actual WebP upload and explicit retry after an injected storage failure. A real blurred synthetic JPEG submission returned **unable_to_assess / unreadable_or_unsupported**, remained pending and preserved the declared date. Actual coach camera-JPEG upload reached manual review with confirmation forbidden to that coach.

Chrome tests and footage use an explicitly synthetic virtual-camera feed. Physical desktop optics, iPhone Safari, Android Chrome and native operating-system camera pickers were unavailable and are not certified. No universal client blur detector or document-authenticity claim is made. See [CAMERA_CAPTURE.md](CAMERA_CAPTURE.md).

Production health is good, Meta remains disabled and configured private credentials are absent from deployed client assets. Public reference fingerprint and canonical judge memberships are unchanged; judge access works. Completed filming-test invitations were revoked/replaced as appropriate; canonical judge invitations were not touched. No schedule was published, real notification sent, model inference run, infrastructure replaced or billing changed.

## Updated camera review video

The updated audio-pending review cut is `C:\Users\matti\Downloads\courtside-ai-camera-audio-pending.mp4`: 170 seconds, 1920×1080 H.264/AAC, 25.41 MB with intentional silence. Full audio/video decoding and Chrome playback through the end passed; midpoint and camera/invitation boundary frames were visually checked. It replaces guardian and coach footage with genuine deployed camera interactions, previews, consent/private uploads and review. A visible label discloses the virtual camera and fictional feed. Invitation tokens are redacted. Separate saved Meta extraction and approved-season/schedule examples are labeled; no new inference or automatic eligibility is implied.

The seven founder timing slots and recording folder remain `C:\Users\matti\Downloads\COURTSIDE AI Narration`. Actual founder audio, final synchronization, owner review and authorized publication/submission remain pending. Earlier review videos and source recordings are preserved. No public upload or entry submission occurred.

---

# Earlier November 3 release baseline

Live: [COURTSIDE AI](https://courtside-ai-one.vercel.app). Current runtime **21861ba7e10ecb6575c69ec9a4dc2916fc4504b0** is Ready as **dpl_AZE3ohKoLeEUPQh2hodeEeVLeAZA**. [Linux CI passed](https://github.com/matcpu/courtside-ai/actions/runs/41725660671). The final copy/shape correction keeps evaluation envelopes separate from primary scoresheet extractions. Supabase remains xdmkgoradmbnjofmbojs; no infrastructure or billing changed.

## Final release pass

Meta AI activity now presents three benefit-focused cards, a restrained paused notice, working saved-run actions, readable score/placement summaries and a chronological tool-outcome timeline. Tool failures and unverified outcomes remain explicit. Current canonical proposals, saved human approvals and original model-name warnings remain distinct from model prose. Original outputs, arguments, identifiers and request digests are expandable. New inference remains disabled. Coaches get an authorized schedule action rather than an inaccessible administrator action. Loading/error states discard outdated requests. Muted text contrast is improved throughout the existing green identity.

**112 unit tests**, TypeScript and an isolated production build passed. **106 PostgreSQL assertions** passed and rolled back (65 operations, 37 preseason, four independent-proposal decisions). The production release passed **22 browser cases** across desktop/mobile, including the fresh captured desktop preseason journey, normal mobile onboarding, public/signup/role checks, genuine saved evidence and primary-versus-evaluation presentation. A further **21 real API/file checks** passed: signed uploads, malformed bytes, privacy, resubmission, duplicate/recompressed images, consent/age, expiry/revocation, readiness, deletion and retention. New schedule publication was deliberately withheld; publication and notification/read-receipt behavior were verified in rolled-back SQL and previously recorded results rather than publishing another schedule. Early local failures during transient database connectivity were rechecked successfully after the database checks finished.

The public reference fingerprint is unchanged. Production health confirms Supabase connectivity and paused Meta. Client-secret scanning passed. The exact synthetic judge roles work; their guardian invitation was refreshed privately without email. The packet stays in ignored `.local/judge-access.md`; refresh again before handoff if expired. Existing safety, authorization, consent and retention rules remain in force. All new inputs were synthetic. No Meta inference, email delivery, real-youth decision or external message was initiated.

## Video and owner handoff

The November 3 release edit uses fresh genuine recordings of the updated deployed application. It includes actual draft/submission, invitation creation, mobile image preview/consent/upload, original inspection, screening, courts/readiness/drafts, a new synthetic scoresheet upload and separate genuine saved Meta results. Separate synthetic examples are labeled. The original model naming error remains visible; the main revised schedule remains unpublished.

The review cut is **audio pending**, 170 seconds at 1920×1080 H.264/AAC, saved to `C:\Users\matti\Downloads\courtside-ai-release-audio-pending.mp4`. It uses a silent AAC track, not a placeholder narrator. The owner's seven recordings are required before final audio synchronization or any claim of a completed narrated video. Recording scripts and exact input slots are in DEMO_NARRATION.md and RECORDING_RUNBOOK.md. No robotic voice is used. Video publication, the actual public video URL, accurate team/track/promotion choices and final entry submission remain owner decisions. No upload or submission has occurred.

Prior recordings and earlier evidence are preserved below as historical context. Deferred physical iOS camera certification, broad email delivery, issuer authentication and production-scale recovery remain outside verified scope and are not new submission requirements.

---

# October 30 historical verification baseline

Live: [COURTSIDE AI](https://courtside-ai-one.vercel.app). Runtime source **19d91fd600ed59cd4390fcf7ef0487ed86b392d1** is Ready as **dpl_EUdCfzSFenE3ngfFzYVw1qdAwjrx**. The stable public origin was tested after deployment. [Linux CI passed](https://github.com/matcpu/courtside-ai/actions/runs/41097184247). Source: [matcpu/courtside-ai](https://github.com/matcpu/courtside-ai). Supabase remains xdmkgoradmbnjofmbojs.

## October 30 verification experience update

The existing coach → guardian → administrator journey is now discoverable from Preseason Onboarding. Team selection, roster/invitation navigation and the administrator queue are prominent. Adding a player focuses their status card; invitations, copying and replacement confirmation stay with that player, including while review is pending. Roster progress explains minimum size, submission and scheduling blockers. A generated link is distinguished from an actual email delivery.

Guardians can select an image or request a camera capture, inspect a local preview and see validation, real upload/processing stages and resubmission reasons. Supported files remain JPEG/PNG/WebP up to 6 MB; PDF/HEIC are explicitly unsupported. Opening the original loads reviewer screening findings automatically. Human inspection, reasons, attestations and existing server permissions still determine eligibility. Legacy seasons explain unenforced readiness and require explicit acknowledgment before enabling it; seeded players are never relabeled as verified.

Validation: **108 unit tests**, TypeScript, a fresh isolated production build and **37 rolled-back preseason SQL assertions** passed. The complete updated synthetic browser journey passed on the deployed application in desktop and mobile Chromium: add player, invite, upload/consent, original inspection, screening, resubmission, approval, coach status, readiness and opening-weekend scheduling. Both legacy confirmation and ordinary enforced-season behavior were exercised. The final pending-review link-management adjustment received a separate production desktop/mobile judge-role regression. Physical iOS camera behavior remains unverified. Exact role-by-role buttons are documented in [PRESEASON.md](PRESEASON.md).

The production health check reports a working database and disabled Meta inference. No Meta calls or emails were sent for this update. The public reference fingerprint is unchanged; deployed client assets contain no configured private credentials. Existing private Storage, tenant authorization, consent, retention and deletion controls were reused. Video files and recording sessions were not changed.

## Actual Meta work

All three capabilities have genuine Muse Spark responses. The main sequence used seven requests: specific contradictory-questionnaire interpretation, exact 78–43 image extraction without invented statistics and five operations responses selecting all five tools. The actual owner-confirmed result was recorded through normal review before the agent ran. The agent saved two proposals and a feasible current-division draft without approving or publishing.

The owner then approved both original moves: Eastside Eagles Competitive → Premier and Riverside Ravens Competitive → Development. Both normal administrator decisions are audited. A narrow revision fix allows independent unchanged sibling proposals to be reviewed without staling the second merely because the first was approved. Other substantive data changes still invalidate recommendations.

The subsequent deterministic schedule v3 retains 19 completed fixtures, adds five games and gives Lakeside Lynx/Valley Vipers byes. **It remains unpublished for owner review.** Original model draft v2 is retained separately. The original model narrative's Riverside/Parkdale mistake is preserved and visibly flagged against canonical saved records.

Expanded evaluation includes five new scoresheets, two new questionnaires, eight generated fictional document illustrations and two actual error/recovery runs. The second recovery returned a final model explanation explicitly acknowledging the rejected lookup and successful subsequent actions. The first saved actions but reached its server bound before a final model summary. Its bounded-stop message is system text. See [EVALUATION_REPORT.md](EVALUATION_REPORT.md).

## Usage and controls

There are **32 completed provider responses**, 164,392 input and 18,482 output tokens, with 94,902 cached input tokens. No uncertain reservation remains. All-input-uncached conservative estimate: **US$0.2840385**; the software's two-times safety debit is **0.568077 guard units**. This is not an invoice.

The last genuine billing observation was **149.98 free credit units at 03:30 UTC**. Later billing-page checks remained loading. Its freshness expired at 04:30; no current balance is invented. The global budget is paused, saved local and production inference are disabled, and further inference requires a fresh truthful observation. No card charge, billing change or other service purchase was authorized or performed.

The owner superseded the original eight-request limit with cumulative promotional development authorization of approximately 120/150, reserving 30. Serialized service-only database reservations, conservative usage accounting, exact attempt deduplication, explicit observation timestamps and pause-on-uncertainty enforce software controls. Provider built-in paid tools, public/background inference and automatic transport retries are disallowed. These controls are not a guaranteed provider hard cap.

## Document screening and onboarding

Regular guardian uploads use private Storage and server-local OCR; no guardian document goes to Meta. Exact reuse, versioned combined pHash/dHash similarity, registered name/date consistency, supported checksums and deterministic age eligibility support an authorized human reviewer. OCR worker initialization, recognition and nested cleanup are bounded.

The previous JPEG similarity miss is fixed for the measured fixture and passes a real deployed upload regression: zero exact match but a similar-document flag. Private image hashes are stripped from reviewer responses and cleared with original deletion. Shared layouts and strong transformations remain possible false positives/misses.

Eight immutable generated illustrations were separately evaluated with Meta: 4/4 constructed inconsistencies flagged, 0/2 benign suspicion flags, 2/2 unreadable/unsupported outcomes handled, and only 1/2 requested visual-anomaly observations detected. The miss is retained. This is a small prototype evaluation, not issuer authentication or general fraud accuracy.

The main fictional guardian submitted proof and consent through the real mobile form. Verification is pending an administrator decision. Placement/readiness approval is not fabricated. Both guardian/reviewer and opening-weekend workflows are independently exercised in isolated synthetic test seasons.

## Earlier October 29 verification baseline

- TypeScript and **104 unit tests** passed.
- **170 real transactional SQL assertions** passed and rolled back: 65 operations, 37 preseason, four independent proposal reviews and 64 finance/evidence/timestamp checks. Finance contract tests made zero provider calls.
- **21 production preseason API/file checks** passed, including real signed uploads/OCR, exact and recompressed duplicates, role restrictions, resubmissions, consent/age/readiness, opening-weekend publication, deletion and retention.
- **20 production browser tests** passed in one full run: public/signup screens, normal coach/admin operations and revised publication/in-app receipts, guardian/reviewer onboarding and exact judge roles on desktop/mobile Chromium. Canonical Riverside warning and approved action records were visible.
- Fresh isolated build and dynamic OCR deployment trace passed. The existing OneDrive cache was not deleted. Reachable history/source and 10 deployed client assets/both entry pages passed configured-secret scans.
- All three disabled-Meta checks and actual recording-evidence gate passed; public reference fingerprint remains unchanged. Restricted email testing remains complete and was not repeated.
- Supabase advisor reports four informational no-policy notices for intentionally browser-inaccessible private budget tables, and the existing Auth [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No new security warning or paid upgrade.

## Review work

The updated 180-second screen plan, narration, honest feature audit and official-form draft are prepared. A narrated 178.920-second 1920×1080 WebM review recording is saved privately at `.local/review-demo/courtside-ai-review-draft.webm`. Its actual application captures come from verified deployed runtime 69e006d. All 22 scene cuts were decoded and checked, including complete placement questions and genuine coach updates; encoded narration was verified through the closing scene. No public upload or final submission has occurred. See RECORDING_RUNBOOK.md and SUBMISSION.md. The public submission form's field comparison is dated October 28; October 29 signed-out access showed only the event landing page.

Temporary judge accounts avoid unrestricted signup. Their private packet is ignored and staging-blocked; guardian invitations expire and must be refreshed before judging. Physical Safari/camera support, general real-user signup/email delivery, large-scale load, disaster recovery and issuer authentication remain outside verified scope. They are not current submission blockers.

Final owner decisions are review of the local video/materials, schedule publication if desired, accurate track/team/permission choices, and authorization for public video upload and entry submission.
