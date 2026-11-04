import { expect, test } from '@playwright/test';

test('the Help journey and feedback form work on a narrow viewport in both directions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/help');

  const carousel = page.locator('[aria-roledescription="carousel"]');
  await expect(carousel).toBeVisible();
  await expect(
    carousel.getByRole('heading', { name: 'Start with a small intention' }),
  ).toBeVisible();
  await carousel.focus();
  await carousel.press('ArrowRight');
  await expect(
    carousel.getByRole('heading', { name: 'Give your intention a clear goal' }),
  ).toBeVisible();
  await expect(carousel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  for (let step = 0; step < 4; step++) {
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(
    carousel.getByRole('heading', { name: 'Keep going at a sustainable pace' }),
  ).toBeVisible();
  await expect(carousel.getByRole('link', { name: 'Ready to begin?' })).toHaveAttribute(
    'href',
    '/auth/register',
  );

  await page.getByRole('button', { name: 'ع', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(carousel.getByRole('heading', { name: 'استمر بإيقاع يناسبك' })).toBeVisible();
  await carousel.focus();
  await carousel.press('ArrowRight');
  await expect(carousel.getByRole('heading', { name: 'لاحظ التقدم اللي بتعمله' })).toBeVisible();
  await carousel.evaluate((element) => {
    const start = new Touch({ identifier: 1, target: element, clientX: 280, clientY: 80 });
    const end = new Touch({ identifier: 1, target: element, clientX: 40, clientY: 80 });
    element.dispatchEvent(
      new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }),
    );
    element.dispatchEvent(
      new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }),
    );
  });
  await expect(carousel.getByRole('heading', { name: 'استمر بإيقاع يناسبك' })).toBeVisible();

  const feedback = page.locator('#share-feedback');
  await expect(feedback.getByRole('radio')).toHaveCount(5);
  await expect(feedback.getByText('نفسي يكون فيه طريقة أسهل لمراجعة تقدمي.')).toBeVisible();
  await expect(feedback.getByRole('button', { name: 'شاركنا فكرتك' })).toBeDisabled();
  await feedback.getByLabel('عنوان قصير').fill('ملاحظة بسيطة');
  await feedback.getByLabel('احكيلنا أكتر').fill('أتمنى أراجع تقدمي الأسبوعي بطريقة أوضح.');
  await expect(feedback.getByRole('button', { name: 'شاركنا فكرتك' })).toBeEnabled();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0);
});
