import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The layout tests measure text (a word or code broken over two lines, a table wider than its
// card), so they depend on the font. GitHub's runners render with DejaVu Sans; a session with Inter
// installed passed where GitHub failed (audit 2026-11-17, R5-T-01). On Linux, where DejaVu Sans is
// there and no FONTCONFIG_FILE is set, tests/e2e/fonts.conf makes the browsers use it too (it
// includes the system's configuration, drops Inter and prefers DejaVu Sans for sans-serif and
// system-ui). No font is downloaded or kept in the repo.
const DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
if (process.platform === 'linux' && !process.env['FONTCONFIG_FILE'] && existsSync(DEJAVU)) {
  process.env['FONTCONFIG_FILE'] = fileURLToPath(new URL('tests/e2e/fonts.conf', import.meta.url));
}

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
