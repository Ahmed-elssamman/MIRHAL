import { spawnSync } from 'node:child_process';

// These high advisories are confined to development tools in the pinned lockfile.
// npm currently offers only incompatible major downgrades for their roots.
const knownPackages = new Set([
  '@angular/cli',
  '@angular/platform-server',
  '@angular/router',
  '@modelcontextprotocol/sdk',
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
  'follow-redirects',
  'globby',
  'http-proxy-middleware',
  'launch-editor',
  'micromatch',
  'multer',
  'node-forge',
  'nodemailer',
  'nx',
  'qs',
  'selfsigned',
  'shell-quote',
  'source-map-js',
  'ts-checker-rspack-plugin',
  'tsc-alias',
  'undici',
  'vite',
  'webpack-dev-server',
  'zod',
]);
const knownAdvisories = new Set([
  'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
  'https://github.com/advisories/GHSA-w739-gvwx-grc3',
  'https://github.com/advisories/GHSA-62vg-58rm-qff7',
  'https://github.com/advisories/GHSA-57xq-rjx2-v5xh',
  'https://github.com/advisories/GHSA-6qxp-vccf-f47h',
  'https://github.com/advisories/GHSA-22jm-h49p-29qw',
  'https://github.com/advisories/GHSA-46jr-4wx8-v453',
  'https://github.com/advisories/GHSA-rvq5-wwqv-78pq',
  'https://github.com/advisories/GHSA-f897-62hf-6gxq',
  'https://github.com/advisories/GHSA-6prh-2h8m-c8cw',
  'https://github.com/advisories/GHSA-27r3-jxmh-p828',
  'https://github.com/advisories/GHSA-q3jh-wrc6-jgq8',
  'https://github.com/advisories/GHSA-8r9p-f939-6h3c',
  'https://github.com/advisories/GHSA-mrwp-f3q8-3g9p',
  'https://github.com/advisories/GHSA-698v-4r3x-3vcv',
  'https://github.com/advisories/GHSA-r825-w8mm-5pxw',
  'https://github.com/advisories/GHSA-587h-7wmj-h5pm',
  'https://github.com/advisories/GHSA-q7qp-rjg7-q26m',
  'https://github.com/advisories/GHSA-4642-5mcj-2rqw',
  'https://github.com/advisories/GHSA-6wvx-3r32-xmcg',
  'https://github.com/advisories/GHSA-525v-9gp9-w22h',
  'https://github.com/advisories/GHSA-7wch-p9px-956x',
  'https://github.com/advisories/GHSA-h6cr-wjv9-3cpp',
  'https://github.com/advisories/GHSA-4487-j8r4-4g2f',
  'https://github.com/advisories/GHSA-5cwg-6vw7-rj6p',
  'https://github.com/advisories/GHSA-jc66-7q78-782g',
  'https://github.com/advisories/GHSA-8hrf-8g6f-7xwp',
  'https://github.com/advisories/GHSA-hqq3-7jhf-c5jx',
  'https://github.com/advisories/GHSA-5x38-2vff-x55p',
  'https://github.com/advisories/GHSA-pqg4-j6r4-53mv',
  'https://github.com/advisories/GHSA-68fv-2mgg-jv7q',
  'https://github.com/advisories/GHSA-4qv8-2p9j-2685',
  'https://github.com/advisories/GHSA-f72v-6w45-q472',
  'https://github.com/advisories/GHSA-xjj6-f33q-929c',
  'https://github.com/advisories/GHSA-4w7w-5xrc-9h26',
  'https://github.com/advisories/GHSA-2m5v-pch6-74hx',
  'https://github.com/advisories/GHSA-qrxm-fqhp-jwvm',
  'https://github.com/advisories/GHSA-9fm3-97px-rjf6',
  'https://github.com/advisories/GHSA-55wc-3pg8-jfw6',
  'https://github.com/advisories/GHSA-9jrq-w75r-8gcw',
  'https://github.com/advisories/GHSA-rq7h-c2jc-7f22',
  'https://github.com/advisories/GHSA-vfpm-58rq-9qcg',
  'https://github.com/advisories/GHSA-8c8m-p3m8-cjg8',
  'https://github.com/advisories/GHSA-m943-m63m-w62w',
  'https://github.com/advisories/GHSA-85x2-q946-cp5h',
  'https://github.com/advisories/GHSA-4ffr-jq9g-5ffx',
  'https://github.com/advisories/GHSA-g73g-hqqh-jr95',
  'https://github.com/advisories/GHSA-6pq8-jhm2-2vcw',
  'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5',
  'https://github.com/advisories/GHSA-3g3m-2fjr-6pw4',
  'https://github.com/advisories/GHSA-g3hv-75wg-m249',
  'https://github.com/advisories/GHSA-r4xh-jqrq-34v2',
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
if (unexpected.length) {
  console.error('Unexpected high or critical dependency advisories:', unexpected.join(', '));
  process.exitCode = 1;
} else {
  console.log(
    `Full audit: ${elevated.length} known high development-tool advisories; no new high or critical advisories.`,
  );
}
