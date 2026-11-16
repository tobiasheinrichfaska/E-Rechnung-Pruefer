import { expect, test } from '@playwright/test';
import { encode, official, officialText } from '../support/fixtures';
import { openApp, sideEffects, upload } from './helpers';

test('shows every Pflichtangabe of a complete invoice with its values', async ({ page }) => {
  const problems = await openApp(page);
  await upload(page, 'cen-beispiel-2.xml', official('cen/CII_example2.xml'), 'application/xml');

  await expect(
    page.getByRole('heading', { name: 'Pflichtangaben nach § 14 Abs. 4 UStG' }),
  ).toBeVisible();
  await expect(page.getByTestId('pflicht-summary')).toHaveText(
    'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
  );
  const number = page.getByTestId('pflicht-rechnungsnummer');
  await expect(number.getByTestId('status')).toHaveText('vorhanden');
  await expect(number).toContainText('§ 14 Abs. 4 Satz 1 Nr. 4 UStG');

  // positions open on demand
  const positions = page.getByTestId('pflicht-menge-art').locator('details');
  await expect(positions.locator('ol')).toBeHidden();
  await positions.locator('summary').click();
  await expect(positions.locator('ol li').first()).toBeVisible();

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('names what is missing, with the missing parts, and shows hints', async ({ page }) => {
  const problems = await openApp(page);
  // KoSIT test file: seller and buyer address without street (postcode + city: enough, with a
  // hint – F10), tax representative with a country only (missing)
  await upload(
    page,
    '01.14a.xml',
    official('kosit/paare/01.14a-INVOICE_ubl.xml'),
    'application/xml',
  );

  await expect(page.getByTestId('pflicht-summary')).toHaveText(
    'Es fehlt: Fiskalvertreter: Name, Anschrift und USt-IdNr. (davon fehlen: Ort; Postleitzahl oder Straße/Postfach).',
  );
  const address = page.getByTestId('pflicht-anschrift-leistender');
  await expect(address.getByTestId('status')).toHaveText('vorhanden');
  // QU-05: a hint says so in words, not by its colour alone, and keeps a frame in a forced-colours
  // theme (a transparent border, as the badges have)
  const hint = address.getByTestId('row-hint');
  await expect(hint).toHaveText(/^Hinweis: Ohne Straße oder Postfach/);
  expect(await hint.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('solid');
  await expect(page.getByRole('heading', { name: /Angaben in besonderen Fällen/ })).toBeVisible();
  const representative = page.getByTestId('pflicht-fiskalvertreter');
  await expect(representative.getByTestId('status')).toHaveText('fehlt');
  await expect(representative).toContainText('Es fehlt: Ort; Postleitzahl oder Straße/Postfach.');

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('applies the reduced list of a Kleinbetragsrechnung', async ({ page }) => {
  const problems = await openApp(page);
  await upload(
    page,
    '01.02a.xml',
    official('kosit/paare/01.02a-INVOICE_ubl.xml'),
    'application/xml',
  );

  await expect(page.locator('.pflicht .mode')).toContainText('§ 33 UStDV');
  await expect(page.getByTestId('pflicht-summe').getByTestId('status')).toHaveText('vorhanden');

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// QU-05/R2-U-06: every row hint starts with „Hinweis:“, the word the box and the summary use —
// also the credit-note hint, which once brought „Mögliche Auffälligkeit:“ of its own
test('puts „Hinweis:“ in front of the credit-note hint, as in front of every hint', async ({
  page,
}) => {
  const problems = await openApp(page);
  // as sample 09: a credit note (381) called „Gutschrift“ in a note
  const text = officialText('kosit/paare/01.06a-INVOICE_uncefact.xml')
    .replace('<ram:TypeCode>380</ram:TypeCode>', '<ram:TypeCode>381</ram:TypeCode>')
    .replace(
      '    </rsm:ExchangedDocument>',
      '        <ram:IncludedNote>\n            <ram:Content>Gutschrift zur Rechnung R123456788</ram:Content>\n        </ram:IncludedNote>\n    </rsm:ExchangedDocument>',
    );
  await upload(page, 'korrektur.xml', encode(text), 'application/xml');
  const hint = page.getByTestId('pflicht-gutschrift').getByTestId('row-hint');
  await expect(hint).toHaveText(/^Hinweis: In einer Bemerkung steht „Gutschrift“/);
  await expect(hint).not.toContainText('Mögliche Auffälligkeit');
  await expect(hint.locator('strong')).toHaveText('Hinweis:');

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
