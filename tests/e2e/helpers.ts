import { expect, Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
export const credentials = () =>
  JSON.parse(readFileSync('.local/e2e-credentials.json', 'utf8')) as {
    email: string;
    password: string;
    adminEmail: string;
    adminPassword: string;
  };
export async function login(page: Page, admin = false) {
  const user = credentials();
  // Customer and admin test servers share localhost cookies across their ports.
  await page.request.post('http://localhost:4300/api/auth/logout', {
    headers: { Origin: 'http://localhost:4300' },
  });
  await page.goto(admin ? 'http://localhost:4301/auth/login' : '/auth/login');
  await page.locator('#email').fill(admin ? user.adminEmail : user.email);
  await page.locator('#password').fill(admin ? user.adminPassword : user.password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(admin ? /\/overview$/ : /\/today$/);
}
export async function appearance(page: Page, mode: 'light' | 'dark', admin = false) {
  const origin = admin ? 'http://localhost:4301' : 'http://localhost:4300';
  const response = await page.request.patch(origin + '/api/profile', {
    headers: { Origin: origin },
    data: { language: mode === 'dark' ? 'ar' : 'en', theme: mode },
  });
  expect(response.ok()).toBe(true);
}

export async function inspectLayout(page: Page, application: string, route: string, mode: string) {
  const original = page.viewportSize()!;
  for (const width of [320, 360, 390, 412, 480, 768, 1024, 1280, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `${application}/${route}, ${mode}, ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize(original);
  mkdirSync('.local/audit/screenshots', { recursive: true });
  await page.screenshot({
    path: `.local/audit/screenshots/${application}-${mode}-${route.replaceAll('/', '-')}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
