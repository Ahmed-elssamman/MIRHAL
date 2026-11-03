import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPublicSeo,
  customerRoutes,
  notFoundRoute,
  robotsTxt,
  sitemapXml,
} from './seo-assets.mjs';

const origin = 'https://mirhal.example';

test('public HTML gets one absolute canonical and matching social URL', () => {
  const html = '<head><link rel="canonical" href="https://old.example/" /></head>';
  const updated = addPublicSeo(html, '/help', origin);
  assert.equal((updated.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(updated, /rel="canonical" href="https:\/\/mirhal\.example\/help"/);
  assert.match(updated, /property="og:url" content="https:\/\/mirhal\.example\/help"/);
});

test('robots and sitemap advertise only public canonical pages', () => {
  assert.equal(
    robotsTxt(origin),
    'User-agent: *\nAllow: /\nSitemap: https://mirhal.example/sitemap.xml\n',
  );
  const xml = sitemapXml(origin);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.match(xml, /<loc>https:\/\/mirhal\.example\/help<\/loc>/);
  assert.doesNotMatch(xml, /dashboard|auth|onboarding|admin/i);
});

test('customer routes keep private app URLs on the noindex client shell', () => {
  assert.ok(customerRoutes.includes('/auth/.*'));
  assert.ok(customerRoutes.includes('/dashboard/?'));
  assert.ok(customerRoutes.includes('/habits/?'));
  assert.ok(!customerRoutes.includes('/help/?'));
  assert.deepEqual(notFoundRoute, { src: '/.*', dest: '/index.csr.html', status: 404 });
});
