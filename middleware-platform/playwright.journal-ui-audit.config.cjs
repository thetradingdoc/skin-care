const path = require('path');
const { defineConfig } = require('@playwright/test');

const consumerRoot = path.join(__dirname, '..', 'unified-dashboard', 'hosting-dist-consumer');
const serveScript = path.join(__dirname, 'scripts', 'serve-consumer-hosting.cjs');
const ensureScript = path.join(__dirname, 'scripts', 'ensure-conflict-engine-hosting.cjs');
const port = String(process.env.PW_JOURNAL_AUDIT_PORT || '5195').trim() || '5195';
const origin = `http://127.0.0.1:${port}`;
const apiBase = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

module.exports = defineConfig({
  timeout: 120_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [['list']],
  testDir: './e2e',
  testMatch: '**/journal-first-ui-audit.spec.cjs',
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: process.env.HEADED !== '1',
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `node "${ensureScript}" && node "${serveScript}" "${consumerRoot}" ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
  metadata: { apiBase },
});
