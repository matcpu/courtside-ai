# Preseason onboarding and age-document review

The dedicated **Preseason Onboarding** workspace reuses league membership, teams, roster commands, division approval, schedule generation and publication. It adds a real guardian-to-reviewer journey rather than relabeling the old birth-date check as document verification.

## Operating the journey

1. An administrator creates an ordinary season in Settings, then opens Preseason Onboarding. Set the opening date, cutoff, deadlines, registration status, roster limits and retention period. Configure each category/tier's minimum and maximum ages. New ordinary seasons enforce readiness by default. Existing historical/demo seasons remain explicitly labeled legacy mode; enabling the new policy does not fabricate document approvals.
2. Invite an existing coach account through Settings. For registration by new members without an invitation, enable the existing public league site as well as opening registration. Private leagues remain restricted to invited coaches.
3. The coach completes the expanded assessment, saves/resumes drafts and submits it. The deterministic rubric uses record, margins, continuity, experience and practices; its explanation, confidence and inconsistency flags remain visible. An administrator approves the recommendation or records a meaningful override reason. Meta interpretation is a separate, clearly labeled recommendation and is currently paused.
4. Coaches add players and submit an active roster meeting the configured size. Coaches cannot provide the guardian's verification consent or mark a proof approved. A roster change requires resubmission.
5. Create a guardian invitation for each player. Share the private link directly, or request email if Resend is configured. The interface reports `not configured`, `suppressed`, `failed` or provider acceptance truthfully; copying the link works without email. Development recipients are synthetic `.invalid` addresses.
6. The guardian confirms the child's recorded details, supplies their name/relationship and explicit consent, and uploads a photo of an accepted proof. Incorrect child details must be corrected with the coach before submission. The portal shows pending, resubmission, rejected or approved status and the review reason.
7. An administrator opens the original, checks name/date/consent, investigates duplicate flags and records approve/reject/resubmission with a reason. Approval requires a recent document-open audit, an explicit inspection attestation and passing deterministic age bounds. Resubmission creates a new file; an older superseded proof cannot be approved.
8. Scheduling includes only ready teams and cannot start before opening weekend. PostgreSQL independently rechecks readiness and revision at draft/publication. A changed questionnaire, age rule, roster or consent can invalidate readiness or a pending draft. Guardian consent withdrawal blocks future publication immediately; it does not silently rewrite an already published schedule.

## Security boundaries

- Invitations use 32 random bytes in the URL fragment. Only SHA-256 hashes are stored. Links expire within 72 hours or at the verification deadline, whichever is sooner. Reissue/revoke invalidates prior portal sessions. Possession of a link is a one-player capability, not independent proof of the guardian's identity; identity/relationship are self-attested.
- The page removes the fragment and exchanges it for an HttpOnly, SameSite Strict cookie, Secure on HTTPS. Mutations require matching browser Origin/Host. Responses are private/no-store; the portal is noindex and uses no-referrer. Tokens and guardian information never enter browser local storage.
- `youth-documents` is private, with no client read/write policies. The server signs one unique upload path only after capability validation. Supabase upload signatures last two hours; revocation can block final submission even while a previously issued write signature remains valid. Reserved objects expire from the workflow after two hours and enter cleanup; successful submissions receive the configured retention period.
- Final submission verifies actual bytes, size, MIME/magic and SHA-256, then rechecks invitation, consent and state. It cannot be completed directly by an anonymous/browser RPC caller.
- Only league administrators obtain audited, 60-second read URLs. Coaches see roster/status metadata but cannot inspect proof bytes. Guardians can submit and see status, but cannot obtain document-download URLs.
- Ordinary league writes still use the caller's JWT and PostgreSQL authorization. The **server-only service-role credential is broad**; its application usage is confined to the guarded document signing/finalization/deletion bridge and trusted Meta evidence writer. It is never a client variable. Direct client access to the new tables is revoked and explicitly denied by RLS.
- Proofs, guardian details, dates of birth and youth roster fields are never provided to Meta tools or placement interpretation. No facial recognition is used. All tests and demos must use visibly synthetic records, never real children's documents.

## Retention and deletion

The administrator selects 1–30 days (default 14). Shortening the period also shortens existing deadlines. Unfinished uploads use a two-hour reservation period. Expired originals cannot receive fresh review URLs. An administrator can permanently delete an individual original or run due cleanup for their own league; the authenticated cron endpoint processes due/retry batches across leagues.

Vercel is configured for daily cleanup at `0 7 * * *` using `CRON_SECRET`. Scheduled delivery timing depends on Vercel; the handler is tested directly, while the first future daily trigger cannot be certified in advance. Failed removals retain a durable five-minute retry lease. A deletion receipt cannot be finalized while Storage metadata still contains the object. Tests use cache-busting reads to distinguish an origin deletion from a cached response. Previously issued reviewer links expire within 60 seconds.

Deletion removes stored bytes, document guardian-name/relationship fields and any retained invitation email. Minimal consent timestamps, hashes, eligibility decisions and review history remain. An approved eligibility decision can remain valid after its original is deleted under policy. Deletion cannot erase copies a recipient already saved outside the application.

## What verification means

This is **human document review**, tested using genuine uploaded synthetic image files. It is more than calculating age from a coach-entered date. It does not authenticate a government issuer, perform biometric matching, independently establish guardianship, detect every forged image, or provide a legal compliance certification. No real identity documents have been used to validate the system. Physical iOS/Safari capture and production-scale recovery still need separate verification.
