import { expect, test } from '@playwright/test';
import { encode, officialText, withInvoiceNumber } from '../support/fixtures';
import { miniPdf } from '../../src/build/minipdf';
import { official } from '../support/fixtures';
import { openApp, sideEffects, upload } from './helpers';

// Screen readers (audit 2026-11-14, U-04, U-13): a status line that exists before the result and
// only gets a short sentence, the focus on the result, row and column headers, named tables.

test('announces the result in one short sentence and moves the focus to it', async ({ page }) => {
  const problems = await openApp(page);
  const status = page.getByRole('status');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText('');

  await upload(page, 'x.xml', official('kosit/01.01a-INVOICE_ubl.xml'), 'application/xml');
  // G-3: a yellow result says so in the announcement too
  await expect(status).toHaveText('Ergebnis: E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen.');
  expect(await page.locator('[aria-live]').count()).toBe(0);
  await expect(page.getByTestId('headline')).toBeFocused();
  // QU-13: from the box a heading leads to the invoice data, and their table is named
  await expect(
    page.getByRole('heading', { level: 3, name: 'Rechnungsdaten', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Rechnungsdaten', exact: true })).toHaveCount(1);

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('gives every Pflichtangabe a row header and keeps the column headers on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const problems = await openApp(page);
  await upload(page, 'x.xml', official('kosit/paare/01.14a-INVOICE_ubl.xml'), 'application/xml');

  const table = page.getByRole('table', { name: 'Pflichtangaben nach § 14 Abs. 4 UStG' });
  await expect(table.getByRole('rowheader', { name: /Rechnungsnummer/ })).toHaveCount(1);
  // hidden for the eye only: still column headers for a screen reader
  await expect(table.getByRole('columnheader', { name: 'Status' })).toHaveCount(1);
  await expect(page.getByRole('table', { name: /Angaben in besonderen Fällen/ })).toHaveCount(1);

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// F27/G-8: with several invoice XML each name stays unique — the same data is shown once (one
// section of each kind), different data only as a named comparison table (audit Bedienung, Z-03)
test('keeps the names of sections and tables unique with several invoice XML', async ({ page }) => {
  const problems = await openApp(page);
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, text: string) => ({ name, bytes: encode(text), mime: 'text/xml' });

  await upload(
    page,
    'gleich.pdf',
    miniPdf({ attachments: [xml('a.xml', cii), xml('b.xml', cii)] }),
    'application/pdf',
  );
  await expect(page.getByRole('region', { name: /^Pflichtangaben/ })).toHaveCount(1);
  await expect(page.getByRole('region', { name: /^Rechnerische Prüfung/ })).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: /gleich in „a\.xml“ und „b\.xml“/ }),
  ).toBeVisible();
  // QU-13: the same data twice keep their one heading, which names the table
  await expect(
    page.getByRole('table', { name: /^Rechnungsdaten \(gleich in „a\.xml“ und „b\.xml“\)$/ }),
  ).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Rechnungsdaten', exact: true })).toHaveCount(0);

  await upload(
    page,
    'zwei.pdf',
    miniPdf({ attachments: [xml('a.xml', cii), xml('b.xml', withInvoiceNumber(cii, 'X-2'))] }),
    'application/pdf',
  );
  await expect(page.getByRole('region', { name: /^Pflichtangaben/ })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Vergleich der Rechnungsdaten' })).toHaveCount(1);
  // R6-U-04: a differing row is named so, not only by its colour
  const comparison = page.getByTestId('comparison');
  await expect(
    comparison.getByRole('rowheader', {
      name: 'Unterschiedlich: Rechnungsnummer (BT-1)',
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    comparison.getByRole('rowheader', { name: 'Rechnungsdatum (BT-2)', exact: true }),
  ).toHaveCount(1);
  await expect(comparison.getByRole('rowheader', { name: /^Unterschiedlich: / })).toHaveCount(
    await comparison.locator('tbody.differs').count(),
  );

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
