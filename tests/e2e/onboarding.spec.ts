import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { appearance, inspectLayout } from './helpers';

test('short onboarding supports skipped answers, validation and an unfinished return', async ({
  page,
}) => {
  const email = `onboard-${randomBytes(6).toString('hex')}@e2e.test`;
  const password = randomBytes(18).toString('base64url');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/auth/register');
  await page.locator('#displayName').fill('New Explorer');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await inspectLayout(page, 'web', 'onboarding-start', 'en');
  await appearance(page, 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ما الذي تريد تحسينه؟' })).toBeVisible();
  await expect(page.locator('button[aria-pressed]').first()).toBeVisible();
  await inspectLayout(page, 'web', 'onboarding-start', 'ar');
  await appearance(page, 'light');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Growth', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await inspectLayout(page, 'web', 'onboarding-details', 'en');
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  await page.locator('#onboard-goal').fill('x');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Begin my journey' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('alert').first()).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.locator('#onboard-routine').selectOption('evening');
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText('1 / 3')).toBeVisible();
  await page.goto('/today');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.request.post('/api/auth/logout', { headers: { Origin: 'http://localhost:4300' } });
  await page.goto('/auth/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.locator('#onboard-routine').selectOption('evening');
  await page.getByRole('button', { name: 'Begin my journey' }).click();
  await expect(page).toHaveURL(/\/today$/);

  const response = await page.request.get('/api/auth/me');
  expect(response.ok()).toBe(true);
  const user: unknown = await response.json();
  expect(user).toMatchObject({
    profile: { preferredRoutine: 'evening', profileVisibility: 'PRIVATE' },
  });

  await page.request.post('/api/auth/logout', { headers: { Origin: 'http://localhost:4300' } });
  await page.goto('/auth/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/today$/);
});
