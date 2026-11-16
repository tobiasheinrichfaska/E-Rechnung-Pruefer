import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { miniPdf } from '../../src/build/minipdf';
import { encode, official, officialText, withInvoiceNumber } from '../support/fixtures';
import { brokenCodes, openApp, sideEffects, upload } from './helpers';

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
    .getByText(/^Positionen \(\d+\)$/)
    .first()
    .click();

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  // The badge "nur im Einzelfall nötig" wraps instead of taking ~150 px: the label kept only 98 px
  // and broke inside words ("Vereinnahm/ung", audit Bedienung Z-01/A-05)
  // the folded rows "nur im Einzelfall nötig" (G-1) are the ones that broke inside words: open them
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) details.open = true;
  });
  expect(await page.locator('.pflicht-table tbody th').count()).toBeGreaterThan(20);
  const narrowest = await page
    .locator('.pflicht-table tbody th')
    .evaluateAll((cells) => Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)));
  expect(narrowest).toBeGreaterThan(150);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Two invoice XML with different data (F27): on a phone the comparison table becomes blocks, and its
// column headers with the attachment names stood once on top. Below each Angabe the values followed
// one another without a name, so which value came from which attachment was left to their order
// (audit R3-U-06). Now each value names its attachment there, for the eye only.
test('names the attachment of each compared value on a phone', async ({ page }) => {
  const problems = await openApp(page);
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  await upload(
    page,
    'zwei.pdf',
    miniPdf({
      attachments: [xml('erste.xml', cii), xml('zweite.xml', withInvoiceNumber(cii, 'X-2'))],
    }),
    'application/pdf',
  );
  const comparison = page.getByRole('table', { name: 'Vergleich der Rechnungsdaten' });
  const cells = comparison.locator('tr.differs td');
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0)).toHaveText(/^erste\.xml: \S/, { useInnerText: true });
  await expect(cells.nth(1)).toHaveText('zweite.xml: X-2', { useInnerText: true });
  // every value of the table, not only the differing one
  const rows = await comparison.locator('tbody tr').count();
  await expect(comparison.locator('tbody .part-name:visible')).toHaveCount(rows * 2);
  // the names on top are out of sight, but screen readers keep the column headers and skip the
  // names in the cells
  expect((await comparison.locator('thead').boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);
  await expect(comparison.getByRole('columnheader', { name: 'zweite.xml' })).toHaveCount(1);
  await expect(comparison.locator('.part-name').first()).toHaveAttribute('aria-hidden', 'true');
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  // a wide window keeps the table with its column headers and no name in the cells
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(comparison.locator('.part-name:visible')).toHaveCount(0);
  await expect(cells.nth(1)).toHaveText('X-2', { useInnerText: true });
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// A code broke after its hyphen („BT-“ / „112“, „BR-S-“ / „08“) and a rate or a margin number at its
// space („19“ / „%“, „Rn.“ / „6a“): measured over the lines of every match on wide and narrow
// screens (audit R3-U-10). Now the codes stand in spans that do not wrap, and „%“ and „Rn.“ have a
// no-break space before their number.
test('keeps codes, rates and margin numbers on one line, also on a phone', async ({ page }) => {
  const problems = await openApp(page);
  const sample = (name: string) =>
    new Uint8Array(readFileSync(join(import.meta.dirname, '../../beispiele', name)));
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  const files = [
    {
      name: '07.xml',
      bytes: sample('07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml'),
      mime: 'application/xml',
    },
    { name: '29.xml', bytes: sample('29_XRechnung_mit_Formatfehler.xml'), mime: 'application/xml' },
    { name: '30.xml', bytes: sample('30_XRechnung_mit_Rechenfehler.xml'), mime: 'application/xml' },
    {
      name: 'zwei.pdf',
      bytes: miniPdf({
        attachments: [xml('a.xml', cii), xml('b.xml', withInvoiceNumber(cii, 'X-2'))],
      }),
      mime: 'application/pdf',
    },
  ];
  const broken: string[] = [];
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const file of files) {
      await upload(page, file.name, file.bytes, file.mime);
      broken.push(...(await brokenCodes(page)).map((code) => `${width} px, ${file.name}: ${code}`));
    }
  }
  expect(broken).toEqual([]);
  // the codes stay what they are: the browser's search for „BT-112“ finds them
  await expect(page.getByText('BT-112').first()).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
