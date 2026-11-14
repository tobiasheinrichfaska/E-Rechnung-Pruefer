import { expect, test } from '@playwright/test';
import { encode, official, officialText, withInvoiceNumber, withSpecId } from '../support/fixtures';
import { compressedPdf } from '../../src/build/compressedPdf';
import { miniPdf } from '../../src/build/minipdf';
import { openApp, sideEffects, upload } from './helpers';

const CII = officialText('cen/CII_example1.xml');

test('the spy notices storage and cookie access (so an empty list means something)', async ({
  page,
}) => {
  const problems = await openApp(page);
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('probe', '1');
      window.localStorage.removeItem('probe');
      // named access passes no Storage method: found by what is left afterwards
      (window.localStorage as unknown as Record<string, string>)['named'] = '1';
    } catch {
      // file:// may refuse storage — the attempt is still recorded
    }
    void document.cookie;
    new BroadcastChannel('probe').close();
    window.open('about:blank');
  });
  const seen = await sideEffects(page);
  const expected = ['storage.setItem', 'cookie.get', 'BroadcastChannel', 'window.open'];
  if (await page.evaluate(() => window.localStorage.length > 0)) expected.push('left:localStorage');
  expect(seen).toEqual(expect.arrayContaining(expected));
  await expect.poll(() => problems.some((p) => p.startsWith('popup:'))).toBe(true);
  await page.evaluate(() => window.localStorage.clear());
});

test('shows the page with the fixed notice and a CSP', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.getByRole('heading', { name: 'E-Rechnung prüfen' })).toBeVisible();
  await expect(page.getByTestId('fixed-notice')).toContainText('keine steuerliche Prüfung');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('recognises an XML e-invoice, a hybrid PDF and a plain PDF without storing or sending anything', async ({
  page,
}) => {
  const problems = await openApp(page);

  await expect(page.getByTestId('fixed-notice')).not.toContainText('Maßgeblich');
  await upload(page, 'rechnung.xml', official('cen/CII_example1.xml'), 'application/xml');
  await expect(page.getByTestId('headline')).toHaveText(/^E-Rechnung erkannt \(EN 16931/);
  await expect(page.getByTestId('fixed-notice')).toContainText(
    'Maßgeblich sind die Daten in der XML',
  );
  await expect(page.getByRole('row', { name: /Syntax/ })).toContainText('UN/CEFACT CII');

  const hybrid = miniPdf({
    text: 'Rechnung',
    attachments: [
      { name: 'factur-x.xml', bytes: encode(CII), mime: 'text/xml', relationship: 'Alternative' },
    ],
  });
  await upload(page, 'hybrid.pdf', hybrid, 'application/pdf');
  await expect(page.getByTestId('verdict')).toContainText('Anhang „factur-x.xml“');
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-ok/);

  await upload(page, 'scan.pdf', miniPdf({ text: 'Rechnung' }), 'application/pdf');
  await expect(page.getByTestId('headline')).toHaveText('Keine E-Rechnung: einfaches PDF');

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('names MINIMUM, contradicting invoice data and a protected PDF', async ({ page }) => {
  const problems = await openApp(page);
  const xml = (name: string, text: string) => ({ name, bytes: encode(text), mime: 'text/xml' });

  await upload(
    page,
    'minimum.pdf',
    miniPdf({ attachments: [xml('factur-x.xml', withSpecId(CII, 'urn:factur-x.eu:1p0:minimum'))] }),
    'application/pdf',
  );
  await expect(page.getByTestId('headline')).toHaveText(
    'PDF mit Rechnungsdaten, Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
  );
  // F19: no Pflichtangaben from the XML and no "Maßgeblich ist die XML" for "keine E-Rechnung"
  await expect(page.getByTestId('no-pflicht')).toBeVisible();
  await expect(page.getByTestId('pflicht-summary')).toHaveCount(0);
  await expect(page.getByTestId('fixed-notice')).not.toContainText('Maßgeblich');

  await upload(
    page,
    'zwei.pdf',
    miniPdf({ attachments: [xml('a.xml', CII), xml('b.xml', withInvoiceNumber(CII, 'X-2'))] }),
    'application/pdf',
  );
  await expect(page.getByTestId('headline')).toHaveText(
    'Mögliche Auffälligkeit: widersprüchliche Rechnungsdaten im PDF',
  );
  await expect(page.getByTestId('differing')).toContainText('Rechnungsnummer');
  await expect(page.getByText('Rechnungsdaten 2 von 2')).toBeVisible();

  await upload(page, 'geschuetzt.pdf', miniPdf({ passwordProtected: true }), 'application/pdf');
  await expect(page.getByTestId('headline')).toHaveText('Das PDF ist mit einem Kennwort geschützt');

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Older browsers (e.g. Chrome/Edge 109 on Windows 7/8.1, Safari 16.4–18.3 on older Macs and
// iPhones) lack these JS features; the modern pdf.js build failed on every PDF there (audit
// 2026-11-14, S-01). The app ships the legacy build plus Promise.withResolvers.
const NEWER_JS = [
  'globalThis.Iterator',
  'Promise.try',
  'Promise.withResolvers',
  'Uint8Array.prototype.toHex',
  'Uint8Array.prototype.toBase64',
  'Uint8Array.fromBase64',
  'Uint8Array.fromHex',
  'Math.sumPrecise',
  'Map.prototype.getOrInsert',
  'Map.prototype.getOrInsertComputed',
  'globalThis.Float16Array',
  'Set.prototype.union',
  'Set.prototype.intersection',
  'Set.prototype.difference',
  'Object.groupBy',
  'Map.groupBy',
  'URL.parse',
  'URL.canParse',
  'ArrayBuffer.prototype.transfer',
  'Array.fromAsync',
];

test('reads a hybrid PDF built like real Factur-X files (compressed streams)', async ({ page }) => {
  const problems = await openApp(page);
  await upload(page, 'echt.pdf', compressedPdf(encode(CII), 'factur-x.xml'), 'application/pdf');
  await expect(page.getByTestId('headline')).toHaveText(/^E-Rechnung erkannt \(EN 16931/);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('reads a hybrid PDF in a browser without the newest JS features', async ({ page }) => {
  await page.addInitScript({
    content: NEWER_JS.map((path) => `try { delete ${path}; } catch {}`).join('\n'),
  });
  const problems = await openApp(page);
  expect(
    await page.evaluate(() => typeof (Promise as unknown as Record<string, unknown>)['try']),
  ).toBe('undefined');
  const hybrid = miniPdf({
    attachments: [{ name: 'factur-x.xml', bytes: encode(CII), mime: 'text/xml' }],
  });
  await upload(page, 'alt.pdf', hybrid, 'application/pdf');
  await expect(page.getByTestId('headline')).toHaveText(/^E-Rechnung erkannt \(EN 16931/);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('takes a dropped file', async ({ page }) => {
  const problems = await openApp(page);
  const bytes = [...official('kosit/01.01a-INVOICE_ubl.xml')];
  const transfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], 'xrechnung.xml', { type: 'application/xml' }));
    return dt;
  }, bytes);
  await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByTestId('headline')).toHaveText('E-Rechnung erkannt (XRechnung 3.0)');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Dropped next to the drop zone, the browser would open the file instead of the app (U-05)
test('takes a file dropped anywhere on the page', async ({ page }) => {
  const problems = await openApp(page);
  const bytes = [...official('kosit/01.01a-INVOICE_ubl.xml')];
  const transfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], 'daneben.xml', { type: 'application/xml' }));
    return dt;
  }, bytes);
  // The page-wide listener is attached right after the first render (useEffect); a real drag
  // never comes that early, so wait for it instead of racing it (seen in WebKit, 2026-11-14)
  const prevented = () =>
    page.evaluate((dt) => {
      const event = new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('h1')?.dispatchEvent(event);
      return event.defaultPrevented;
    }, transfer);
  await expect.poll(prevented).toBe(true);
  await page.locator('h1').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByTestId('headline')).toHaveText('E-Rechnung erkannt (XRechnung 3.0)');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Step 2b: a well-formed XRechnung that breaks the official schema (amount with a comma)
test('reports a schema problem with its line and lists the technical messages', async ({
  page,
}) => {
  const problems = await openApp(page);
  const text = officialText('kosit/01.01a-INVOICE_ubl.xml').replace(
    '<cbc:PayableAmount currencyID="EUR">336.9</cbc:PayableAmount>',
    '<cbc:PayableAmount currencyID="EUR">336,90</cbc:PayableAmount>',
  );
  await upload(page, 'komma.xml', encode(text), 'application/xml');
  await expect(page.getByTestId('headline')).toHaveText(
    'Rechnungsdaten mit Formatfehler (XRechnung 3.0)',
  );
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-bad/);
  await expect(page.getByTestId('verdict')).toContainText(
    'Formatfehler, gem. Rn. 6a ggf. keine E-Rechnung.',
  );
  await expect(page.getByRole('row', { name: /Schema \(XSD\)/ })).toContainText(
    'Abweichungen vom Schema UBL 2.1 (Invoice): ',
  );
  const list = page.getByTestId('schema-problems');
  await list.locator('summary').click();
  await expect(list.locator('li').first()).toContainText('336,90');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Step 3a: a total that does not add up — a hint with the rule ids and the values that show it
test('names a calculation irregularity with its rule and values', async ({ page }) => {
  const problems = await openApp(page);
  const text = officialText('kosit/01.01a-INVOICE_ubl.xml').replace(
    '<cbc:TaxInclusiveAmount currencyID="EUR">336.9</cbc:TaxInclusiveAmount>',
    '<cbc:TaxInclusiveAmount currencyID="EUR">346.9</cbc:TaxInclusiveAmount>',
  );
  await upload(page, 'summe.xml', encode(text), 'application/xml');
  await expect(page.getByTestId('headline')).toHaveText('E-Rechnung erkannt (XRechnung 3.0)');
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-warn/);
  await expect(page.getByTestId('rules-summary')).toHaveText(
    'Mögliche Auffälligkeit: BR-CO-15, BR-CO-16. Bitte prüfen Sie die Beträge.',
  );
  const rule = page.getByTestId('rule-BR-CO-15');
  await expect(rule).toContainText('mögliche Auffälligkeit');
  await expect(rule).toContainText('BT-112: 346,90 EUR');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
