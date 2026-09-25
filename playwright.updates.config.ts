import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pwa',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5190', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'node scripts/serve-update-test.mjs', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});
