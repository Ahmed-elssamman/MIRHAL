import { expect, test } from '@playwright/test';

test('a visitor without a preference starts in Arabic', async ({ page }) => {
  await page.goto('/auth/register');
  await page.evaluate(() => localStorage.removeItem('lq-language'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'ابدأ رحلتي' })).toBeVisible();
  await expect(page).toHaveTitle('مِرحال | حياتك، رحلتك');
  await page.evaluate(() => localStorage.setItem('lq-language', 'en'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page).toHaveTitle('MIRHAL | Your Life. Your Journey.');
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    /goals, habits, and everyday progress/,
  );
});

test('admin metadata follows the selected language', async ({ page }) => {
  await page.goto('http://localhost:4301/auth/login');
  await page.evaluate(() => localStorage.removeItem('lq-language'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle('مِرحال | الإدارة');
  await page.evaluate(() => localStorage.setItem('lq-language', 'en'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page).toHaveTitle('MIRHAL | Admin');
});
