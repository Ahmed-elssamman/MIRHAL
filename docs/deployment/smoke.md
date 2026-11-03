# Production smoke test

Run this only after the reviewed Neon migrations, Render API, Resend domain, and both Vercel frontends are deployed. Use dedicated test accounts and inboxes. Record the date, deployed commit, exact public origins, and result of each check without recording passwords, cookies, tokens, database URLs, or API keys.

## Public routing and database

1. Open the Render API origin at `/api/health`, then open `/api/health` through both Vercel origins. Each should return HTTP 200 with `status: ok`. This endpoint checks the database and does not send mail.
2. Confirm that the customer `/api/health` route reaches the same Render release. Inspect the packaged Vercel route configuration if the responses disagree. Verify that no Vercel API function or maintenance cron was deployed by the Render packaging command.
3. From a trusted migration shell, run `npx prisma migrate status` with `DIRECT_URL` pointing to the reviewed Neon target. Do not run `migrate reset`, `db:migrate`, or schema push against production.
4. Open a public customer route, a private customer route after sign-in, and an admin route. Refresh each directly to check Vercel routing and asset loading. Inspect browser network errors and server logs for failures.

## CORS and sessions

1. In a real browser on the customer origin, register a dedicated test user. Confirm the `/api/auth/register` response sets `lq_session` with `HttpOnly`, `Secure`, `SameSite=Lax`, and path `/api`. Do not copy the cookie value into the test record.
2. Refresh, call `/api/auth/me` through the customer origin, sign out, and verify the session no longer works. Sign in again. Repeat sign-in and refresh on the admin origin with a dedicated staff account.
3. Send an `OPTIONS` preflight to the direct Render API using each configured Vercel origin and a write method; confirm the matching `Access-Control-Allow-Origin` and credentials response. Repeat with an unrelated origin; it must not be allowed. A write request with that unrelated Origin must return 403. Use test data and never send a session cookie with the unrelated-origin probe.
4. Test the customer and admin sites from two independent client networks. Check that normal actions do not share a 429 rate-limit bucket through the Vercel rewrite. Also test the direct Render origin. Record the observed client-address behavior before changing proxy trust.

## Email and language

1. In Resend, confirm the sending domain is verified and the configured `SMTP_FROM` belongs to it. Review SPF, DKIM, and DMARC results in the provider dashboard.
2. Register one Arabic test user and one English test user with real test inboxes. Confirm the selected language persists after sign-in and refresh. Verify each message's sender, subject, text, HTML direction (`ar`/RTL or `en`/LTR), and link origin. Open the verification link once; a second use must fail safely.
3. Request password recovery for each account. Confirm the public response remains generic, each email follows the persisted profile language, and the link resets the password once. Confirm old sessions are revoked. Request recovery for an unknown address and confirm the public response is the same; compare timing as part of the remaining enumeration review.
4. Confirm real delivery in the Resend dashboard and test inboxes. The staff email configuration health result alone does not prove delivery. Inspect classified failures without exposing recipient addresses or tokens in logs.

## Storage, localization, and operation

1. Upload a small feedback image as a test user, open it as its owner, and confirm an anonymous request is denied. After a planned Render restart or redeploy, confirm the file remains available from PostgreSQL. Remove test data afterward.
2. Check Arabic and English on the primary customer and admin routes at narrow and wide widths. Open dialogs, tables, charts, notifications, and settings, switch directions, refresh, and check for mixed labels, clipped content, and horizontal overflow. Review older custom content in the admin editor for missing Arabic fields.
3. Inspect Render startup and request logs for API, database, email, and CORS errors. Confirm logs do not contain credentials, cookies, reset links, verification tokens, or personal message content.
4. If Render Free is selected, allow an idle period and record cold-start impact. Free sleep is expected. Use an always-on instance if continuous availability or reliably timed maintenance is required.

`npm run vercel:verify` exercises many browser workflows and removes its temporary customer account, but it does not verify real Gmail/Resend delivery, all language states, DNS, proxy client identity, or persistence across a Render restart. It requires private `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` for the staff login. Do not run it against an unreviewed database.
