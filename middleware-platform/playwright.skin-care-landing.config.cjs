const path = require('path');
const { defineConfig } = require('@playwright/test');

const landingBuild = path.join(__dirname, '..', 'unified-dashboard', 'skin-care-landing', 'build');
const serveScript = path.join(__dirname, 'scripts', 'serve-cra-build.cjs');
const port = String(process.env.PW_SKIN_CARE_LANDING_PORT || '5180').trim() || '5180';
const origin = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [['list']],
  testDir: './e2e',
  testMatch: '**/skin-care-landing.spec.cjs',
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: process.env.HEADED !== '1',
    serviceWorkers: 'block'
  },
  webServer: {
    command: `node "${serveScript}" "${landingBuild}" ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
