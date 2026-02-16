/**
 * Playwright E2E Test Configuration
 *
 * Configuration for end-to-end tests of safety-critical forms.
 * Supports desktop and mobile viewports.
 */

import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

/** Number of workers: env override, or CI-optimized, or Playwright default (local). */
function getWorkers(): number | undefined {
  const envWorkers = process.env.PLAYWRIGHT_WORKERS;
  if (envWorkers !== undefined && envWorkers !== '') {
    const n = parseInt(envWorkers, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  if (process.env.CI) {
    const cores = os.cpus().length;
    return Math.min(6, Math.max(2, Math.floor(cores / 2)));
  }
  return undefined;
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry — 2 retries on CI, 1 locally (Supabase auth can be flaky) */
  retries: process.env.CI ? 2 : 1,

  /* Worker count: override via PLAYWRIGHT_WORKERS; in CI use 2–6 workers by CPU; locally use Playwright default. */
  workers: getWorkers(),
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'tests/e2e-report' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Desktop browsers */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile viewports - Critical for field workers */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13 Pro'] },
    },

    /* Tablet viewport */
    {
      name: 'iPad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  /* Run your local dev server before starting the tests (reuse if already running) */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  
  /* Global timeout — bumped to 45s because Supabase auth can take 20-25s */
  timeout: 45 * 1000,
  
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
  },
});
