import { defineConfig, devices } from '@playwright/test';

// The built single file is opened from disk (file://), the strictest case for the CSP. What only
// the hosted copy does (the access notice and its remembered key, over https only) is tested with
// openHosted in tests/e2e/helpers.ts, which serves the same file at an https address.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 2,
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
