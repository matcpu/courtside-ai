# Judge walkthrough

Open [the working public demonstration](https://courtside-ai-one.vercel.app/league/northstar-demo). No account or email signup is needed. All displayed league records are fictional.

1. From Overview, choose **View schedule** to inspect published fixtures and confirmed courts.
2. Open **Teams & rosters**, search for **Eastside**, then inspect **Standings**. Only confirmed results count; youth identities/documents and coach contact details are excluded from public views.
3. Open **Meta AI activity** to see the three integrated jobs and the current paused status. Genuine provider evidence now exists and is private to authorized administrators. No mocked response is represented as a model result.

## Private roles without email signup

The representative has a private access packet at `.local/judge-access.md`. It contains separate, preprovisioned synthetic administrator and coach accounts and the current expiring guardian invitation. Credentials are never published in this guide, the source repository, the submission description or the video. The official form has no private-credentials field; the representative must arrange an organizer-approved secure handoff if judges need private access. The signed-out demo and final public video remain the primary public artifacts.

Both accounts use normal password sign-in. They have roles in exactly two isolated, wholly synthetic seasons, separate from the earlier controlled-email test tenant:

- **Upcoming season:** the coach can inspect the saved comprehensive assessment, roster progress and scheduling blockers. The administrator can review placement and synthetic proof decisions. The guardian invitation opens one fictional child's mobile form, never the administrator workspace.
- **Historical operations season:** inspect the original 78–43 sheet, actual vision/agent receipts, owner-approved Eastside/Riverside moves and revised schedule v3 awaiting publication review. Expand the final original agent answer to see the canonical-record warning for its Riverside/Parkdale name mistake. The coach sees their own games and any already-published in-app updates; unpublished v3 produces no publication notice. Historical seeds are fictional legacy inputs, not document-verified results.

Questionnaire/roster/verification deadlines extend through November 10, 2026, after the November 5–8 judging window. The opening weekend is November 14. Guardian invitations deliberately expire after at most 72 hours; issue a fresh link without email immediately before a private walkthrough and regenerate the private packet. Refresh again if the judging window extends past its expiry.

For the pending fictional sample, run `node scripts/refresh-judge-invitation.mjs` then `node scripts/judge-packet.mjs`; these commands send no email. If that player has already been approved, preserve the review history and use a separate pending fictional player through the normal coach flow rather than resetting an approved decision merely for footage.

## Temporary access lifecycle

These are temporary-use accounts, **not accounts with an automatically expiring password**. The representative should retire them after judging/finals: ban new sign-ins with supported Auth Admin controls, revoke refresh sessions and remove their two league memberships to end existing tenant access immediately. Existing access tokens can outlive a sign-out; do not rely only on closing a browser. Keep synthetic audit records needed for reproducibility. No real users or unrelated tenants should be changed.

The latest desktop/mobile check signs in using these exact credentials, verifies only the two expected memberships, denies privileged reads of the original public reference, checks the coach/admin boundary and opens the guardian form in a separate context. No unrestricted email registration is necessary. The test does not call Meta or send email.
