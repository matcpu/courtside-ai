# Credential-free local Launchpad demo

Local, uncommitted review candidate on `codex/organizer-setup`. Not deployed.

## Record the journey

Open **http://127.0.0.1:3301/**. No email address or password is needed. Keep this browser profile for the recording; each fresh profile receives its own synthetic organizer and league.

1. **Create a league** opens guided **League basics** immediately. Enter a fictional league name and location.
2. **Season & divisions**: enter season/opening/cutoff dates, ordered registration/roster/verification deadlines and division age ranges. The tested example is Spring 2027, March 1–June 30; opening March 6; January 1 cutoff; deadlines February 1, 15 and 28; ages 12–13.
3. **Facilities** → **Add a court**: enter a fictional court and venue. **Rules & safety**: choose roster bounds and an accepted proof type (the test uses 5–12 and Passport).
4. **Review & finish** → **Finish setup**. The new league opens in its own `/workspace/<id>`.
5. **League website**: Scoreboard is the default; Arena and Clubhouse remain selectable. Change copy/colours or upload a synthetic logo. **Save website draft** keeps it private.
6. Check **I reviewed the saved public copy…**, then **Publish saved website**. This publishes only inside the loopback demo database. Use **View league website**, then **Manage league** to return to the same league.
7. **← Back to Courtside AI** returns to `/`. **Explore demo** opens this browser session's populated Scoreboard seed. **Open demo dashboard** opens that seed's dashboard. Newly created leagues remain available in the organizer's league switcher.

Dashboard and website IDs vary by session. Follow these links instead of copying a different browser's private workspace URL. No fabricated fixtures are added to a newly created empty league.

## Isolation and production boundary

The development server establishes an opaque, HttpOnly, SameSite=Strict cookie and keeps the synthetic Auth token server-side. It creates an ordinary synthetic user and new tenant through existing authenticated PostgreSQL commands; memberships and tenant authorization remain enforced. Client flags, guessed cookies and hidden buttons provide no authority.

Activation requires a development artifact, server-side `LAUNCHPAD_LOCAL_PREVIEW=true`, loopback HTTP on port 3301, the exact existing synthetic backend/key on 3302, verified adapter identity, no hosting-provider marker and disabled Meta/notification/SMS settings. Cookie-authorized mutations require matching Origin. A production build compiles the activation guard off, even when the preview environment flag is true at runtime.

The cookie expires after eight hours. Server-held sessions live for the frontend process lifetime; development hot reload preserves them. Do not restart the frontend while recording. A fresh browser session creates another isolated synthetic league, without editing the original recording or design-review leagues. The local adapter remains the existing in-memory database; stopping it loses its data.

## Services and checks

Both services are left running, with the original backend on `127.0.0.1:3302` unchanged. `npm run launchpad:interactive` starts only the frontend against the existing adapter and prepared temporary review runtime. Do not run another launcher while port 3301 is occupied. Do not restart port 3302. `npm run launchpad:review -- --build-only` prepares/checks a separate production artifact without starting either service; production artifacts intentionally require normal sign-in.

Verified on November 4, 2026:

- 6 desktop/mobile browser cases: complete credential-free journey, immediate Create/Explore clicks, session continuity, all themes/logo, explicit publication approval, no horizontal overflow, inter-session denial, original-recording denial, forged-cookie denial and Origin rejection.
- 2 actual production-artifact browser cases: preview GET/POST return 404 even with the preview flag set; forged/client flags cannot read or create private leagues; Create still requires existing authentication.
- TypeScript and final production build passed; 160 unit tests across 22 files passed.
- Isolated database checks passed: 30 proof-policy, 142 Launchpad, existing database/preseason assertions, 5 upgrade and 16 repeated clean-setup/RLS/permission assertions. No hosted database testing is claimed.
- Original recording workspace hash unchanged; all three review websites retain ages 12–13, September 1 cutoff, 12 teams, 25 fixtures and 18 confirmed results. Meta is disabled; original backend PID remains 14516.

Actual desktop/mobile screenshots and per-journey URLs are in `.local/interactive-demo/`. Those automated browsers have separate private sessions; their private workspace URLs are evidence, not shared credentials. Mobile checks use Chromium emulation.

Scope: the Launchpad API journey above is verified. Direct browser Storage uploads for scoresheets/guardian proof were not enabled or certified for this cookie-only session; no Auth token is exposed to browser JavaScript. No real documents, outbound email/SMS, Meta inference, hosted changes, billing changes or video edits are part of this demo change.
