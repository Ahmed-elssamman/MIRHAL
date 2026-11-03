import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers';

test('Habit Lab preserves unsaved learning and applies a gentler custom schedule', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/habits');
  await page.getByRole('button', { name: 'New habit', exact: true }).click();
  await page.locator('#habit-name').fill('Read a little earlier');
  await page.getByRole('button', { name: 'Save my habit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Read a little earlier' })).toBeVisible();
  await page.goto('/habit-lab');
  const habit = page.locator('article').filter({ hasText: 'Read a little earlier' });
  await habit.getByRole('button').click();
  await page.locator('#lab-reason').fill('Evenings are already full');
  await page.locator('p-dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await expect(page.locator('#lab-reason')).toHaveValue('Evenings are already full');
  await page.locator('#lab-hypothesis').fill('A smaller morning promise will fit');
  await page.locator('#lab-adjustment').fill('Read two pages on Monday and Friday');
  await page.locator('#lab-target').fill('2');
  await page.locator('#lab-frequency').selectOption('CUSTOM');
  const save = page.getByRole('button', { name: 'Start this experiment', exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Mon', exact: true }).click();
  await page.getByRole('button', { name: 'Fri', exact: true }).click();
  await page.locator('#lab-commitment').selectOption('flexible');
  await expect(save).toBeEnabled();
  await page
    .locator('p-dialog')
    .first()
    .evaluate(async (dialog) => {
      await Promise.all(
        dialog
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
  const a11y = await new AxeBuilder({ page })
    .include('p-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    a11y.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
  await save.click();
  await expect(page.locator('p-dialog [role=dialog]')).toHaveCount(0);
  await page.reload();
  await habit.locator('summary').click();
  await expect(
    page.getByText('Read two pages on Monday and Friday', { exact: true }),
  ).toBeVisible();
  await habit.getByRole('button').click();
  await expect(page.locator('#lab-frequency')).toHaveValue('CUSTOM');
  await expect(page.getByRole('button', { name: 'Mon', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Fri', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#lab-target')).toHaveValue('2');
});

test('a temporary habits failure explains recovery and retry restores the real data', async ({
  page,
}) => {
  await login(page);
  await page.route('**/api/habits', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Temporary failure' }),
    }),
  );
  await page.goto('/habits');
  await expect(page.locator('lq-error')).toBeVisible();
  await page.unroute('**/api/habits');
  await page.locator('lq-error').getByRole('button').click();
  await expect(page.locator('lq-error')).toHaveCount(0);
  await expect(page.locator('article').first()).toBeVisible();
});

test('repeated missed commitments offer a smaller editable experiment', async ({ page }) => {
  await login(page);
  const startDate = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const created = await page.request.post('/api/habits', {
    headers: { Origin: 'http://localhost:4300' },
    data: {
      name: 'Gentle recovery example',
      areaId: 'area-body',
      target: 30,
      unit: 'minutes',
      startDate,
    },
  });
  expect(created.ok()).toBe(true);
  await page.goto('/habit-lab');
  const habit = page.locator('article').filter({ hasText: 'Gentle recovery example' });
  await expect(habit.getByText('Several planned days did not happen.')).toBeVisible();
  await habit.getByRole('button', { name: 'Try a smaller experiment' }).click();
  await expect(page.locator('#lab-target')).toHaveValue('10');
  await expect(page.locator('#lab-reason')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Start this experiment' })).toBeDisabled();
});
