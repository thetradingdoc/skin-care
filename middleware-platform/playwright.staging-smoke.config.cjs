const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 60_000,
  testDir: './e2e',
  testMatch: '**/staging-consumer-smoke.spec.cjs',
  use: {
    baseURL: process.env.STAGING_API_BASE || 'https://api.callsomo.com',
  },
});
