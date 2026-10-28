# Restricted email readiness

The current sender is `COURTSIDE AI Test <onboarding@resend.dev>`. A dedicated sending-only credential is saved privately in the project and Vercel Secrets. No jewellery domain is used, no domain was purchased and no paid plan or overage was enabled. The connected account's free quota was checked before the small controlled test.

## Restrictions

`NOTIFICATIONS_ENABLED=true` permits dispatch only when the rest of the configuration is valid. `EMAIL_DELIVERY_MODE=test` additionally requires the Resend testing sender and exactly one private `EMAIL_TEST_RECIPIENT`. Any other real address is **suppressed**, never redirected to the test inbox. Synthetic reserved recipients are suppressed too. No public response or client bundle exposes the allowed address or sending key.

Resend allows its testing sender only for its registered account address. This account uses a dotted Gmail spelling of the authorized inbox; [Gmail treats dotted and undotted personal Gmail addresses as the same inbox](https://support.google.com/mail/answer/7436150?hl=en). The application uses the exact registered spelling, rather than broad Gmail normalization or a recipient wildcard. See [Resend's testing restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Supabase confirmation remains enabled. Its SMTP configuration uses `smtp.resend.com`, port `465`, username `resend`, the dedicated private sending credential, sender address `onboarding@resend.dev` and sender name `COURTSIDE AI Test`. The stable live alias was added to the existing redirect allowlist without removing the previous allowed origins or changing MFA/confirmation settings. General signup email therefore remains limited by Resend's testing-recipient restriction. The signup screen discloses that limitation; do not promise arbitrary judge registration until a dedicated domain is verified.

## Evidence and retry semantics

- The smoke-test message was opened in the authorized Gmail Inbox; sender, subject and full expected body matched.
- Normal UI signup sent a genuine confirmation email through Resend. The received link was followed and returned a confirmed signed-in session. No Auth Admin confirmation bypass was used for this test.
- A real private synthetic schedule publication queued a coach email. A **controlled pre-send network fault** persisted a failed attempt and due time in the actual outbox. After the normal backoff, the production notification endpoint obtained real Resend acceptance; the message was opened in Gmail Inbox. Re-dispatch preserved the same provider ID and attempt count and sent no duplicate. This does not claim Resend had an actual outage.
- The guardian-invitation workflow sent to the same authorized inbox. Resend reported delivery and Gmail receipt was observed, **in Spam**. The replacement received link was matched against the issued invitation and opened the correct fictional child's secure portal. This is not a clean general-deliverability pass. The synthetic capability exposed by an initial mailbox preview was revoked; tested replacement capabilities were also revoked afterward and denial was verified. A fresh link exists only in the private judge packet. No real child's document or identity was involved.
- The full workflow reports and message identifiers remain private in `.local/email-readiness.json`; mailbox contents and capabilities are not committed or included in public submission materials.

Dispatch claims at most three external messages, so three 15-second provider timeouts leave time for durable receipts within the 60-second route budget. The outbox retains leases, attempt counts, exponential next-attempt timing and event-based idempotency. Provider acceptance and mailbox receipt are distinct. The application records acceptance; the readiness report separately records inspected Gmail receipt. No background retry worker or signed delivery webhook is claimed. Administrative retry is exercised; unconfigured SMS remains disabled.

## Reproduce controlled checks

Only run with an already authorized inbox and its private environment configuration. Do not change the recipient to an actual coach or parent.

```sh
node scripts/email-smoke.mjs --send-authorized-test
# Inspect the actual Gmail message before marking its private receipt evidence.
node --import tsx scripts/email-workflows.mjs --prepare-retry --guardian-invitation
# After the recorded due time:
node --import tsx scripts/email-workflows.mjs --retry
```

These commands refuse duplicate accepted smoke tests or invitation tests. Rehearsals use isolated synthetic leagues; they do not modify the public reference. Scripts never infer mailbox receipt from provider acceptance. A fresh normal signup must use an authorized, unused controlled address; do not delete or overwrite an existing account to force a rerun.

## Exact steps before general production delivery

1. Supply a domain already controlled by the COURTSIDE owner; purchasing a domain or reusing an unrelated business domain is not authorized. Prefer a dedicated transactional subdomain such as `notify.<owned-courtside-domain>`.
2. Add that sending domain in Resend, choose its intended region and copy the **exact provider-issued** DNS records. Publish its DKIM TXT record and the sending/return-path SPF TXT and MX records at the DNS host. Do not invent a DKIM value, add multiple SPF policies to one hostname, or replace an existing mailbox's inbound MX records. Add a suitable DMARC policy for the new sender according to the owner's domain setup.
3. Run domain verification and wait for sending verification to succeed. Check DNS authentication with the provider. Domain-specific record names/values cannot be known before the domain is supplied and Resend issues them. [Official domain steps](https://resend.com/docs/dashboard/domains/introduction).
4. Create a new sending-only API key restricted to the verified domain, store it privately as `RESEND_API_KEY`, and set `RESEND_FROM=COURTSIDE AI <notifications@notify.<owned-courtside-domain>>`. Configure a monitored reply/support address if replies are intended.
5. Update this project's Supabase SMTP sender and credential to that same verified identity. Preserve confirmation requirements, rate limits, MFA and the exact live redirect allowlist. [Official Supabase SMTP integration](https://resend.com/docs/send-with-supabase-smtp).
6. With the owner's authorization, switch the intended environment to `EMAIL_DELIVERY_MODE=production` and keep `NOTIFICATIONS_ENABLED=true`; redeploy. Test only the controlled inbox first: signup, confirmation redirect, guardian invitation, schedule notification, retry and duplicate prevention. Verify actual Inbox placement and authentication headers. Check spam placement rather than treating a provider ID as successful receipt.
7. Before opening general sending, configure monitored bounce/complaint handling, signed delivery-event processing and the operational retry plan. Respect Resend suppression and free/paid quotas. Keep SMS and Meta inference independently disabled unless separately authorized.

The existing setup helper deliberately configures **test mode only**. It does not verify a domain, purchase anything or silently enable general production delivery.
