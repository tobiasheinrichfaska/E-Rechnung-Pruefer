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
  await expect(status).toHaveText('Ergebnis: E-Rechnung erkannt (XRechnung 3.0).');
  expect(await page.locator('[aria-live]').count()).toBe(0);
  await expect(page.getByTestId('headline')).toBeFocused();

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

test('names the Pflichtangaben of several invoice XML apart', async ({ page }) => {
  const problems = await openApp(page);
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, text: string) => ({ name, bytes: encode(text), mime: 'text/xml' });
  await upload(
    page,
    'zwei.pdf',
    miniPdf({ attachments: [xml('a.xml', cii), xml('b.xml', withInvoiceNumber(cii, 'X-2'))] }),
    'application/pdf',
  );
  await expect(
    page.getByRole('region', { name: /^Rechnungsdaten 1 von 2 – Anhang „a\.xml“ Pflichtangaben/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: /^Rechnungsdaten 2 von 2 – Anhang „b\.xml“ Pflichtangaben/ }),
  ).toHaveCount(1);
  // The calculation sections and the tables too (audit Bedienung, Z-03: axe landmark-unique)
  for (const n of [1, 2]) {
    await expect(
      page.getByRole('region', { name: new RegExp(`^Rechnungsdaten ${n} von 2 .* Rechnerische`) }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('table', { name: new RegExp(`^Rechnungsdaten ${n} von 2 .* Pflichtangaben`) }),
    ).toHaveCount(1);
  }

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
