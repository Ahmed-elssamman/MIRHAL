import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const executablePath = process.env.MIRHAL_CHROME_PATH || chromium.executablePath();
if (!existsSync(executablePath))
  throw new Error('Set MIRHAL_CHROME_PATH to a Chromium browser executable.');
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const server = spawn(process.execPath, ['dist/web/server/server.mjs'], {
  env: { ...process.env, WEB_PORT: String(port), SSR_ALLOWED_HOSTS: '127.0.0.1' },
  stdio: 'ignore',
});
const base = `http://127.0.0.1:${port}`;
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(base)).ok;
    } catch {
      /* Server is starting. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'SSR server starts');
  browser = await chromium.launch({ headless: true, executablePath });
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const initial = await noJs.newPage();
  await initial.goto(`${base}/index.csr.html`);
  assert.equal(
    await initial.locator('.initial-loading').count(),
    1,
    'CSR shell contains branded initial loader',
  );
  assert.equal(
    await initial.locator('.initial-loading img').getAttribute('src'),
    'mirhal-mark.svg',
  );
  assert.equal(
    await initial
      .locator('.initial-loading img')
      .evaluate((image) => globalThis.getComputedStyle(image).animationName),
    'none',
    'reduced motion disables loader animation',
  );
  await noJs.close();
  const context = await browser.newContext({ serviceWorkers: 'block', colorScheme: 'dark' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /NG05\d\d|hydration/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`${base}/index.csr.html`, { waitUntil: 'networkidle' });
  assert.equal(
    await page.locator('html').evaluate((element) => element.classList.contains('dark')),
    true,
    'system dark preference is applied',
  );
  assert.equal(
    await page.locator('.initial-loading').count(),
    0,
    'CSR boot replaces initial loader',
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/', '/help', '/auth/login']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.locator('h1').first().waitFor({ state: 'visible' });
      assert.equal(
        await page.locator('.initial-loading').count(),
        0,
        `${route}: initial loader is removed`,
      );
      const overflow = await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
      );
      assert.equal(overflow, false, `${route}: horizontal overflow at ${width}px`);
    }
  }
  assert.deepEqual(errors, [], 'No uncaught client exceptions');
  await context.close();
  const authenticated = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  const app = await authenticated.newPage();
  const user = {
    id: 'test-user',
    email: 'test@example.test',
    role: 'USER',
    emailVerifiedAt: '2026-10-30',
    profile: {
      displayName: 'Tester',
      language: 'en',
      theme: 'light',
      reducedMotion: false,
      onboardingCompletedAt: '2026-10-30',
      showAdditionalNavigation: false,
    },
  };
  const task = {
    id: 'task-1',
    title: 'Fixture task',
    status: 'ACTIVE',
    priority: 'HIGH',
    project: null,
    estimatedMinutes: null,
  };
  const pageData = (items = []) => ({ items, total: items.length, page: 1, limit: 10 });
  let releaseCompletion;
  let mutationCount = 0;
  await app.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = pageData();
    if (path === '/api/auth/me') body = user;
    else if (path === '/api/habits')
      body = { ...pageData(), date: '2026-10-30', completedCount: 0 };
    else if (path === '/api/check-ins') body = [];
    else if (path === '/api/tasks/task-1' && route.request().method() === 'PATCH') {
      mutationCount++;
      await new Promise((resolve) => {
        releaseCompletion = resolve;
      });
      body = { ...task, status: 'COMPLETED', awarded: 10 };
    } else if (path === '/api/tasks') body = pageData([task]);
    else if (path === '/api/notifications')
      body = pageData([
        {
          id: 'notice-1',
          title: 'Fixture notice',
          body: 'Details',
          type: 'FRIEND_REQUEST',
          href: '/today',
          readAt: '2026-10-30',
          createdAt: '2026-10-30',
        },
      ]);
    else if (path.startsWith('/api/notifications/')) body = { success: true };
    await route.fulfill({ status: 200, json: body });
  });
  await app.goto(`${base}/today`, { waitUntil: 'networkidle' });
  await app.getByRole('button', { name: 'Complete Fixture task' }).last().click();
  await app.getByText('Saving…').waitFor({ state: 'visible' });
  assert.equal(mutationCount, 1, 'one task mutation was sent');
  assert.equal(
    (await app.getByText('Fixture task').count()) > 0,
    true,
    'pending task remains visible',
  );
  releaseCompletion();
  await app.getByText('Saving…').waitFor({ state: 'hidden' });
  await app.getByRole('button', { name: 'Notifications' }).click();
  await app.getByText('Fixture notice').waitFor({ state: 'visible' });
  await app.getByRole('button', { name: /Fixture notice/ }).click();
  await app.getByText('Fixture notice').waitFor({ state: 'hidden' });
  assert.equal(new URL(app.url()).pathname, '/today');
  await app.locator('[data-profile-trigger]').click();
  await app.locator('#profile-actions').waitFor({ state: 'visible' });
  for (const name of ['Profile', 'Friends', 'Settings', 'Log out'])
    assert.equal(
      await app.locator('#profile-actions').getByText(name, { exact: true }).count(),
      1,
      `account menu contains ${name}`,
    );
  await authenticated.close();
  console.log('Public SSR and CSR loading and horizontal layout checked at five viewport widths.');
  console.log(
    'Mocked authenticated task, notification and profile menu flows checked at mobile width.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
