const path = require('path');
const { defineConfig } = require('@playwright/test');

const consumerRoot = path.join(__dirname, '..', 'unified-dashboard', 'hosting-dist-consumer');
const serveScript = path.join(__dirname, 'scripts', 'serve-consumer-hosting.cjs');
const ensureScript = path.join(__dirname, 'scripts', 'ensure-conflict-engine-hosting.cjs');
const port = String(process.env.PW_CONSUMER_PORT || '5194').trim() || '5194';
const origin = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  timeout: 60_000,
  workers: 1,
  testDir: './e2e',
  testMatch: '**/live-consumer-journey.spec.cjs',
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: `node "${ensureScript}" && node "${serveScript}" "${consumerRoot}" ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});
