# Email provider

MIRHAL uses one `MailAdapter` for account verification, password recovery, password reset security notices, and email invitations for friends who are not registered yet. The adapter selects a provider from `EMAIL_PROVIDER`. The supported providers are `file` (local outbox), `smtp` (Nodemailer), and `resend` (Resend HTTP API). The existing `MAIL_MODE=disabled` switch disables these email workflows. Production does not allow `file`.

## Why Resend

Resend offers a direct HTTPS send API, a documented idempotency header, domain verification, and a small integration that needs no extra runtime package. This avoids SMTP connectivity on Render. The send endpoint and `Idempotency-Key` are documented by [Resend's send email API](https://resend.com/docs/api-reference/emails/send-email); checked 2026-10-04. Pricing, quotas, and regional availability are account dependent; check them in your account before choosing a plan. A verified domain and permission to edit its DNS are required for production sending.

## Configuration

| Environment       | Variables on the backend only                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local Gmail       | `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASSWORD` (Google App Password), `SMTP_FROM`, `APP_URL`             |
| Production Resend | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `SMTP_FROM` (verified sender, for example `MIRHAL <no-reply@example.com>`), `APP_URL` (public web origin), optional `SUPPORT_EMAIL` |
| Local file outbox | `EMAIL_PROVIDER=file`; messages go to private `.local/mail`                                                                                                                    |

Set `MAIL_MODE=development` locally or `MAIL_MODE=production` on Render. Use `MAIL_MODE=disabled` only to explicitly disable email. The Render Blueprint now uses the accepted `production` value; `enabled` was not a valid value for the validated environment schema. `SMTP_FROM` is the sender variable for both providers and should contain the display name and verified address. `SUPPORT_EMAIL` is optional; without it, email links to the existing help page. Only Resend uses `RESEND_API_KEY`. Never configure these variables in Vercel browser build settings.

The staff-only `/api/admin/health` response reports the selected provider and whether its required configuration is present. It does not send mail, test delivery, return credentials, or make the public `/api/health` depend on email. A `configured` result does not prove that Gmail or Resend accepts the credentials; verify real delivery separately.

## Templates and behavior

Verification, password reset, password-reset security notices, and friend invitations have Arabic and English HTML/text versions and share a table-based branded layout. Language comes from the persisted profile, falling back to Arabic. Arabic uses `lang=ar` and `dir=rtl`; English uses `lang=en` and `dir=ltr`; token URLs remain LTR. The security notice contains no token and is attempted after the password update commits; a delivery failure cannot roll back the reset. New-account friend invitations require a verified sender and are limited to three requests per minute. They use Resend idempotency keys for same-day duplicate requests. The template uses MIRHAL's teal and green theme tokens and the public PNG mark at `APP_URL/mirhal-email-logo.png`. A Chromium layout test checks both directions at 320 px without horizontal overflow; real inbox clients still need the live smoke check. Each provider request has a 10 second timeout. HTTP 429 and 5xx are classified as temporary; other non-success HTTP responses are permanent. Logs contain provider, purpose, status, and classification, without address, token, or provider response. Resend receives a stable SHA-256 idempotency key for each event, allowing one bounded retry with the same request after a network error or HTTP 5xx. HTTP 429 is not retried immediately; the caller can try again later. SMTP is never retried automatically because an ambiguous delivery failure could produce duplicate mail. Existing endpoint throttles limit requests. In addition, each account can issue at most five tokens per hour for each purpose. The count is stored in PostgreSQL and checked under a user-row lock, so concurrent API instances cannot bypass it. A recovery request over this budget still receives the generic account-existence response and does not send mail.

## Account and DNS steps

1. Create a Resend account and verify ownership of a domain.
2. Add the exact SPF/DKIM DNS records Resend displays for that domain. Add DMARC according to the domain owner's policy. Wait for Resend to report verification.
3. Create a production API key with sending permission. Put it in **Render** as `RESEND_API_KEY`.
4. Set `SMTP_FROM` in Render to an address on the verified domain and `EMAIL_PROVIDER=resend`.
5. Use a non-production test account to request verification and recovery in Arabic and English. Check sender, subject, direction, URLs, and delivery in the provider dashboard. Do not put tokens in logs or screenshots.

For local Gmail, enable two-step verification, create a Google App Password, and set it only in local `.env` as `SMTP_PASSWORD`. Do not use the normal Google account password.

## Recovery

If Resend delivery fails, inspect the classified backend log and provider dashboard. Correct DNS, sender, key, or account restrictions, then use the existing resend verification or forgot password endpoint to issue a fresh token. During an outage, `MAIL_MODE=disabled` explicitly exposes email as unavailable; do not claim a queued or delivered message. No in-memory queue is used.

Verification, reset, and password-reset security notice emails exist. Welcome, challenge, reward, and general notification emails are not implemented in the existing application, so no unrelated notification flows were invented.
