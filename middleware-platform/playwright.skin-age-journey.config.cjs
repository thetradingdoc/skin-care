const path = require('path');
const { defineConfig } = require('@playwright/test');

const consumerRoot = path.join(__dirname, '..', 'unified-dashboard', 'hosting-dist-consumer');
const serveScript = path.join(__dirname, 'scripts', 'serve-consumer-hosting.cjs');
const port = String(process.env.PW_CONSUMER_PORT || '5191').trim() || '5191';
const origin = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [['list']],
  testDir: './e2e',
  testMatch: '**/skin-age-journey.spec.cjs',
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: process.env.HEADED !== '1',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `node "${serveScript}" "${consumerRoot}" ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
