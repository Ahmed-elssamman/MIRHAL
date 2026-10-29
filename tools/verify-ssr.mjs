import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const server = spawn('node', ['dist/web/server/server.mjs'], {
  env: { ...process.env, WEB_PORT: String(port), SSR_ALLOWED_HOSTS: '127.0.0.1' },
  stdio: 'ignore',
});
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(base, { signal: globalThis.AbortSignal.timeout(1000) })).ok;
      if (ready) break;
    } catch {
      /* Allow the production engine to start. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Production SSR starts successfully');
  for (const path of ['/', '/help', '/index.csr.html', '/ngsw.json', '/ngsw-worker.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('cache-control'), /no-cache/, path);
    assert.equal(response.headers.get('x-powered-by'), null);
    if (path === '/' || path === '/help') {
      const html = await response.text();
      assert.match(html, /<h1\b/, `${path} includes its primary content in HTML`);
      assert.match(html, /<meta name="robots" content="index,follow">/);
      assert.match(html, /<html lang="ar" dir="rtl"/);
      assert.match(html, /<meta name="description" content="[^"]+">/);
      assert.match(html, /<meta property="og:title" content="[^"]+">/);
      assert.doesNotMatch(html, /<meta name="robots" content="noindex,nofollow">/);
      if (path === '/') assert.match(html, /<title>مِرحال \| حياتك، رحلتك<\/title>/);
      if (path === '/help')
        assert.match(html, /<title>كيف يعمل مِرحال \| نمو شخصي خطوة بخطوة<\/title>/);
    }
  }
  const privatePage = await (await fetch(`${base}/index.csr.html`)).text();
  assert.match(privatePage, /<meta name="robots" content="noindex,nofollow">/);
  const html = await (await fetch(base)).text();
  const bundle = html.match(/src="(main-[^"]+\.js)"/)?.[1];
  assert.ok(bundle, 'The prerendered page loads a hashed client bundle');
  const asset = await fetch(`${base}/${bundle}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /max-age=31536000, immutable/);
  console.log('Public HTML rendering, update-sensitive caching and immutable bundles verified.');
} finally {
  server.kill('SIGTERM');
}
