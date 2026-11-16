// The test version (Kanzlei PC session, Tobias 2026-11-15): `npm run build:test` builds it into
// dist-test/ for the protected test zone at bunny.net. „Tester einladen“ leads to the page of the
// login script (repo Testumgebung) that makes a one-time invitation link. Since the shared test frame
// came in, the frame offers the link beside the tool and the tool's footer no longer does: one link,
// not two. The live build must never carry that address.
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

test('the test version offers „Tester einladen“ once, on the test page, in the same tab', async ({
  page,
}) => {
  expect(existsSync(BUILT_TEST), 'dist-test/index.html fehlt: npm run build:test').toBe(true);
  expect(readFileSync(BUILT_TEST, 'utf8')).toContain(INVITE);
  const problems = await openHosted(page, '/', BUILT_TEST);
  // exactly one link on the page, the frame's; the tool's footer shows only the version
  await expect(page.getByRole('link', { name: inviteLink, exact: true })).toHaveCount(1);
  await expect(page.locator('footer').first()).toContainText('Version');
  await expect(page.locator('footer').getByRole('link', { name: inviteLink })).toHaveCount(0);
  const link = page
    .getByRole('complementary', { name: 'Testbereich' })
    .getByRole('link', { name: inviteLink, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', INVITE);
  // a plain navigation: no new tab, the login script's page leads back with „Zurück zur App“
  expect(await link.getAttribute('target')).toBeNull();
  expect(await link.evaluate((a: HTMLAnchorElement) => a.href)).toBe(`${HOSTED}${INVITE}`);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
  // following it asks the host for exactly that page (refused here: the test serves only the app)
  await link.click();
  await expect.poll(() => problems).toContain(`request: ${HOSTED}${INVITE}`);
});
