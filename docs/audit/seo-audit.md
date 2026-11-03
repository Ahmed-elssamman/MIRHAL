# MIRHAL SEO and public-page audit

## Scope and baseline

Inspected the checkout on branch `feat-/-make-mobile-view-by-PWA` at `bc53fd4b298491caec1e8ede8a369c81eee2bbe4`. The worktree was clean before this change. The app is Angular 21 in an Nx workspace, uses Angular SSR/prerendering, and has public landing and help routes. Private customer features are client-rendered behind application guards. English and Arabic share the same URL and are selected from browser preferences; there are no stable per-language URLs.

The private packaging configuration supplies the trusted public origin `https://mirhal-web.vercel.app`. The older documented alias `https://lifequest-web-cyan.vercel.app` returned Vercel `DEPLOYMENT_NOT_FOUND` during this audit. Requests to the configured origin returned:

| Request           | Observed result              |
| ----------------- | ---------------------------- |
| `/`               | 200 HTML with prerendered H1 |
| `/help`           | 200 HTML with prerendered H1 |
| `/robots.txt`     | 404                          |
| `/sitemap.xml`    | 404                          |
| `/does-not-exist` | 200 generic client shell     |

Both public pages returned the same landing title and description. The static document starts Arabic/RTL; preference-driven English metadata is only available after hydration because language is not represented in the URL. There was no canonical, social metadata, sitemap, or robots policy in the served pages. No analytics integration was found in the customer app source.

## Indexing policy

- Index `/` and `/help`, the two substantive public pages.
- Exclude authentication, onboarding, and authenticated application routes through `noindex,nofollow`. Existing authentication and authorization remain the privacy boundary.
- Do not include redirect aliases or private routes in the sitemap.
- Unknown paths render a localized not-found view; packaged Vercel routing returns a 404 status.
- English and Arabic currently do not have distinct URLs, so `hreflang` alternates are not valid and are omitted.

## Implementation

The Angular app now sets route-specific title, description, social metadata, language/direction, and robots directives. Canonical links and `og:url` are added to prerendered public HTML by the Vercel packager using its validated HTTPS `VERCEL_WEB_ORIGIN`. The packager also emits a sitemap containing only `/` and `/help`, plus a permissive robots file referencing that sitemap. Vercel routing sends known private routes to the client shell and unknown routes to the same shell with HTTP 404.

## Limits and owner actions

- Canonical and crawl files are produced by the Vercel packaging path. They need an artifact build and deployment before the live site changes.
- Search Console ownership, sitemap submission, Analytics configuration, and external indexing remain unverified. No GA4 or GTM ID is configured in the app.
- No Lighthouse, field Core Web Vitals, visual browser audit, or full accessibility audit was run as part of this source audit. The build and SSR regression checks are reported with the implementation.
- Language-specific indexing requires a product decision to provide stable localized URLs; browser-only language preferences cannot support reliable `hreflang`.

## Verification

- `npm run db:generate`, `npm run typecheck`, and `npm run build` passed. Prisma Client generation used the checked-in schema only; no database was queried or changed.
- `npm test` passed (49 tests); `npm run test:frontend` passed (36 tests); `npm run test:seo` passed (3 tests); `npm run test:ssr` passed; `npm run lint` and `npm run security:check` passed.
- `npm run vercel:package:render` completed locally. The generated web artifact was inspected for unique canonical URLs, public-only sitemap entries, the robots sitemap reference, noindex client-shell routing, and the unknown-path 404 rule. It was not deployed.
- The web build reports a 586.55 kB initial bundle, 26.55 kB above the existing 560 kB warning budget and below the 800 kB error budget. This is a local production-build measurement, not field performance data.
- Browser E2E and API performance scripts were not run: their configured scripts overwrite pre-existing `.local/e2e-credentials.json`, `.local/e2e-uploads/`, or `.local/audit/api-performance.json` and the E2E script truncates its local fixture database. Those existing artifacts were preserved.
- `git diff --check` passed. The live production endpoints were not rechecked after packaging because no deployment was performed.
