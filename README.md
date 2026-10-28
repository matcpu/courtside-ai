# Courtside AI

**The league that learns as it plays.**

Autonomous youth basketball league operations for the Meta Global AI Developer Hackathon. Coaches register teams; administrators approve placements; a deterministic engine schedules confirmed courts; scorekeepers review scoresheet extractions; verified results update standings and Elo ratings; the operations agent prepares evidence-based division and schedule proposals for human approval.

**Live application:** [courtside-ai-one.vercel.app](https://courtside-ai-one.vercel.app) · [Public reference league](https://courtside-ai-one.vercel.app/league/northstar-demo)

This is an operations platform. It does not provide basketball coaching or evaluate individual children's abilities.

## What works

- Next.js App Router, TypeScript, Tailwind and a Radix/shadcn-style component foundation.
- Real Supabase PostgreSQL, Auth and private Storage, with tenant membership authorization, RLS, composite tenant foreign keys and audited transactional commands.
- Team questionnaire and deterministic initial placement, administrator approvals, private rosters and age/consent review.
- Constraint-based round generation, confirmed court availability, 30-minute minimum rest, frozen completed fixtures and versioned publication.
- Private scoresheet upload and human result review; corrections replay all official results to recalculate ratings. Missing statistics remain null or absent.
- Evidence-based division proposals after three verified mismatches; rejection and stale-version checks.
- Transactional notification outbox, leases, idempotency, retry timing and honest delivery states.
- Public fictional reference league; signed-in users can create an isolated private demo.

**Provider status:** Meta credentials are configured privately; `META_API_ENABLED=false` pauses all Meta requests while participant credits are pending. Integration and bounded tool orchestration still need a live verification run after authorization. Resend delivery requires a sending key and an authorized verified sender. Twilio sending is intentionally disabled pending complete opt-out handling. See [STATUS.md](STATUS.md) for verified evidence and outstanding work. A passing unit test of a mocked provider is not a live provider test.

## Meta's role

The configurable Meta model defaults to `muse-spark-1.3`, using the official [Meta Responses API](https://dev.meta.ai/docs/overview), not an alternative model behind a Meta label. The integration uses strict JSON schemas, local Zod validation, image input and `store:false`.

Muse Spark interprets questionnaire context and explains the deterministic placement recommendation; extracts final scores and explicitly recorded player stats from a private scoresheet image; explains schedule changes; and selects tools in a bounded league operations workflow. Agent tools can inspect, evaluate balance and save schedule drafts. They cannot approve placements or results, move teams, publish schedules or send messages.

Age eligibility, ratings, standings, proposal thresholds, conflict detection and database integrity remain deterministic. The AI integration fails explicitly when unavailable. The manual result path is labeled manual and is never represented as Meta recognition.

## Run locally

Use Node.js 24 LTS and npm. Dependencies are pinned and the cross-platform lockfile is committed.

```sh
npm ci
cp .env.example .env.local
# Add the existing project's Supabase publishable key privately.
npm run dev
```

PowerShell: `Copy-Item .env.example .env.local`. Open `http://localhost:3000`.

The only permitted hosted database is project `xdmkgoradmbnjofmbojs` in `ca-central-1`. Its migrations are already applied; do not run them again against a different project. For a fresh local Supabase instance, apply the ordered files in `supabase/migrations/`. See [SETUP.md](SETUP.md).

```sh
npm run typecheck
npm test
npm run build
# With a local server running and Chrome installed:
npm run test:e2e
```

Database integration assertions are in `tests/database.sql`; execute only against the specified project using authenticated tooling. They run in a transaction and roll back all synthetic users, storage metadata and league mutations.

## Demo access

The landing page opens a public, read-only reference league with 12 fictional teams, 18 fictional historical results, confirmed example gym slots and future fixtures. No shared administrator password is published. Create and confirm your own account, then choose **Settings → Create private demo** to run mutations in an isolated workspace. [DEMO.md](DEMO.md) includes a three-minute script and recording checklist.

## Hackathon contributions

All application code, database migrations, workflows, tests, visual assets and documentation in this repository were created starting **October 28, 2026**, during the October 27–November 4 building period. The baseline commit `6865228` contained only the repository README. Dependency libraries are third-party; see their licenses. The court artwork and sample scoresheet are code-created original assets. All demo data is synthetic.

The [official participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) was reviewed on October 28. Submission is due **November 4, 2026, 9:00 PM Eastern (America/Toronto)**. The public repository, live product and three-minute video must identify the new hackathon work. Do not submit this as a completed Meta-powered demo until a real model request is verified.

## Project documentation

[Architecture](ARCHITECTURE.md) · [Database](DATABASE.md) · [Setup](SETUP.md) · [Credits](CREDIT_SETUP.md) · [Tests](TESTING.md) · [Demo](DEMO.md) · [Status](STATUS.md)
