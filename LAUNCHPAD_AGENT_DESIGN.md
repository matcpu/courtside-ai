# Bounded Launchpad agent extension — design only

No new model tool is registered or dispatched by this branch. Existing Meta operations tools, credit checks, original evidence and human approvals remain unchanged. Current naming ideas/social copy use deterministic templates and say so in the UI.

Proposed tools for a later, explicitly authorized Muse run:

| Tool | Bounded input and actual output | Boundary |
|---|---|---|
| `inspect_launch_readiness` | One authorized league ID; public identity status, configured divisions, invitation counts, registration state, merged confirmed slots and readiness blockers | Read-only; no youth names, DOB, guardian fields or document context |
| `suggest_league_identity` | Public name/city and stated style, capped at 3 alternatives | Suggestions only; no uniqueness/ownership claim |
| `investigate_domain_registration` | One normalized `.com` name; one fixed-host official RDAP request with 6-second timeout | Timestamp/status and observed registration only; 404 never implies purchase availability; no retries or registrar transaction |
| `find_possible_name_conflicts` | Public name/region; approved structured search provider required first | Currently manual official-directory/trademark checks; never fabricate a completed search |
| `prepare_website_draft` | Publicly permitted facts plus bounded copy/theme fields; revision-checked draft save | No publication tool; administrator reviews the logo/copy and separately approves publication |
| `prepare_social_kit` | Approved public facts; bio, description, 3 post drafts and registration-state-aware copy | Never checks handles by scraping, creates accounts or posts; future OAuth scopes and owner approval required |

A later orchestrator should allow at most four reasoning turns and one domain lookup, with no provider built-ins or automatic paid retries. All mutation tools must check the actor and tenant in PostgreSQL, record safe tool outcomes/audit IDs and reject stale revisions. Outputs must distinguish suggested, observed and human-approved states. Domain purchases, DNS, social account actions, messages, website publication, schedule publication, results and eligibility remain unavailable as tools.

Before enabling a live run: require the existing valid credit observation/budget reservation, explicit owner authorization and confirmation that only public/synthetic context is supplied. Capture genuine provider responses/tool selections/results through the established Meta evidence pipeline. This design document is not evidence of a model run.
