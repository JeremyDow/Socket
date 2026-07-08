import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3847',
    trace: 'off',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3847/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});