# Supported Angular 21 and PrimeNG 21 pairing

Updated 28 September 2026; supersedes the earlier Angular peer override decision.

The requested Angular 21 / PrimeNG 19 pairing is outside PrimeNG 19's declared Angular 19 peer range. Runtime success cannot make unsupported peers production-safe. Preserve Angular 21 and the existing PrimeNG/Tailwind design system, and upgrade PrimeNG to the compatible major rather than overriding its Angular constraints.

The lockfile now selects Angular 21.2.24, CDK 21.2.14, PrimeNG 21.1.10 and `@primeuix/themes` 2.0.3. PrimeNG declares Angular/CDK 21 peers and RxJS 7.8.1+, satisfied by this workspace. Angular compiler-cli accepts TypeScript >=5.9 <6.1; the workspace remains on TypeScript 5.9. Nx stays within major 22, Prisma/client within 6.19.3, Tailwind within 4, and Vitest within 4. Node 24.21.0 is pinned for local development, CI, and Render; Vercel is pinned to its supported 24.x runtime.

All PrimeNG Angular peer overrides were removed. The deprecated `@primeng/themes` package was replaced by PrimeUIX; unused theme presets and Angular animation providers/dependency were removed. Used dialogs, confirmations, drawers, toasts and tables run through production builds and browser tests. Datatable tokens load only in admin. The existing `AccessibleTable` directive still names/focuses table scroll regions. These changes preserve the product design and app boundaries.

A clean `npm ci --no-fund` and `npm ls --all` validate the lockfile and peer resolution, without `--force` or `--legacy-peer-deps`. Explicit `yaml` 2.9.0 and `magicast` 0.3.5 development dependencies satisfy the Nx/Angular build tooling's optional peers, which previously resolved invalid versions. Unused Nest testing and Angular animation dependencies were removed.

Prisma 6.19 uses schema-level runtime `DATABASE_URL` and migration `DIRECT_URL`. PostgreSQL migrations remain authoritative. Isolated integration tests require a local database ending in `_test`.

Narrow transitive security overrides for archive/TOML/UUID/brace-expansion utilities and Prisma CLI's merge utility remain. They do not bypass Angular compatibility. Revisit them when upstream dependencies resolve the advisories. `npm audit` and dependency-tree validation are CI gates. See [the final audit](../audit/final-audit.md) for measured results and remaining operational limits.
