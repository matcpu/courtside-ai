# Launchpad design review — local only

This candidate is on `codex/organizer-setup`, based on `a111cfbce482fd8ebce7b32152c12a67c424f1d3`, with uncommitted design changes for owner review. Nothing has been pushed, merged or deployed. No hosted database or production flag was touched.

## Final data and disclosure update

The three populated preview URLs below are unchanged. Their **actual saved division configuration** is now ages **12–13** for all three U14 tiers, with the **September 1, 2026** cutoff retained. This was an authenticated, atomic setup change in the existing loopback database, not a frontend label substitution. Production defaults remain unchanged; the original recording league was not edited.

A named disclosure directly below navigation reads **Demo league · All teams, venues and results are fictional.** The footer disclosure remains. Fixture cards and the venue heading omit only the legacy terminal `· Fictional venue` annotation on declared demo pages. The stored venue records are preserved; real-league names are not reformatted this way.

Latest screenshot folder: `C:\Users\matti\OneDrive\Documents\ChatGPT\courtside-ai\.local\launchpad-design-v2-final`.

For each of `arena`, `clubhouse`, `scoreboard`: `-desktop.png`, `-mobile.png`, `-desktop-full.png`, `-mobile-full.png`, `-tablet.png`, and `-division-ages.png`. `comparison.png` compares the final viewport captures. `acceptance.json` records the actual saved division ranges, cutoff, unchanged fixture/team/result counts and recording-league protection check. Earlier screenshots remain untouched.

TypeScript/build, **147 unit tests** and **6 browser workflow tests** pass. Actual desktop/tablet/mobile acceptance verifies the top disclosure, correct age/cutoff, absence of repeated venue annotation, 4 featured versus all 25 fixtures, 18 confirmed finals, 6 upcoming fixtures, 1 past pending result and 12-team complete standings. Core before/after equality checked the existing games, teams, fixtures, court availability and schedule versions. No backend restart or hosted action occurred. Keep port 3302 running while reviewing.

The refinement notes below describe the earlier age configuration and screenshot directory where superseded by this section.

## Visual refinement 02 — current review

The existing preview URLs below now show the second design pass. All work remains local and uncommitted. The original recording league was not edited; its workspace hash matches the baseline. The synthetic backend on port 3302 was not restarted.

- **Arena:** predominantly off-white, rich green athletic typography, restrained lime actions and an integrated lightweight season guide. No dark full-page UI.
- **Clubhouse:** warm paper and apricot, a humanist sports masthead, basketball geometry and a compact community/division layout. No stock photography or repeated hero logo.
- **Scoreboard:** compact identity above a four-game feature and six-team standings sidebar. All 25 published fixtures and all 12 standings rows/full columns remain accessible in keyboard-operated disclosures.
- **Game states:** 6 genuinely future fixtures, 18 confirmed finals and 1 past unconfirmed result pending in each populated review league. No pending score is presented as official; no past unconfirmed game is labelled upcoming. Selection and grouping are presentation only.
- **Identity:** [SVG master](public/demo/harbour-hoops-mark.svg), also served at http://127.0.0.1:3301/demo/harbour-hoops-mark.svg. Interlocking HH pillars with a court arc, no tiny text. Transparent PNGs at 16/32/192/1024px are in `.local/launchpad-design-v2`. Review websites use the existing server-sanitized PNG contract, without enabling SVG uploads or changing Storage policy. No real-league or no-logo path selects this demo asset automatically.

Current screenshot directory: `C:\Users\matti\OneDrive\Documents\ChatGPT\courtside-ai\.local\launchpad-design-v2`.

| Artifact   | Files                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Arena      | `arena-desktop.png`, `arena-mobile.png`                                                                                 |
| Clubhouse  | `clubhouse-desktop.png`, `clubhouse-mobile.png`                                                                         |
| Scoreboard | `scoreboard-desktop.png`, `scoreboard-mobile.png`                                                                       |
| Comparison | `comparison.png` (side-by-side actual desktop/mobile screenshots), `comparison.html`                                    |
| Logo       | `identity-board.png`, `harbour-hoops-16.png`, `harbour-hoops-32.png`, `harbour-hoops-192.png`, `harbour-hoops-1024.png` |

Each theme also has `-desktop-full.png`, `-mobile-full.png`, `-tablet.png`. Desktop captures are 1440 × 1050; mobile 390 × 1000; tablet 768 × 1024. The earlier Review & Finish screenshots remain in the original design-review folder and the setup UX is preserved.

Current checks: TypeScript and production build pass; **142 unit tests / 20 files**, **6 desktop/mobile browser tests** pass. Actual screenshot checks verify four featured versus all 25 games, the pending label, all 12 standings rows on expansion, navigation, keyboard controls and empty registration states. Browser-only layout stress checks cover long names, no logo and three custom colour pairs at all widths; 11,740 sampled text contrasts passed ≥ 4.5. Actual editor tests confirm logo upload/removal, preview theme/colour changes and mobile controls without saving or publishing those temporary edits. Source and asset hashes match the running build. No hosted testing is claimed.

The native archive disclosures initially show a short selection; open **All 25 fixtures & results** and **Full standings · 12 teams** to inspect the complete public data. Registration and eligibility values remain authoritative. Mobile checks use browser emulation, not physical-device or full assistive-technology certification.

The first-pass notes below are historical where they describe a superseded composition or test count.

## Open the actual redesigned websites

These pages are explicitly published **only in the running loopback synthetic database**. Viewing them requires no login.

| Theme                 | Local website                                                                    |
| --------------------- | -------------------------------------------------------------------------------- |
| Arena                 | http://127.0.0.1:3301/league/league-3c40ca26-d30f-4df3-bebf-386cbee1e599/website |
| Clubhouse             | http://127.0.0.1:3301/league/league-0324c517-7fa2-4554-8976-83f3c0e8dceb/website |
| Scoreboard            | http://127.0.0.1:3301/league/league-4673e7f6-2bee-4383-afc4-095e9794c627/website |
| Empty upcoming season | http://127.0.0.1:3301/league/league-41bed11e-da1a-40db-9148-85ae36aea98b/website |

Each populated theme uses its own newly seeded synthetic league: 12 approved teams, 25 published fixtures, 18 confirmed synthetic results, 3 U14 divisions, 2 courts at 1 configured venue. Screenshots show authoritative ages **0–13**, not an invented 12–13 range. Registration is closed for Fall 2026. The empty Spring 2027 league has open registration and no invented teams, scores or fixtures. Existing recording/reference records were not edited.

Arena uses an oversized athletic masthead, season ticket and horizontal division tiers. Clubhouse uses a centered editorial masthead and story-first composition. Scoreboard puts fixtures first and pairs division/venue information in a compact two-column hub. All keep public copy, uploaded logos and configurable colours. Black/white foreground selection preserves contrast on customized colour surfaces. Internal theme keys `arena`, `community`, `courtside` remain unchanged; no schema migration is needed.

## Review the five-step setup

1. Open http://127.0.0.1:3301/.
2. Sign in as `launchpad-admin@example.invalid`, password `SyntheticPreview!2099` (local synthetic account only).
3. Choose **System settings & access → Create league**.
4. Resume **Harbour Hoops League · Spring launch**.
5. Choose **Review & finish**. The draft has not been finished or published. Use **Edit facilities**, **Edit divisions**, **Edit rules & safety**, **Edit deadlines**, etc. to return directly to their steps.
6. To see validation, add an incomplete court and try Continue, or clear the accepted proof selections while proof is required. Review lists unresolved items with direct correction controls. Remove the incomplete court / reselect Passport before recording a complete review.
7. Use **Save draft & exit** to preserve it. Finish Setup creates a private league; website publication and registration are still separate explicit decisions.

The wizard is stateful at `/`; there is no fabricated deep URL for a review step. The local coach remains `launchpad-coach@example.invalid`, same synthetic password, for the existing recording league.

## Actual screenshots

Absolute folder: `C:\Users\matti\OneDrive\Documents\ChatGPT\courtside-ai\.local\launchpad-design-review`.

- `arena-desktop.png`, `clubhouse-desktop.png`, `scoreboard-desktop.png`: 1440 × 1000 viewport captures.
- `arena-mobile.png`, `clubhouse-mobile.png`, `scoreboard-mobile.png`: 390 × 1000 viewport captures.
- Each also has `-desktop-full.png`, `-mobile-full.png` and `-tablet.png` (768 × 1024).
- `review-desktop.png`: complete Review & Finish at 1440 × 1500; `review-tablet.png` and `review-mobile.png` show responsive review.
- `empty-desktop.png`, `empty-tablet.png`, `empty-mobile.png` cover the empty upcoming season.
- `manifest.json` identifies only the local fixtures and original recording workspace baseline hash. These screenshots/manifests are ignored by Git.

## Verification

- `npm run launchpad:review -- --build-only`: isolated synthetic-only environment; Next type generation, `tsc --noEmit` and optimized production build passed. Final follow-up source copies were typechecked and built in the same isolated directory, without loading project secrets.
- `npm test`: **137 tests / 19 files passed**.
- `npm run test:database:local`: Launchpad, proof-policy, legacy DB and Preseason assertions; existing-policy upgrade; repeatable clean setup and permissions/RLS checks passed. This is the in-memory PostgreSQL harness, not hosted Supabase acceptance.
- `LAUNCHPAD_LOCAL_PREVIEW=true E2E_BASE_URL=http://127.0.0.1:3301 npx playwright test tests/e2e/launchpad-design.spec.ts --workers=1`: **6 passed**, desktop/mobile. Covers required/duplicate facilities, proof selection, correction links, friendly summaries, saving/resuming, populated/empty public pages, explicit publication, private copy isolation and preserved stale-draft HTTP 409 with complete before/after equality after rejection.
- Additional actual browser captures: 3 themes × desktop/tablet/mobile, plus empty pages. Verified keyboard skip, native rules disclosure, public fixture/standings counts and no horizontal overflow/page errors.
- Builder checks: all three theme choices, actual synthetic PNG upload, mobile preview, custom brand/accent controls with light/dark extreme colours (sampled important text ≥ 4.5 contrast), no nested `main`, disabled publication pending review, no saved/public mutation from preview-only edits.
- The original recording league's complete workspace matched its baseline hash after testing. Port 3302's original backend process stayed running throughout frontend rebuilds.

## Limits and next review decisions

- This is a **local, in-memory demo**. Do not stop/restart the synthetic backend on 3302 while recording: these league URLs and drafts last for that process. The app/frontend on 3301 is running against it. Existing startup instructions create a fresh database, not these exact UUIDs.
- No hosted acceptance, GitHub CI or production release is claimed for this uncommitted design candidate. The existing backup/hosted release gates remain unchanged.
- Displayed age limits are exactly those configured in the database. An organizer must deliberately choose an appropriate lower bound before using the rules for a real league.
- Responsive captures use desktop Chrome and browser-emulated widths, not physical iOS/Android devices or a full assistive-technology audit.
- The existing PR #1 legacy reference website fallback retains its separate design. Only Launchpad-configured templates were redesigned; there is still one canonical website route and one explicit publication mechanism.
