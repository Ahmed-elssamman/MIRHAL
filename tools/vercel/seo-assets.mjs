export const customerRoutes = [
  '/auth/.*',
  '/onboarding/?',
  ...[
    'quests',
    'rewards',
    'achievements',
    'friends',
    'challenges',
    'analytics',
    'journey',
    'profile',
    'settings',
    'feedback',
    'notifications',
    'today',
    'habit-lab',
    'dashboard',
    'goals',
    'projects',
    'tasks',
    'habits',
  ].map((path) => `/${path}/?`),
];
export const notFoundRoute = { src: '/.*', dest: '/index.csr.html', status: 404 };

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export function addPublicSeo(html, path, origin) {
  const canonical = `${origin}${path === '/' ? '/' : path}`;
  const withoutExisting = html.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  return withoutExisting.replace(
    '</head>',
    `<link rel="canonical" href="${escapeXml(canonical)}" />\n    <meta property="og:url" content="${escapeXml(canonical)}" />\n  </head>`,
  );
}

export const robotsTxt = (origin) => `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;

export const sitemapXml = (origin) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeXml(origin)}/</loc></url>\n  <url><loc>${escapeXml(origin)}/help</loc></url>\n</urlset>\n`;
