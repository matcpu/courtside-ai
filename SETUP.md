# Setup and operations

## Existing resources

- Repository: [matcpu/courtside-ai](https://github.com/matcpu/courtside-ai), public, `main`.
- Supabase: [specified courtside-ai project](https://supabase.com/dashboard/project/xdmkgoradmbnjofmbojs), `ca-central-1`.
- Vercel: `matcpus-projects/courtside-ai`, free Hobby plan. No paid service or upgrade was authorized.

## Environment

Copy `.env.example` to `.env.local`; never commit the resulting file. `.env.example` intentionally contains no key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the existing project's browser-safe publishable key; server and browser access still enforce database authorization. **Never substitute a service-role/secret key.**

`MODEL_API_KEY`, `RESEND_API_KEY` and Twilio credentials are server-only and must not have a `NEXT_PUBLIC_` prefix. Meta's URL is fixed to `https://api.meta.ai/v1/responses`; `META_MODEL` defaults to `muse-spark-1.3`. API credentials must not be pasted into chat, command arguments, logs or tracked files.

**Inference paused:** `META_API_ENABLED=false` keeps requests disabled even with a saved key and defaults to disabled when omitted. Promotional development is authorized, but every deliberate operator run also requires private actor/tenant scope, global spending reservation and a truthful recent credit observation. The current loading billing portal cannot provide a fresh balance, so further paid inference remains stopped. Registration/rubric/manual review and saved model evidence continue to work. See META_VERIFICATION.md.

The project-local Git configuration uses `.githooks/pre-commit`, which rejects staged private `.env*` files (including a force-added `.env.local`) and `.vercel/` configuration. CI checks tracked paths too. `.env.example` is the only permitted environment template. On a new checkout, run `git config core.hooksPath .githooks` to install the local guard. Deliberately bypassing Git hooks remains possible; no software guard can promise safety if those controls are intentionally overridden.

On this Windows machine, after privately saving a key, `node scripts/configure-meta.mjs` sends it to the existing Vercel project's Production and Preview environments through stdin as a Secret, together with `META_API_ENABLED=false`. The helper does not call Meta. Redeploying applies the variables to the new deployment; key presence is not a live authentication test.

Notifications require `RESEND_API_KEY`, `RESEND_FROM` and `NOTIFICATIONS_ENABLED=true`. Current Production/Preview configuration uses the owner-authorized Resend testing sender, `EMAIL_DELIVERY_MODE=test` and exactly one privately configured `EMAIL_TEST_RECIPIENT`. Other destinations are suppressed, never redirected. Synthetic reserved recipients are suppressed too. No jewellery domain is used. General sending requires an explicitly verified COURTSIDE identity and a deliberate production-mode change; see [EMAIL_READINESS.md](EMAIL_READINESS.md) for exact DNS, SMTP, environment and receipt checks. `node scripts/configure-email.mjs --vercel` only configures restricted test mode through private stdin; it cannot silently enable general delivery.

`SMS_ENABLED` is a reserved setting and does not enable the current implementation. SMS sending remains fail-closed even with credentials. Complete signed inbound opt-out handling, outbound consent rechecks and a verified provider test before implementing the sender. No phone numbers were purchased.

## Preseason private documents and evidence

The private upload/reviewer/deletion bridge and trusted Meta receipt writer require a **server-only** `SUPABASE_SERVICE_ROLE_KEY`; ordinary league APIs continue using the caller's JWT. Never place it in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or any browser variable. `CRON_SECRET` protects daily document retention. Both are stored privately in ignored `.env.local` and Vercel Secrets for this project.

On this authenticated Windows setup, `node scripts/configure-preseason.mjs --vercel` reads the existing project's key through the supported Supabase CLI, saves it privately and passes values to Vercel through stdin with redacted output. It refuses a different project or enabled Meta configuration. It does not call Meta. New deployments apply the variables. Run `node scripts/check-client-secrets.mjs` after building to check configured private values are absent from `.next/static`.

`vercel.json` configures a daily retention request; `CRON_SECRET` must remain set in production. Administrators can also run due cleanup for their own league. See [PRESEASON.md](PRESEASON.md) for file lifetimes, authorization and retention limits. The first scheduled invocation remains unverified until it occurs; direct handler deletion is integration-tested.

## Account access

Email/password signup and sign-in use Supabase Auth. This project currently requires email confirmation. No shared admin password or auth bypass is provided. Sign up with an account you own and confirm its email; then sign in and create a league or private demo. New league creators become administrators only of that new league. Existing users can be added by a league administrator as coach, scorekeeper or referee.

Supabase Authentication → URL Configuration uses `https://courtside-ai-matcpus-projects.vercel.app`. That origin, `https://courtside-ai-one.vercel.app`, `http://localhost:3000` and `http://127.0.0.1:3000` are explicitly allowed. The received confirmation link returned to the main live alias and produced a genuine confirmed session. No wildcard domains were added. SMTP is configured to the restricted Resend testing identity; arbitrary new-account confirmation delivery needs a dedicated verified domain before general judge signup can be promised.

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

Direct Vercel deployments work through the authenticated CLI. The latest app is public at [courtside-ai-one.vercel.app](https://courtside-ai-one.vercel.app). Connecting the repository for automatic Vercel Git deployments requires installing the Vercel GitHub app; the provider approval page is open for the owner. Choose **Only select repositories → matcpu/courtside-ai**, then review the requested write permissions. No access to other repositories was granted. This does not prevent manual deployment or source pushes. GitHub-hosted CI has passed for the pushed source.

## Diagnostics

`/api/health` reports database connectivity and whether Meta/email are configured. A configured flag is not evidence of a successful provider request. `/api/league?public=true` returns only the safe public directory. Consult STATUS.md for live test evidence and blockers.
