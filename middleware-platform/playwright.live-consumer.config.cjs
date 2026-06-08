const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/live-consumer-audit.json' }]],
  testDir: './e2e',
  testMatch: '**/live-consumer-audit.spec.cjs',
  use: {
    browserName: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
  },
});
