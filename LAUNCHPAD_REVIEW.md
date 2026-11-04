# Launchpad review guide

This is an isolated feature branch, not a production release. PR [#1](https://github.com/matcpu/courtside-ai/pull/1) was inspected at `43414f96ec7eba6ff4f0ca6d6dc1b5abf7495d1f` and remains unmerged. Its `/league/[slug]/website` route, starter workspace, identity/social utilities and original tests are reused. The configured themes extend that route; `/league/[slug]` stays the existing portal. Legacy website CSS is namespaced so both paths can coexist. No second competing public website route was added.

## Start the local synthetic preview

1. `npm ci`
2. `npm run launchpad:review` creates an isolated temporary production build, then starts the synthetic PostgreSQL/Auth adapter on `127.0.0.1:3302` and Next on `127.0.0.1:3301`. It never loads `.env.local`; all database traffic goes to loopback. Stop an earlier review harness before using the same ports. `-- --build-only` verifies the isolated build without starting servers. Ctrl+C stops only this launcher's children.
3. Open `http://127.0.0.1:3301/`. Synthetic admin: `launchpad-admin@example.invalid`; synthetic coach: `launchpad-coach@example.invalid`; local-only test password: `SyntheticPreview!2099`. These are test-adapter credentials, never hosted judge accounts. The database resets when the adapter restarts.
4. Run `npm run test:database:local` for the real SQL assertions. Browser opt-in: set `LAUNCHPAD_LOCAL_PREVIEW=true` and `E2E_BASE_URL=http://127.0.0.1:3301`, then `npx playwright test tests/e2e/launchpad.spec.ts --workers=1`. These tests intentionally refuse any hosted target.

The review harness does not implement hosted Auth email delivery, Storage signing or third-party provider calls. Its role/ownership decisions execute the real repository SQL. Existing document/operations SQL tests run separately against the same in-memory PostgreSQL engine and roll back. Hosted integration remains a release gate.

## Review the journey

- Sign in, open **System settings & access → Create league**. Choose **Help me set up a league**, **Copy a previous season**, or **I know what I need**. Resume a saved draft from the same entry point.
- Complete five steps. Age categories and tier labels are editable; country eligibility is never inferred. The optional brief helper extracts count/location with explicit rules, not Meta.
- **Save draft & exit** keeps an incomplete private draft. **Finish setup** atomically creates/configures a private season workspace. It neither publishes nor opens registration.
- **Launchpad → Launch overview** shows saved identity, actual registration, questionnaire/review counts and confirmed court capacity. Use **Courts & gyms** to confirm dated slots; an address alone never counts as capacity. Existing game/rest/readiness constraints apply.
- **League website** offers Courtside, Community and Arena themes, colours, normalized logo, public copy/contact and desktop/mobile preview. Save privately. The existing published revision stays visible until a separate explicit approval. Unpublish preserves history.
- Create a private coach invitation before that account exists. Optionally choose an existing team. Copy the expiring link privately. The recipient signs in with the matching confirmed account, then accepts. Membership and team assignment are atomic; old/revoked/expired links fail. No email is sent.
- **Brand & domain** gives rules-based naming ideas, a saved preference and explicit `.com` registration lookup. A lookup is a timestamped observation in the current view, not saved purchase/ownership evidence. Other suffixes, possible naming conflicts and handles require manual verification.
- **Social starter kit** provides copyable public-fact templates. No account is created, connected or posted to. **LAUNCHPAD_AGENT_DESIGN.md** documents future tools; none are presented as a model run.

## Release gates after submission

- Owner reviews this branch and the additive SQL proposal in `supabase/proposals/organizer_launchpad.sql`. It is deliberately outside applied migrations. No hosted migration or replacement infrastructure has been created.
- Generate the ordered production migration with the installed/pinned Supabase CLI only after approval; verify the current changelog first. Apply to the existing project only, run advisors, and repeat hosted authorization/API/browser acceptance before enabling flags.
- Enable server `ORGANIZER_SETUP_ENABLED` and build-time `NEXT_PUBLIC_ORGANIZER_SETUP_ENABLED` together. They default to false. The schema-free PR #1 website/starter remains available independently in this branch.
- Review public copy/logo/contact/address for publication. Keep website publication, registration, official results, document eligibility and schedule publication as distinct human decisions.
- No domain/DNS, paid API, social OAuth/publishing, email expansion, SMS, payments or production deployment is part of this review.

Deferred: reusable organization-level season grouping, advanced playoffs/pools/travel rules, recurring availability templates/blackouts, domain purchases/custom-domain verification, automated trademark/name-conflict checks, verified handle lookup, social account connection/publishing and live Muse Launchpad orchestration. No unsupported controls claim these work.
