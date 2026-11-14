import { expect, test } from '@playwright/test';
import { official } from '../support/fixtures';
import { openApp, sideEffects, upload } from './helpers';

// Phone width (small iPhone). app.css stacks each Pflichtangabe below 640px: label and status on
// the first line, the values below across the full width – and nothing may scroll sideways.
test.use({ viewport: { width: 375, height: 800 } });

test('fits a phone screen: no sideways scrolling, values below label and status', async ({
  page,
}) => {
  const problems = await openApp(page);
  await upload(
    page,
    'luecken.xml',
    official('kosit/paare/01.14a-INVOICE_ubl.xml'),
    'application/xml',
  );
  await expect(page.getByTestId('pflicht-summary')).toBeVisible();

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  const cells = page.getByTestId('pflicht-name-leistender').locator('th, td');
  const box = async (i: number) => {
    const found = await cells.nth(i).boundingBox();
    if (!found) throw new Error(`cell ${i} has no box`);
    return found;
  };
  const label = await box(0);
  const values = await box(1);
  const status = await box(2);
  expect(Math.abs(status.y - label.y)).toBeLessThan(2);
  expect(status.x).toBeGreaterThan(label.x + label.width - 1);
  expect(values.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
  expect(values.width).toBeGreaterThan(label.width);

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// A small Android phone (320 px) and a supplier file name with underscores only: before the audit
// 2026-11-14 the rows "nur im Einzelfall nötig" overflowed by up to 57 px and such a name by 185 px.
test('fits a small phone with a long file name', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const problems = await openApp(page);
  const name = 'Rechnung_2026-11-14_Mustermann_Lieferant_GmbH_Nummer_1234567890123456789.xml';
  await upload(page, name, official('kosit/paare/01.14a-INVOICE_ubl.xml'), 'application/xml');
  await expect(page.getByTestId('pflicht-summary')).toBeVisible();
  await page
    .getByText(/^Positionen anzeigen/)
    .first()
    .click();

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  // The badge "nur im Einzelfall nötig" wraps instead of taking ~150 px: the label kept only 98 px
  // and broke inside words ("Vereinnahm/ung", audit Bedienung Z-01/A-05)
  const narrowest = await page
    .locator('.pflicht-table tbody th')
    .evaluateAll((cells) => Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)));
  expect(narrowest).toBeGreaterThan(150);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
