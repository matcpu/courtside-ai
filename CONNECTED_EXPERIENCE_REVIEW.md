# Connected Courtside experience — local review

**Current local recording session:** use [INTERACTIVE_DEMO_REVIEW.md](INTERACTIVE_DEMO_REVIEW.md) for automatic isolated demo access. No manual credentials are required. This guide's shared-account URLs and sign-in steps describe normal authenticated mode; the automatic demo creates its own tenant and correctly denies those other tenants' private workspaces.

This is an uncommitted candidate on `codex/organizer-setup`. It uses the existing Next.js application, Supabase client/session and PostgreSQL authorization. No production deployment, hosted change, migration, billing or Meta setting change was made.

## Open the connected journey

- Product homepage / league selection: http://127.0.0.1:3301/
- Public Scoreboard demo: http://127.0.0.1:3301/league/league-4673e7f6-2bee-4383-afc4-095e9794c627/website
- Its organizer dashboard: http://127.0.0.1:3301/workspace/a4243992-2c13-4e3e-8775-816ea152b4ef
- Its Launchpad: http://127.0.0.1:3301/workspace/a4243992-2c13-4e3e-8775-816ea152b4ef?view=Launchpad
- Onboarding entry: http://127.0.0.1:3301/?action=create
- Explicit sign-in entry: http://127.0.0.1:3301/?action=signin

Normal-authentication local tests obtain synthetic credentials from the existing loopback adapter's `/__preview` endpoint. No private password is stored in this guide. The current interactive recording mode requires no credentials; no email signup is required or sent.

1. Visit `/` signed out. The product entry explains the platform; **Explore a working demo league** opens the existing published Harbour Hoops Scoreboard website.
2. Use **Powered by Courtside AI** to return to `/`. **Create your own league** opens the existing authentication/setup flow.
3. Sign in from the header. The app shows **Choose your league**, rather than selecting a public or unrelated league. The **Scoreboard demo workspace** badge identifies this demo's authorized management card. Search `Harbour` to narrow the list.
4. Open that card. The workspace header's **View league website** opens the published website for exactly that league. The website's **Manage league** link returns to `/workspace/<same-id>`.
5. Legacy public portals such as `/league/northstar-demo` and `/league/northstar-demo/website` are preserved. The public portal's sign-in action is now outside the sidebar. Successful sign-in there returns to the product's league chooser.
6. The original recording league is still available at http://127.0.0.1:3301/workspace/6f3c65a0-338d-4910-af4f-f2081174406b . Its data and saved website configuration were not edited.

## Authorization and consistency

The existing `my_leagues` SQL function is subject to a policy that also exposes public league rows. The private league-list API now verifies membership through PostgreSQL's private snapshot before returning a minimal chooser entry; public visibility is not treated as membership. Selection never falls back to the first public league or a remembered unauthorized ID.

A small authenticated `/api/workspace-access?league=<id>` endpoint uses the same private snapshot authorization and returns only management/public-website navigation metadata. It does not return guardian, player or document records. Public website navigation does not trust local UI roles or URL parameters. Only an administrator receives **Manage league**. Private API access and all mutation commands retain independent server/PostgreSQL checks. Coach membership still permits the existing coach workspace, without granting organizer writes.

Explicit `/workspace/<id>` URLs preserve tenant identity, with allowlisted `?view=` links for existing sections. Signed-out visitors see an account gate. Nonmembers see **League access required**, while API reads/writes are denied. Session/account changes clear the previous private snapshot. During a league switch, the menu remains mounted and old-tenant snapshots are withheld until the requested league's data is ready.

The published-site link checks actual publication/public visibility. It does not link a private draft as if it were published. Website themes, branding inputs, Scoreboard default, explicit approval controls, readiness rules, ratings, standings and existing workflows were not replaced.

## Verification

- TypeScript and production build passed in the isolated local runtime.
- `npm test`: 150 tests / 21 files passed.
- `npm run test:database:local`: Launchpad/proof-policy/legacy/Preseason assertions, clean setup, upgrade, permissions and RLS checks passed in an isolated in-memory database.
- **32 desktop/mobile browser tests passed** across `connected-journey.spec.ts`, `launchpad-design.spec.ts` and `public.spec.ts`. The mobile league-switch transition race found during regression testing is repaired and the previously failing atomic-conflict case passes.
- Browser coverage includes A–E, actual password sign-in, explicit league choice, all three website themes, legacy links, create-league authentication/setup, coach restrictions, 401/403 API checks, denied publication mutation, existing public privacy and Launchpad's atomic 409/no-partial-write regression.

Only the frontend on 3301 was rebuilt/restarted. The original synthetic backend on 3302 remained running. These exact local fixture UUIDs last for that process; do not restart it while recording. Browser mobile checks use Chrome emulation rather than physical devices. Hosted acceptance and unrestricted signup/email delivery were not exercised.

## Screenshots

Folder: `C:\Users\matti\OneDrive\Documents\ChatGPT\courtside-ai\.local\connected-journey`.

Each has `-desktop.png` and `-mobile.png`:

- `01-homepage`: signed-out product entry.
- `02-scoreboard`: public demo with product navigation.
- `03-league-selection`: successful local sign-in and explicit authorized league choice.
- `04-organizer-dashboard`: selected league plus **View league website**.
- `05-authorized-website`: public website plus authorized **Manage league**.
- `06-access-denied`: nonmember boundary.
- `07-header-sign-in`: legacy public portal's header action, independent of sidebar scroll.

`journey-desktop.png` and `journey-mobile.png` compare actual captures of the connected experience. The prior website design and age/disclosure screenshots remain in their original review folders.

## Explicit header return link

Every public website header now includes **← Back to Courtside AI** with direct `href="/"`, including Arena, Clubhouse, Scoreboard and the legacy website. The logo, league navigation and footer links remain. A signed-out desktop and 320px mobile test verifies the homepage/demo/back journey, direct links, keyboard focus, visibility and no horizontal overflow across all four website variants. Screenshots are in `.local/public-back-link`. The two targeted tests, 153 unit tests, TypeScript and build pass; the earlier 32-case run above remains the wider journey checkpoint.
