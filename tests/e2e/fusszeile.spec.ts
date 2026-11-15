// The foot of the page: Impressum and privacy policy of the Kanzlei (Tobias 2026-11-15), addresses
// from the local configuration only. With them the links are tested, without them (the public repo
// alone) the page must carry none — one branch runs, the other is skipped with its reason.
import { expect, test } from '@playwright/test';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { openApp, openHosted, sideEffects } from './helpers';

const { config } = loadAppConfig();
const LINKS = [
  { name: 'Impressum', href: config.imprintUrl },
  { name: 'Datenschutz', href: config.privacyUrl },
];
const configured = LINKS.filter((link) => link.href !== undefined);

test.describe('with the addresses of the local configuration', () => {
  test.skip(configured.length === 0, 'no Impressum or privacy address configured (public repo)');

  test('links Impressum and privacy policy in a new tab, on the notice and in the tool', async ({
    page,
    context,
  }) => {
    const problems = await openHosted(page);
    const footer = page.locator('footer');
    for (const link of configured) {
      const anchor = footer.getByRole('link', { name: link.name, exact: true });
      await expect(anchor).toHaveAttribute('href', link.href ?? '');
      await expect(anchor).toHaveAttribute('target', '_blank');
      await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(problems).toEqual([]);
    expect(await sideEffects(page)).toEqual([]);
    // the downloaded copy carries them too (a page of its own: the https page refuses file://)
    const downloaded = await context.newPage();
    await openApp(downloaded);
    for (const link of configured) {
      await expect(
        downloaded.locator('footer').getByRole('link', { name: link.name }),
      ).toBeVisible();
    }
    expect(await sideEffects(downloaded)).toEqual([]);
  });
});

test('without configured addresses the page links nowhere', async ({ page }) => {
  test.skip(configured.length > 0, 'addresses are configured (local Kanzlei build)');
  await openApp(page);
  await expect(page.locator('footer')).toContainText('Version');
  await expect(page.getByRole('link')).toHaveCount(0);
});
