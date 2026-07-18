const { defineConfig } = require('@playwright/test');

/** P8.10 — medical tracker IA live E2E (no webServer; set BASE_URL). */
module.exports = defineConfig({
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  testDir: './e2e',
  testMatch: '**/medical-tracker-ia.spec.cjs',
  use: {
    baseURL: (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4180').replace(
      /\/$/,
      '',
    ),
    browserName: 'chromium',
    headless: process.env.HEADED !== '1',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  },
});
