// The test version (Kanzlei PC session, Tobias 2026-11-15): `npm run build:test` builds it into
// dist-test/ for the protected test zone at bunny.net. Its footer links „Tester einladen“ to the page
// of the login script (repo Testumgebung) that makes a one-time invitation link. The live build must
// never carry that address.
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import {
  BUILT,
  BUILT_TEST,
  HOSTED,
  openApp,
  openHosted,
  sideEffects,
  TEST_VERSION_KEYS,
} from './helpers';

const INVITE = '/_zugang/einladen';
const inviteLink = 'Tester einladen';

test('the live build carries no invitation link', async ({ page }) => {
  const live = readFileSync(BUILT, 'utf8');
  // neither the address nor the word: the live file knows nothing of the test zone
  expect(live).not.toContain('_zugang');
  expect(live).not.toContain(inviteLink);
  await openApp(page);
  await expect(page.locator('footer').first()).toContainText('Version');
  await expect(page.getByRole('link', { name: inviteLink })).toHaveCount(0);
});

test('the test version links „Tester einladen“ in the footer, in the same tab', async ({
  page,
}) => {
  expect(existsSync(BUILT_TEST), 'dist-test/index.html fehlt: npm run build:test').toBe(true);
  expect(readFileSync(BUILT_TEST, 'utf8')).toContain(INVITE);
  const problems = await openHosted(page, '/', BUILT_TEST);
  const link = page.locator('footer').getByRole('link', { name: inviteLink, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', INVITE);
  // a plain navigation: no new tab, the login script's page leads back with „Zurück zur App“
  expect(await link.getAttribute('target')).toBeNull();
  expect(await link.evaluate((a: HTMLAnchorElement) => a.href)).toBe(`${HOSTED}${INVITE}`);
  // styled like the other links of the page: the accent colour (the Kanzlei's, where configured)
  const [color, accent] = await link.evaluate((a) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.append(probe);
    const colors = [getComputedStyle(a).color, getComputedStyle(probe).color];
    probe.remove();
    return colors;
  });
  expect(color).toBe(accent);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
  // following it asks the host for exactly that page (refused here: the test serves only the app)
  await link.click();
  await expect.poll(() => problems).toContain(`request: ${HOSTED}${INVITE}`);
});
