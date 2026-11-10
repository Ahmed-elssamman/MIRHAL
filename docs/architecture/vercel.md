# Vercel frontend deployments

The MIRHAL production target is **separate Vercel frontend projects + Render API + Neon + Resend**. Both Vercel projects use the repository root and Node 24.x. The `mirhal-web` project builds only the customer app with `npm run vercel:build:web`; `mirhal-admin` builds only the admin app with `npm run vercel:build:admin`. Each command writes a Build Output API v3 artifact to `.vercel/output` and routes API requests to Render. Set each project's Production Branch to `main`.

The customer project serves Angular's prerendered public pages and lazy client routes. The administration project serves only the admin frontend. Host-only HttpOnly cookies keep each application's session separate. Both origins must be explicitly allowed by the API.

The API, database access, rate limiting, and maintenance tasks run on Render. Vercel builds contain frontend assets only and do not require Prisma or API build artifacts.

## Project environment

Set the public HTTPS values `VERCEL_WEB_ORIGIN` and `VERCEL_API_ORIGIN` in the Production environment of both frontend projects. The admin project also requires `VERCEL_ADMIN_ORIGIN`. Do not add database credentials or API secrets to frontend projects. Never commit environment files.

## Manual packaging

For manual CLI releases, link local ignored directories to the two Vercel projects and run the existing packaging workflow:

```sh
mkdir -p .local/vercel/web .local/vercel/admin
vercel link --project YOUR_WEB_PROJECT --cwd .local/vercel/web --yes
vercel link --project YOUR_ADMIN_PROJECT --cwd .local/vercel/admin --yes
npm ci
npm run db:generate
npm run build
npm run vercel:package:render
vercel deploy --prebuilt --prod --yes --cwd .local/vercel/web
vercel deploy --prebuilt --prod --yes --cwd .local/vercel/admin
```

The app-specific Git build scripts avoid building the API and the other frontend. The all-project `npm run build` remains available to CI for full workspace validation. The legacy `vercel:configure` and Vercel-hosted API packaging path are not used for production.
