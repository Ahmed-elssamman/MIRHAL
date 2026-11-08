import { spawnSync } from 'node:child_process';

// These high advisories are confined to development tools in the pinned lockfile.
// npm currently offers only incompatible major downgrades for their roots.
const knownPackages = new Set([
  '@angular/platform-server',
  '@angular/router',
  '@nestjs/platform-express',
  '@nx/angular',
  '@nx/module-federation',
  '@nx/rspack',
  '@nx/web',
  '@nx/webpack',
  '@rspack/dev-server',
  'body-parser',
  'braces',
  'chokidar',
  'fast-glob',
  'globby',
  'http-proxy-middleware',
  'micromatch',
  'multer',
  'node-forge',
  'nodemailer',
  'qs',
  'selfsigned',
  'ts-checker-rspack-plugin',
  'tsc-alias',
  'webpack-dev-server',
  'zod',
]);
const knownAdvisories = new Set([
  'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
  'https://github.com/advisories/GHSA-w739-gvwx-grc3',
  'https://github.com/advisories/GHSA-62vg-58rm-qff7',
  'https://github.com/advisories/GHSA-57xq-rjx2-v5xh',
  'https://github.com/advisories/GHSA-27r3-jxmh-p828',
  'https://github.com/advisories/GHSA-q7qp-rjg7-q26m',
  'https://github.com/advisories/GHSA-8c8m-p3m8-cjg8',
  'https://github.com/advisories/GHSA-m943-m63m-w62w',
  'https://github.com/advisories/GHSA-85x2-q946-cp5h',
  'https://github.com/advisories/GHSA-4ffr-jq9g-5ffx',
  'https://github.com/advisories/GHSA-g73g-hqqh-jr95',
  'https://github.com/advisories/GHSA-6pq8-jhm2-2vcw',
  'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5',
]);

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  timeout: 90000,
  maxBuffer: 10 * 1024 * 1024,
});
if (result.error || (result.status !== 0 && result.status !== 1))
  throw new Error('Full dependency audit could not be completed.');

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  throw new Error('Full dependency audit returned invalid JSON.');
}
if (report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities)
  throw new Error('Full dependency audit did not return vulnerability data.');

function advisoryUrls(name, visited = new Set()) {
  if (visited.has(name)) return [];
  visited.add(name);
  const vulnerability = report.vulnerabilities[name];
  if (!vulnerability) return [];
  return vulnerability.via.flatMap((item) =>
    typeof item === 'string'
      ? advisoryUrls(item, visited)
      : typeof item.url === 'string'
        ? [item.url]
        : [],
  );
}

const elevated = Object.entries(report.vulnerabilities).filter(([, vulnerability]) =>
  ['high', 'critical'].includes(vulnerability.severity),
);
const unexpected = elevated
  .filter(([name]) => {
    const urls = advisoryUrls(name);
    return (
      !knownPackages.has(name) || !urls.length || urls.some((url) => !knownAdvisories.has(url))
    );
  })
  .map(([name]) => name);
if (report.metadata.vulnerabilities.critical || unexpected.length) {
  console.error('Unexpected high or critical dependency advisories:', unexpected.join(', '));
  process.exitCode = 1;
} else {
  console.log(
    `Full audit: ${elevated.length} known high development-tool advisories; no new high or critical advisories. Production dependencies are checked separately.`,
  );
}
