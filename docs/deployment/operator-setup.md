# Operator setup for the MIRHAL production cutover

The GitHub branch `feat/mirhal-migration` contains the tested deployment code. The owner confirmed the existing `lifequest-web` and `lifequest-admin` Vercel projects and the Neon production database. Neon migrations are already applied; do not rerun seed or reset. The remaining account-owned work is Render, Resend, DNS, and final Vercel routing.

## 1. Verify a Resend sending domain

1. Sign in to Resend, open **Domains**, and choose **Add Domain**. Choose a domain or subdomain you own. Resend recommends a sending subdomain; choose one appropriate for MIRHAL.
2. At the domain's **Records** tab, copy the exact DNS records Resend provides into the domain's DNS provider. The records may include DKIM and SPF TXT, MX, or CNAME entries; use the values shown for this specific domain. Add DMARC according to the domain owner's policy. Do not proxy a verification CNAME through a CDN.
3. Wait until Resend reports the domain verified. Create an API key with sending permission, scoped to the sending domain if available. Copy the key directly into Render's private environment setting `RESEND_API_KEY`; the token may be shown only once. Do not put it in Git, Vercel, or chat.
4. Choose `SMTP_FROM` as a sender on that exact verified domain, such as `MIRHAL <no-reply@<verified-domain>>`. This existing variable name is used by both the SMTP and Resend providers.

These dashboard and DNS steps follow [Resend's domain guide](https://resend.com/docs/dashboard/domains/introduction). Resend account limits and pricing must be checked in that account; this guide does not assume a quota.

## 2. Create the Render API service

1. In the Render Dashboard, use **New → Blueprint**, connect the `Ahmed-elssamman/LifeQuest` GitHub repository, and select the intended deployment branch. For review before merging PR #1, select `feat/mirhal-migration`. The root [render.yaml](../../render.yaml) defines a Node web service named `mirhal-api`, its build/start commands, and `/api/health` check. Review the plan and any charges before applying the Blueprint.
2. Render prompts for `sync: false` variables. Fill them as follows in **Dashboard → mirhal-api → Environment**. Use the confirmed Neon connection details privately; never put them into the frontend projects.

   | Variable                | Render value                                     |
   | ----------------------- | ------------------------------------------------ |
   | `DATABASE_URL`          | Confirmed Neon **pooled** PostgreSQL URL         |
   | `DIRECT_URL`            | Same database's **direct** PostgreSQL URL        |
   | `WEB_ORIGIN`            | `https://lifequest-web-cyan.vercel.app`          |
   | `ADMIN_ORIGIN`          | `https://lifequest-admin.vercel.app`             |
   | `APP_URL`               | `https://lifequest-web-cyan.vercel.app`          |
   | `RESEND_API_KEY`        | Private sending key from Resend                  |
   | `SMTP_FROM`             | Sender on the verified Resend domain             |

   The Blueprint sets `NODE_ENV=production`, `EMAIL_PROVIDER=resend`, and `MAIL_MODE=production`. Configure the Resend key and verified sender in Render before expecting auth emails; optionally set `SUPPORT_EMAIL` for the email footer. Render supplies `PORT`. MIRHAL uses opaque database sessions, so no JWT secret is required. Feedback attachment bytes are stored in PostgreSQL using the existing database connection; no Blob token or attached disk is required by the Render API.

3. Deploy the Blueprint. Record only the public Render HTTPS service URL. Open `<render-origin>/api/health` and confirm HTTP 200 with `status: ok`. The health endpoint checks PostgreSQL without sending an email. Inspect Render logs if startup fails; the application reports missing variable names without printing their values.

Render's [Blueprint specification](https://render.com/docs/blueprint-spec) confirms that `sync: false` prompts for private values during creation. The configured Free plan may sleep when idle; use a non-sleeping instance if continuous availability or reliably timed maintenance is required. No keep-alive traffic is configured.

## 3. Route the confirmed Vercel projects to Render

1. In a trusted packaging shell or ignored local `.env`, set `VERCEL_WEB_ORIGIN=https://lifequest-web-cyan.vercel.app`, `VERCEL_ADMIN_ORIGIN=https://lifequest-admin.vercel.app`, and `VERCEL_API_ORIGIN=<actual Render HTTPS origin>`. Do not include trailing slashes. These are public routing values, not browser secrets.
2. Run `npm run vercel:package:render`. Inspect `.local/vercel/web/.vercel/output/config.json`: customer `/api/*` must route to Render, admin `/api/*` through the customer origin, and there must be no customer API function or cron. A Vercel preview can check static assets and route behavior before the production deploy commands in the [deployment guide](README.md). The preview origin is not in Render's production CORS allowlist, so authenticate and test cookies on the confirmed production aliases after cutover.
3. After both production frontends and the Render API pass the [live smoke test](smoke.md), remove legacy `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `CRON_SECRET` from the **customer Vercel project's** environment. Do not remove these variables while the old Vercel API is still serving users.

Do not run `npm run vercel:configure` for this cutover; it configures the previous Vercel API function and disables email. Do not merge PR #1 until the release branch and any Vercel Git auto-deploy behavior are reviewed. The code change does not require a database reset or a new seed run.
