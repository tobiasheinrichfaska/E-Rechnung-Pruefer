// The Kanzlei colours (Tobias 2026-11-15, as in the Fragebogen): from the local configuration they
// replace the defaults of app.css through CSS variables set at start — without a CSP violation.
// Without colours (the public repo alone) the defaults stay. One branch runs, the other is skipped.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { openApp, sideEffects } from './helpers';

const COLORS = loadAppConfig().config.colors;

/** `#rrggbb` as the browser reports a computed colour */
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

const button = (page: Page) => page.getByRole('button', { name: 'Datei auswählen' });
const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

test.describe('with the colours of the local configuration', () => {
  test.skip(COLORS === undefined, 'no Kanzlei colours configured (public repo)');
  const colors = COLORS ?? { accent: '#000000' };

  test('buttons, the drop zone and the notice take the Kanzlei colours', async ({ page }) => {
    const problems = await openApp(page);
    await expect(button(page)).toHaveCSS('background-color', rgb(colors.accent));
    if (colors.infoBg) {
      expect(await style(page, '[data-testid="fixed-notice"]', 'background-color')).toBe(
        rgb(colors.infoBg),
      );
    }
    // a file dragged over the page lights the drop zone up in the Kanzlei colours
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['x'], 'r.xml', { type: 'text/xml' }));
      window.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, cancelable: true }));
    });
    await expect(page.locator('.dropzone.over')).toHaveCSS('border-top-color', rgb(colors.accent));
    if (colors.chosenBg) {
      await expect(page.locator('.dropzone.over')).toHaveCSS(
        'background-color',
        rgb(colors.chosenBg),
      );
    }
    expect(problems).toEqual([]);
    expect(await sideEffects(page)).toEqual([]);
  });

  test('links take the Kanzlei accent', async ({ page }) => {
    await openApp(page);
    await expect(button(page)).toBeVisible();
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = '#probe';
      link.textContent = 'Probe';
      document.body.append(link);
    });
    await expect(page.getByRole('link', { name: 'Probe' })).toHaveCSS('color', rgb(colors.accent));
  });
});

test('without configured colours the defaults of app.css stay', async ({ page }) => {
  test.skip(COLORS !== undefined, 'Kanzlei colours are configured (local Kanzlei build)');
  await openApp(page);
  await expect(button(page)).toHaveCSS('background-color', rgb('#0b5cad'));
});
