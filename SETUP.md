# Setup and operations

## Existing resources

- Repository: [matcpu/courtside-ai](https://github.com/matcpu/courtside-ai), public, `main`.
- Supabase: [specified courtside-ai project](https://supabase.com/dashboard/project/xdmkgoradmbnjofmbojs), `ca-central-1`.
- Vercel: `matcpus-projects/courtside-ai`, free Hobby plan. No paid service or upgrade was authorized.

## Environment

Copy `.env.example` to `.env.local`; never commit the resulting file. `.env.example` intentionally contains no key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the existing project's browser-safe publishable key; server and browser access still enforce database authorization. **Never substitute a service-role/secret key.**

`MODEL_API_KEY`, `RESEND_API_KEY` and Twilio credentials are server-only and must not have a `NEXT_PUBLIC_` prefix. Meta's URL is fixed to `https://api.meta.ai/v1/responses`; `META_MODEL` defaults to `muse-spark-1.3`. API credentials must not be pasted into chat, command arguments, logs or tracked files.

Notifications require `RESEND_API_KEY`, an authorized verified `RESEND_FROM`, and `NOTIFICATIONS_ENABLED=true`. Leave the flag false until the owner approves the sender and a controlled real-delivery test. Synthetic `example.com`, `example.org`, `example.net` and `.invalid` recipients are suppressed. The existing connected email account's domains were inspected read-only; no unrelated domain configuration was changed.

`SMS_ENABLED` is a reserved setting and does not enable the current implementation. SMS sending remains fail-closed even with credentials. Complete signed inbound opt-out handling, outbound consent rechecks and a verified provider test before implementing the sender. No phone numbers were purchased.

## Authentication

Email/password signup and sign-in use Supabase Auth. This project currently requires email confirmation. No shared admin password or auth bypass is provided. Sign up with an account you own and confirm its email; then sign in and create a league or private demo. New league creators become administrators only of that new league. Existing users can be added by a league administrator as coach, scorekeeper or referee.

Supabase Authentication → URL Configuration has been set to `https://courtside-ai-matcpus-projects.vercel.app`. That origin, `http://localhost:3000` and `http://127.0.0.1:3000` are explicitly allowed and were visually verified. The app supplies its current origin as the signup return URL; an unlisted alias falls back to the configured stable origin. No wildcard domains were added.

The public reference demo is read-only. The private demo RPC requires a real signed-in account and creates a separate synthetic tenant; it does not grant access to an existing league.

## Database changes

Migrations are already applied to `xdmkgoradmbnjofmbojs`. Do not reapply the bootstrap against that project or create another hosted project. Use authenticated Supabase MCP/CLI, inspect existing schema, create migrations using `supabase migration new`, apply only to the specified target and verify with queries and advisors.

For development with Docker and a separately local Supabase instance, install/use the pinned CLI (`npx supabase --help`), initialize local configuration, and apply the tracked ordered migrations. Never reuse production youth documents as test data.

## Vercel agent setup

The official [get-started playbook](https://vercel.com/get-started.md) was followed: global CLI installed, `vercel whoami` verified `matcpu`, the only available team was confirmed as Hobby, and shared `https://mcp.vercel.com` OAuth was completed in user-wide Codex configuration.

The Vercel plugin installer could not find its plugin in the current Codex marketplaces. After checking official plugin documentation, the documented standalone `vercel-labs/agent-skills` fallback was installed globally. The running chat's tool catalog has not loaded the newly added MCP tools; authenticated CLI operations work. MCP documentation-search/list-teams tool verification needs a future tool refresh; do not restart the active build just for that.

`scripts/configure-vercel.mjs` is a Windows helper for this machine. It reads `.env.local`, uses the globally installed CLI, and passes environment values through stdin without printing them. Existing variables are not overwritten silently. Configure updated secret values through Vercel's supported environment workflow.

`vercel.json` explicitly selects the Next.js framework and `npm ci`. The lockfile was regenerated without a platform-specific `node_modules` tree so Linux builds include their optional runtime dependencies.

## CI and deployment

GitHub Actions runs pinned installation, typecheck, unit tests and production build. A separate manually dispatched deployment workflow requires `VERCEL_TOKEN` in repository Actions secrets and Vercel project/team IDs as variables. It does not print the token or pass it as an argument. No workflow should deploy untrusted pull-request code with secrets.

Direct Vercel deployments work through the authenticated CLI. Connecting the repository for automatic Vercel Git deployments was attempted and rejected by the provider; GitHub integration authorization is still needed unless a later attempt succeeds. This does not prevent manual deployment or source pushes.

## Diagnostics

`/api/health` reports database connectivity and whether Meta/email are configured. A configured flag is not evidence of a successful provider request. `/api/league?public=true` returns only the safe public directory. Consult STATUS.md for live test evidence and blockers.
