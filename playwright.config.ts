import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:4300',
    storageState: {
      cookies: [],
      origins: ['http://localhost:4300', 'http://localhost:4301'].map((origin) => ({
        origin,
        localStorage: [{ name: 'lq-language', value: 'en' }],
      })),
    },
    browserName: 'chromium',
    ...(process.env['MIRHAL_CHROME_PATH']
      ? { launchOptions: { executablePath: process.env['MIRHAL_CHROME_PATH'] } }
      : {}),
    headless: true,
    // Route fixtures must reach the API instead of a previous PWA worker.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node tools/e2e-server.mjs',
    url: 'http://localhost:4300/api/health',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
