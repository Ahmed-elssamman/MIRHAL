import { cp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { nodeFileTrace } from '@vercel/nft';
import { config } from 'dotenv';
import {
  addPublicSeo,
  customerRoutes,
  notFoundRoute,
  robotsTxt,
  sitemapXml,
} from './seo-assets.mjs';
config({ quiet: true });

const root = process.cwd();
const renderDeployment = process.argv.includes('--render');
function httpsOrigin(name, required = true) {
  const value = process.env[name];
  if (!value && !required) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.origin === value && !url.username && !url.password)
      return value;
  } catch {
    // Report only the variable name; a URL may contain credentials.
  }
  throw new Error(`${name} must be an HTTPS origin without a path, query, or credentials.`);
}
const origin = httpsOrigin('VERCEL_WEB_ORIGIN');
const apiOrigin = httpsOrigin('VERCEL_API_ORIGIN', renderDeployment);
if (renderDeployment) httpsOrigin('VERCEL_ADMIN_ORIGIN');
const writeJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2));
const headerRoutes = [
  {
    src: '/(.*)',
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
    continue: true,
  },
  {
    src: '/(.*[-][A-Z0-9]{8}\\.(?:js|css))',
    headers: { 'Cache-Control': 'public,max-age=31536000,immutable' },
    continue: true,
  },
  {
    src: '/(.*\\.html|ngsw.json|ngsw-worker.js|safety-worker.js)',
    headers: { 'Cache-Control': 'public,max-age=0,must-revalidate' },
    continue: true,
  },
];

for (const name of ['web', 'admin']) {
  const out = resolve(root, `.local/vercel/${name}/.vercel/output`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const staticRoot = `${out}/static`;
  await cp(resolve(root, `dist/${name}/browser`), staticRoot, { recursive: true });
  const api =
    name === 'web'
      ? apiOrigin
        ? { src: '/api(/.*)?', dest: `${apiOrigin}/api$1` }
        : { src: '/api(?:/.*)?', dest: '/api' }
      : { src: '/api(/.*)?', dest: `${origin}/api$1` };
  const routes = [...headerRoutes, api];
  if (name === 'web')
    routes.push(
      { src: '/', dest: '/index.html' },
      { src: '/help/?', dest: '/help/index.html' },
      { src: '/how-it-works/?', dest: '/help/index.html' },
    );
  routes.push({ handle: 'filesystem' }, { src: '/.*\\.[^/]+', status: 404 });
  if (name === 'web') {
    routes.push(...customerRoutes.map((src) => ({ src, dest: '/index.csr.html' })));
    routes.push(notFoundRoute);

    for (const [file, path] of [
      ['index.html', '/'],
      ['help/index.html', '/help'],
    ]) {
      const htmlPath = `${staticRoot}/${file}`;
      let html = await readFile(htmlPath, 'utf8');
      html = addPublicSeo(html, path, origin);
      await writeFile(htmlPath, html);
    }
    await writeFile(`${staticRoot}/robots.txt`, robotsTxt(origin));
    await writeFile(`${staticRoot}/sitemap.xml`, sitemapXml(origin));
  } else {
    routes.push({ src: '/.*', dest: '/index.html' });
  }
  await writeJson(`${out}/config.json`, {
    version: 3,
    routes,
    ...(name === 'web' && !apiOrigin
      ? { crons: [{ path: '/api/internal/maintenance', schedule: '0 3 * * *' }] }
      : {}),
  });
  if (name !== 'web' || apiOrigin) continue;
  const func = `${out}/functions/api.func`;
  await mkdir(func, { recursive: true });
  const entry = 'dist/api/apps/api/src/serverless.js';
  const trace = await nodeFileTrace([entry], { base: root, processCwd: root });
  const files = new Set(trace.fileList);
  files.add('node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node');
  let bytes = 0;
  for (const file of files) {
    if (file.split('/').some((part) => part.startsWith('.env')))
      throw new Error('Refusing to package environment files.');
    if (file.startsWith('.local/') || file.endsWith('.map')) continue;
    const target = `${func}/${file}`;
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(root, file), target, { dereference: true });
    bytes += (await stat(target)).size;
  }
  // The traced root manifest is only needed for CommonJS package boundaries.
  await writeJson(`${func}/package.json`, { private: true, type: 'commonjs' });
  await writeFile(`${func}/index.js`, `module.exports = require('./${entry}').default;\n`);
  await writeJson(`${func}/.vc-config.json`, {
    runtime: 'nodejs24.x',
    handler: 'index.js',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
    shouldAddSourcemapSupport: false,
    maxDuration: 60,
    regions: ['iad1'],
    supportsResponseStreaming: true,
  });
  if (bytes > 240 * 1024 * 1024) throw new Error('API function exceeds safe size budget.');
  // Assert the build uses the expected entry and includes no unexpected source secrets.
  await readFile(`${func}/${entry}`);
  console.log(
    `API: ${files.size} traced files; ${(bytes / 1024 / 1024).toFixed(1)} MiB uncompressed.`,
  );
}
console.log('Prepared separate web/API and admin Vercel Build Output API v3 artifacts.');
