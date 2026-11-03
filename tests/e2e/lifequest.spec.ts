import { credentials, login, appearance, inspectLayout } from './helpers';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
test('sends a new friend invitation from the customer UI', async ({ page }) => {
  await login(page);
  await page.goto('/friends');
  await page.getByRole('button', { name: 'Add a friend', exact: true }).click();
  await page.locator('#friend-email').fill(`friend-${randomBytes(6).toString('hex')}@e2e.test`);
  const inviteResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/friends') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send friend request', exact: true }).click();
  const response = await inviteResponse;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ channel: 'email', status: 'accepted' });
  await expect(
    page.getByText(
      'The email provider accepted your invitation. Your friend can check their inbox and spam folder.',
    ),
  ).toBeVisible();
});

test('register, onboard, create linked work, build a habit, reflect, earn and redeem XP', async ({
  page,
}) => {
  const email = 'new-' + randomBytes(6).toString('hex') + '@e2e.test';
  const password = randomBytes(18).toString('base64url');
  // The backend failure case is covered against PostgreSQL; exercise its UI notice here.
  await page.route('**/api/auth/register', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), verificationEmail: 'unavailable' },
    });
  });
  await page.goto('/auth/register');
  await page.locator('#displayName').fill('New Explorer');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/onboarding$/);
  await expect(
    page.getByText('Verification email could not be sent. You can resend it from Settings.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Begin my journey' }).click();
  await expect(page).toHaveURL(/today$/);
  await expect(
    page.getByText('Verification email could not be sent. You can resend it from Settings.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await page.goto('/goals');
  await page.getByRole('button', { name: 'New goal', exact: true }).click();
  await page.locator('#goal-title').fill('Build my portfolio');
  await page.locator('#goal-strategy').selectOption('MILESTONE');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  const goal = page.locator('article').filter({ hasText: 'Build my portfolio' });
  await expect(goal).toBeVisible();
  await goal.locator('summary').click();
  await goal.getByRole('textbox', { name: 'New milestone' }).fill('Publish the first case study');
  await goal.getByRole('button', { name: 'Add milestone' }).click();
  await goal.getByRole('checkbox', { name: 'Publish the first case study' }).check();
  await expect(goal).toContainText('100%');
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.locator('#project-title').fill('Portfolio website');
  await page.locator('#project-goal').selectOption({ label: 'Build my portfolio' });
  await page.locator('p-dialog button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Portfolio website' })).toBeVisible();
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.locator('#task-title').fill('Draft the introduction');
  await page.locator('#task-project').selectOption({ label: 'Portfolio website' });
  await page.locator('p-dialog button[type=submit]').click();
  await page.getByRole('button', { name: 'Complete Draft the introduction', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reopen Draft the introduction', exact: true }),
  ).toBeVisible();
  await page.goto('/habits');
  await page.getByRole('button', { name: 'New habit', exact: true }).click();
  await page.locator('#habit-name').fill('Read a little');
  await page.locator('#habit-goal').selectOption({ label: 'Build my portfolio' });
  await page.getByRole('button', { name: 'Save my habit', exact: true }).click();
  const habit = page.locator('article').filter({ hasText: 'Read a little' });
  await habit.getByRole('button', { name: /Complete habit/ }).click();
  await expect(habit).toContainText('A little win, recorded');
  await page.goto('/today');
  await page.locator('#checkin-win').fill('I made a start');
  await page.locator('lq-check-in button[type=submit]').click();
  await expect(page.getByText('You made space for yourself.', { exact: true })).toBeVisible();
  await page.goto('/quests');
  await page.getByRole('button', { name: 'New quest', exact: true }).click();
  await page.locator('#quest-title').fill('One meaningful step');
  await page.locator('#quest-items').fill('Review my work');
  await page.locator('p-dialog button[type=submit]').click();
  const quest = page.locator('article').filter({ hasText: 'One meaningful step' });
  await quest.getByRole('button', { name: /Review my work/ }).click();
  await expect(quest).toContainText('100%');
  await page.goto('/rewards');
  await page
    .getByRole('button', { name: /personal reward/i })
    .first()
    .click();
  await page.locator('#reward-title').fill('A quiet coffee');
  await page.locator('#reward-cost').fill('50');
  await page.locator('p-dialog button[type=submit]').click();
  const rewardCard = page.locator('article').filter({ hasText: 'A quiet coffee' });
  await rewardCard.getByRole('button', { name: '☆ Favorite' }).click();
  await expect(rewardCard.getByRole('button', { name: '★ Favorite' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await rewardCard.getByRole('button', { name: 'Save for this' }).click();
  await expect(page.getByRole('heading', { name: 'Saving for something' })).toBeVisible();
  await rewardCard.getByRole('button', { name: 'Enjoy this reward', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'You’ve earned a little joy.' })
    .getByRole('button', { name: 'Enjoy this reward', exact: true })
    .click();
  await expect(page.getByText('A quiet coffee').last()).toBeVisible();
  await page.getByLabel('How was it?').selectOption('5');
  await expect(page.getByLabel('How was it?')).toHaveValue('5');
  await page.goto('/feedback');
  await page.locator('#feedback-title').fill('Make the next step clearer');
  await page
    .locator('#feedback-description')
    .fill('I would like more examples for the monthly review.');
  await page.locator('button[type=submit]').click();
  await expect(page.getByText('Make the next step clearer').last()).toBeVisible();
  const conversation = page.locator('article').filter({ hasText: 'Make the next step clearer' });
  await conversation.locator('input[type=file]').setInputFiles('apps/web/public/icon-192.png');
  await expect(conversation.getByRole('link', { name: 'icon-192.png', exact: true })).toBeVisible();
  await page.goto('/profile');
  await page.getByRole('radio', { name: 'dawn', exact: true }).focus();
  await page.getByRole('radio', { name: 'dawn', exact: true }).press('Space');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Your profile is up to date.', { exact: true })).toBeVisible();
  await page.goto('/journey');
  await page.locator('#journey-win').fill('I kept the smallest promise.');
  await page.getByRole('button', { name: 'Save this chapter', exact: true }).click();
  await expect(page.getByText('A thought worth keeping. Saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#journey-win')).toHaveValue('I kept the smallest promise.');
  await page.locator('#journey-win').fill('An unfinished reflection');
  await page.locator('aside').getByRole('link', { name: 'Today', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Keep your changes?' })
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await expect(page).toHaveURL(/journey$/);
  await page.locator('aside').getByRole('link', { name: 'Today', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Keep your changes?' })
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page).toHaveURL(/today$/);
});
test('admin can inspect users and process feedback with an audit trail', async ({ page }) => {
  const user = credentials();
  await page.request.post('/api/auth/login', {
    headers: { Origin: 'http://localhost:4300' },
    data: { email: user.email, password: user.password },
  });
  await page.request.post('/api/feedback', {
    headers: { Origin: 'http://localhost:4300' },
    data: {
      title: 'Admin review fixture',
      description: 'A clear request for better weekly review examples.',
      category: 'SUGGESTION',
    },
  });
  await login(page, true);
  await page.goto('http://localhost:4301/users');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText(user.email).first()).toBeVisible();
  await page.goto('http://localhost:4301/feedback');
  await page.getByRole('button').filter({ hasText: 'Admin review fixture' }).click();
  await page.locator('#admin-feedback-status').selectOption('REVIEWING');
  await page.locator('#admin-feedback-reply').fill('Thanks. We are reviewing the examples.');
  await page.locator('p-dialog button[type=submit]').click();
  await expect(page.getByRole('button').filter({ hasText: 'Admin review fixture' })).toContainText(
    /reviewing/i,
  );
  await page.goto('http://localhost:4301/audit-logs');
  await expect(page.getByText('FEEDBACK UPDATED').first()).toBeVisible();
});
test('desktop/mobile routes remain usable, accessible and free of horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  for (const width of [320, 360, 390, 412, 480, 768, 1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['dashboard', 'today', 'habits', 'challenges', 'help']) {
      await page.goto('/' + route);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
  await page.goto('/today');
  await expect(page.locator('lq-skeleton')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    localStorage.setItem('lq-language', 'ar');
    localStorage.setItem('lq-theme', 'dark');
  });
  await page.goto('/help');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});

test('friends accept invitations and make server-scored challenge progress', async ({
  page,
  browser,
}) => {
  const peerContext = await browser.newContext({ baseURL: 'http://localhost:4300' });
  const peer = await peerContext.newPage();
  const email = 'peer-' + randomBytes(6).toString('hex') + '@e2e.test';
  const registration = await peer.request.post('/api/auth/register', {
    headers: { Origin: 'http://localhost:4300' },
    data: {
      email,
      password: randomBytes(18).toString('base64url'),
      displayName: 'Challenge partner',
      language: 'en',
    },
  });
  expect(registration.ok()).toBe(true);
  const areasResponse = await peer.request.get('/api/life-areas');
  expect(areasResponse.ok()).toBe(true);
  const [area] = z
    .array(z.object({ id: z.string() }))
    .min(1)
    .parse(await areasResponse.json());
  const onboarding = await peer.request.post('/api/onboarding', {
    headers: { Origin: 'http://localhost:4300' },
    data: { areaIds: [area.id] },
  });
  expect(onboarding.ok()).toBe(true);
  await login(page);
  await page.goto('/friends');
  await page.getByRole('button', { name: 'Add a friend', exact: true }).click();
  await page.locator('#friend-email').fill(email);
  await page.getByRole('button', { name: 'Send friend request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Challenge partner' })).toBeVisible();
  await peer.goto('/friends');
  await peer.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(peer.getByText('On the journey with you')).toBeVisible();
  await peer.goto('/habits');
  await peer.getByRole('button', { name: 'New habit', exact: true }).click();
  await peer.locator('#habit-name').fill('Take one small step');
  await peer.getByRole('button', { name: 'Save my habit', exact: true }).click();
  await expect(peer.getByRole('heading', { name: 'Take one small step' })).toBeVisible();
  // Shorten only the isolated fixture's valid deadline so the real lifecycle can finish.
  let shortenedDeadline = false;
  await page.route('**/api/challenges', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const input = route.request().postDataJSON();
    shortenedDeadline = true;
    await route.continue({
      postData: JSON.stringify({ ...input, endDate: new Date(Date.now() + 15000).toISOString() }),
    });
  });
  await page.goto('/challenges');
  await page.getByRole('button', { name: 'New challenge', exact: true }).click();
  await page.locator('#challenge-title').fill('A shared week of small wins');
  await page
    .locator('p-dialog')
    .getByRole('button', { name: 'Challenge partner', exact: true })
    .click();
  await page.getByRole('button', { name: 'Send the invitation', exact: true }).click();
  expect(shortenedDeadline).toBe(true);
  await peer.goto('/challenges');
  const invitation = peer.locator('article').filter({ hasText: 'A shared week of small wins' });
  await invitation.getByRole('button', { name: /accept/i }).click();
  await peer.getByRole('button', { name: 'Accept and grow together', exact: true }).click();
  await peer.goto('/habits');
  await peer
    .locator('article')
    .filter({ hasText: 'Take one small step' })
    .getByRole('button', { name: /Complete habit/ })
    .click();
  await page.goto('/challenges');
  const challenge = page.locator('article').filter({ hasText: 'A shared week of small wins' });
  await challenge.getByRole('button', { name: /refresh/i }).click();
  await expect(challenge).toContainText('100%');
  await expect(async () => {
    const refresh = challenge.getByRole('button', { name: 'Refresh progress', exact: true });
    if (await refresh.isVisible()) await refresh.click();
    await expect(challenge).toContainText(/completed/i, { timeout: 500 });
  }).toPass({ timeout: 25000, intervals: [1000, 2000] });
  await peer.goto('/achievements');
  await expect(peer.locator('h1')).toBeVisible();
  await peerContext.close();
});

test('staff publishes a quest template and explorers retain unsaved edits', async ({ page }) => {
  const title = 'A thoughtful week ' + randomBytes(3).toString('hex');
  await login(page, true);
  await page.goto('http://localhost:4301/quests');
  await page.getByRole('button', { name: 'New template', exact: true }).click();
  await page.locator('#template-title').fill(title);
  await page.locator('#template-ar').fill('أسبوع من الخطوات الهادفة');
  await page.locator('#template-description').fill('A small step can begin a good week.');
  await page.locator('#template-description-ar').fill('خطوة صغيرة قد تبدأ أسبوعاً جيداً.');
  await page.locator('#template-items').fill('Take one small step\nNotice what helped');
  await page.locator('#template-items-ar').fill('اتخذ خطوة صغيرة\nلاحظ ما ساعدك');
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await login(page);
  await page.goto('/quests');
  await page.locator('summary').filter({ hasText: 'A little inspiration for this week' }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.locator('#quest-items')).toHaveValue('Take one small step\nNotice what helped');
  await page.locator('#quest-title').fill(title + ' adapted');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Keep your changes?' })
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await expect(page.locator('#quest-title')).toHaveValue(title + ' adapted');
  await page.locator('p-dialog button[type=submit]').click();
  await expect(page.getByRole('heading', { name: title + ' adapted', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.goto('/quests');
  await page.locator('summary').filter({ hasText: 'قليل من الإلهام لهذا الأسبوع' }).click();
  const arabicTemplate = page.getByRole('button', { name: /أسبوع من الخطوات الهادفة/ });
  await expect(arabicTemplate).toContainText('خطوة صغيرة قد تبدأ أسبوعاً جيداً.');
  await arabicTemplate.click();
  await expect(page.locator('#quest-items')).toHaveValue('اتخذ خطوة صغيرة\nلاحظ ما ساعدك');
});

test('customer routes support Arabic dark mode, keyboard contrast and small screens', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page);
  const findings: { route: string; mode: string; rule: string; targets: unknown }[] = [];
  for (const mode of ['light', 'dark'] as const) {
    await appearance(page, mode);
    await page.setViewportSize({ width: mode === 'dark' ? 320 : 1280, height: 900 });
    for (const route of [
      'onboarding',
      'dashboard',
      'today',
      'goals',
      'projects',
      'tasks',
      'habits',
      'habit-lab',
      'quests',
      'journey',
      'friends',
      'challenges',
      'analytics',
      'rewards',
      'achievements',
      'notifications',
      'profile',
      'settings',
      'feedback',
      'help',
    ]) {
      await page.goto('/' + route);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', mode === 'dark' ? 'rtl' : 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', mode === 'dark' ? 'ar' : 'en');
      expect(
        await page.locator('html').evaluate((element) => element.classList.contains('dark')),
      ).toBe(mode === 'dark');
      await expect(page.locator('lq-skeleton')).toHaveCount(0);
      if (mode === 'dark' && route === 'rewards')
        await expect(page.getByRole('heading', { name: 'صباح قهوة هادئ' })).toBeVisible();
      if (mode === 'dark' && route === 'achievements')
        await expect(
          page.getByText('مارس عادة يومية سبعة أيام متتالية. تُحسب الخطوات الصغيرة أيضاً.'),
        ).toBeVisible();
      if (mode === 'dark' && route === 'journey')
        await expect(page.getByText('تعمق قليلاً وتعلم شيئاً جديداً.')).toBeVisible();
      if (
        !(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      )
        findings.push({ route, mode, rule: 'horizontal-overflow', targets: [] });
      await inspectLayout(page, 'web', route, mode);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      findings.push(
        ...result.violations.map((v) => ({
          route,
          mode,
          rule: v.id,
          targets: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      );
    }
  }
  await page.goto('/today');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('lq-skeleton')).toHaveCount(0);
  mkdirSync('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/today-arabic-dark.png', fullPage: true });
  await appearance(page, 'light');
  expect(findings).toEqual([]);
});

test('administration remains accessible on mobile and desktop', async ({ page }) => {
  test.setTimeout(150000);
  await login(page, true);
  await page.goto('http://localhost:4301/users');
  const detailPath = await page.locator('a[href^="/users/"]').first().getAttribute('href');
  if (!detailPath) throw new Error('Admin user detail route is unavailable');
  const findings: unknown[] = [];
  for (const mode of ['light', 'dark'] as const) {
    await appearance(page, mode, true);
    await page.setViewportSize({ width: mode === 'dark' ? 320 : 1440, height: 900 });
    for (const route of [
      'overview',
      'users',
      detailPath.slice(1),
      'feedback',
      'challenges',
      'analytics',
      'quests',
      'content/rewards',
      'content/achievements',
      'content/help',
      'content/announcements',
      'audit-logs',
      'settings',
      'health',
    ]) {
      await page.goto('http://localhost:4301/' + route);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', mode === 'dark' ? 'rtl' : 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', mode === 'dark' ? 'ar' : 'en');
      expect(
        await page.locator('html').evaluate((element) => element.classList.contains('dark')),
      ).toBe(mode === 'dark');
      if (route === 'analytics') {
        await page.locator('#planning-insights').scrollIntoViewIfNeeded();
        await expect(page.locator('lq-planning-insights')).toBeVisible();
      }
      await expect(page.locator('lq-skeleton')).toHaveCount(0);
      if (
        [
          'quests',
          'content/rewards',
          'content/achievements',
          'content/help',
          'content/announcements',
        ].includes(route)
      ) {
        const createName =
          route === 'quests'
            ? mode === 'dark'
              ? 'قالب جديد'
              : 'New template'
            : mode === 'dark'
              ? 'إنشاء جديد'
              : 'Create new';
        await page.getByRole('button', { name: createName, exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        if (route === 'content/achievements') {
          await expect(page.locator('#content-icon option[value="award"]')).toHaveText(
            mode === 'dark' ? 'جائزة' : 'Award',
          );
          await expect(page.locator('#content-condition option[value="HABIT_COUNT"]')).toHaveText(
            mode === 'dark' ? 'العادات المكتملة' : 'Completed habits',
          );
        }
        for (const width of [320, 360]) {
          await page.setViewportSize({ width, height: 900 });
          const layout = await dialog.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              left: bounds.left,
              right: bounds.right,
              contentOverflow: element.scrollWidth > element.clientWidth + 1,
              pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            };
          });
          if (
            layout.left < -1 ||
            layout.right > width + 1 ||
            layout.contentOverflow ||
            layout.pageOverflow
          )
            findings.push({ route, mode, width, rule: 'dialog-overflow', layout });
        }
        await page.setViewportSize({ width: mode === 'dark' ? 320 : 1440, height: 900 });
        await page.getByRole('button', { name: mode === 'dark' ? 'إغلاق' : 'Close' }).click();
      }
      if (
        !(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      )
        findings.push({ route, mode, rule: 'overflow' });
      await inspectLayout(page, 'admin', route, mode);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      findings.push(
        ...result.violations.map((v) => ({
          route,
          mode,
          rule: v.id,
          targets: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      );
    }
  }
  await page.goto('http://localhost:4301/overview');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('lq-skeleton')).toHaveCount(0);
  await page.screenshot({ path: '.local/screenshots/admin-arabic-dark.png', fullPage: true });
  await appearance(page, 'light', true);
  expect(findings).toEqual([]);
});

test('records production dashboard measurements and review screenshots', async ({ page }) => {
  await login(page);
  await page.addInitScript(() => {
    const samples = { lcpMs: 0, cls: 0 };
    Object.assign(window, { lifequestVitals: samples });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) samples.lcpMs = Math.round(entry.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) samples.cls += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dashboard');
  await expect(page.locator('lq-skeleton')).toHaveCount(0);
  await expect(page.locator('h1')).toBeVisible();
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const apiRequests = resources
      .filter((r) => new URL(r.name).pathname.startsWith('/api/'))
      .map((r) => new URL(r.name).pathname);
    return {
      dashboardReadyMs: Math.round(performance.now()),
      ...(window as unknown as { lifequestVitals: { lcpMs: number; cls: number } }).lifequestVitals,
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadMs: Math.round(navigation.loadEventEnd),
      scripts: resources.filter((r) => new URL(r.name).pathname.endsWith('.js')).length,
      transferBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
      apiRequests,
    };
  });
  mkdirSync('.local/screenshots', { recursive: true });
  writeFileSync(
    '.local/performance.json',
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        environment:
          'Local production builds, Chromium, disabled browser cache, 4x CPU throttle, no network throttle',
        ...metrics,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: '.local/screenshots/dashboard-final.png', fullPage: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  await expect(page.locator('lq-skeleton')).toHaveCount(0);
  await page.screenshot({ path: '.local/screenshots/today-final.png', fullPage: true });
  expect(metrics.apiRequests.filter((path) => path === '/api/dashboard')).toHaveLength(1);
});
