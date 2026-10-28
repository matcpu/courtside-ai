# Courtside AI engineering constraints

Work only in matcpu/courtside-ai and Supabase xdmkgoradmbnjofmbojs. Never create replacement infrastructure or touch other projects. Keep secrets out of Git and output. Use only synthetic demo records.

Official results and schedule publication require authenticated human approval. Deterministic code owns ratings, standings, eligibility and constraints; Meta can propose and explain, never manufacture facts. All tenant mutations must be authorized in PostgreSQL and atomic. Public data must exclude youth identities, contact details and private documents. Preserve version history and audit events.

Run typecheck, Vitest and build before milestone commits. Run database and browser integration checks for workflow changes. Do not report an untested integration as working. Keep STATUS.md accurate. Do not incur charges.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
