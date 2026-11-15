// Not installable (Tobias 2026-11-15): neither the live build nor the test version offers itself as
// an app. A browser offers installation only for a page with a web app manifest (Chrome, Edge: and
// usually a service worker); iOS opens a home-screen bookmark full screen only with the
// apple-mobile-web-app tags. The page has none of them, and its CSP refuses a manifest
// (manifest-src) and any service worker (worker-src). What no page can prevent: the browser's own
// "add to home screen" or "install page" menu still makes a shortcut to the address — without a
// service worker it opens the address afresh and works only online.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { BUILT, BUILT_TEST, openHosted, sideEffects, TEST_VERSION_KEYS } from './helpers';

const INSTALL_HINTS = [
  /rel=["']?manifest/i,
  /\.webmanifest/i,
  /apple-mobile-web-app-capable/i,
  /mobile-web-app-capable/i,
  /apple-touch-icon/i,
  /serviceWorker\.register/,
  /beforeinstallprompt/i,
];

for (const [name, built] of [
  ['live build', BUILT],
  ['test version', BUILT_TEST],
] as const) {
  test(`the ${name} is not installable`, async ({ page }) => {
    const html = readFileSync(built, 'utf8');
    for (const hint of INSTALL_HINTS) expect(html, String(hint)).not.toMatch(hint);
    const problems = await openHosted(page, '/', built);
    await expect(page.locator('footer').first()).toContainText('Version');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("manifest-src 'none'");
    expect(csp).toContain("worker-src 'none'");
    // no service worker is registered for the address
    const registrations = await page.evaluate(async () =>
      'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    );
    expect(registrations).toBe(0);
    expect(problems).toEqual([]);
    // the test version may keep the tester's run (Tobias 2026-11-15), the live build nothing more
    expect(await sideEffects(page, built === BUILT_TEST ? TEST_VERSION_KEYS : undefined)).toEqual(
      [],
    );
  });
}
