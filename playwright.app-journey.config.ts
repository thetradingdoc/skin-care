/**
 * App-only "Check your skin" journey screenshots + UX audit.
 *
 * Differs from scripts/playwright-myskinandcare-ux-audit.cjs:
 * - patient-app routes only (no marketing /scan funnel)
 * - axe-core + DOM checks per step
 * - incremental screenshots/ux-audit.md
 *
 * Run (from repo root, APP_URL required):
 *   APP_URL=http://127.0.0.1:5194 npm run test:app-journey
 *   APP_URL=http://127.0.0.1:8081 APP_PATH_PREFIX= npm run test:app-journey
 *
 * Optional: PW_STORAGE_STATE=/path/to/storageState.json
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.APP_URL?.trim()) {
  throw new Error(
    [
      'APP_URL is not set.',
      'Set it to your patient-app base (do not use production unless you intend to).',
      'Examples:',
      '  APP_URL=http://127.0.0.1:8081 APP_PATH_PREFIX=   # expo start --web',
      '  APP_URL=http://127.0.0.1:5194                    # consumer hosting /app shell',
    ].join('\n'),
  );
}

export default defineConfig({
  testDir: path.join(rootDir, 'scripts'),
  testMatch: 'app-journey-screenshots.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: path.join(rootDir, 'screenshots', '.pw-output'),
  use: {
    baseURL: process.env.APP_URL.replace(/\/$/, ''),
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
    permissions: ['camera'],
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
