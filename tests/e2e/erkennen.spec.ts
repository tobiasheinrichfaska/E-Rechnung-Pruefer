import { expect, test } from '@playwright/test';
import { encode, official, officialText, withInvoiceNumber, withSpecId } from '../support/fixtures';
import { compressedPdf } from '../../src/build/compressedPdf';
import { miniPdf } from '../../src/build/minipdf';
import { openApp, sideEffects, upload } from './helpers';

const CII = officialText('cen/CII_example1.xml');

test('the spy notices every way it records: storage, cookies, IndexedDB, beacons, WebRTC, workers, popups, CSP violations (so an empty list means something)', async ({
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
    // every other way the spy records, once each (audit 2026-11-15, QT-15); the CSP refuses most of
    // them, which is no reason not to record the attempt
    const w = window as unknown as Record<string, unknown>;
    const attempt = (action: () => unknown) => {
      try {
        void Promise.resolve(action()).catch(() => undefined);
      } catch {
        // refused at once — the attempt is still recorded
      }
    };
    attempt(() => navigator.sendBeacon('https://example.invalid/beacon', 'x'));
    attempt(() => indexedDB.open('probe'));
    document.cookie = 'probe=1';
    attempt(() => (w['cookieStore'] as { get: (name: string) => Promise<unknown> }).get('probe'));
    attempt(() => new RTCPeerConnection().close());
    attempt(() => new Worker('data:text/javascript,'));
    attempt(() => new (w['SharedWorker'] as new (url: string) => object)('data:text/javascript,'));
    // an image from outside: a CSP violation (img-src), reported by its event
    const image = document.createElement('img');
    image.src = 'https://example.invalid/probe.png';
    document.body.append(image);
  });
  const expected = [
    'storage.setItem:probe',
    'cookie.get',
    'BroadcastChannel',
    'window.open',
    'sendBeacon',
    'indexedDB.open',
    'cookie.set',
    'cookieStore.get',
    'RTCPeerConnection',
    'Worker',
    'SharedWorker',
  ];
  if (await page.evaluate(() => window.localStorage.length > 0)) expected.push('left:localStorage');
  await expect
    .poll(() => sideEffects(page))
    .toEqual(
      expect.arrayContaining([...expected, expect.stringMatching(/^csp:img-src:https:\/\//)]),
    );
  await expect.poll(() => problems.some((p) => p.startsWith('popup:'))).toBe(true);
  await page.evaluate(() => window.localStorage.clear());
});

test('shows the page with the fixed notice, a CSP and no search-engine indexing', async ({
  page,
}) => {
  const problems = await openApp(page);
  await expect(page.getByRole('heading', { name: 'E-Rechnung prüfen' })).toBeVisible();
  await expect(page.getByTestId('fixed-notice')).toContainText('keine steuerliche Prüfung');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  // not found through search engines: clients come by the Kanzlei's link (Tobias 2026-11-15)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
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
  // G-6: "Maßgeblich … XML" only for a PDF — an XML file has no picture to compare with
  await expect(page.getByTestId('fixed-notice')).not.toContainText('Maßgeblich');
  // G-2: the technical rows are closed under "Technische Angaben"
  await expect(page.getByRole('row', { name: /Syntax/ })).toBeHidden();
  await page.getByTestId('technical-details').locator('summary').click();
  await expect(page.getByRole('row', { name: /Syntax/ })).toContainText('UN/CEFACT CII');

  const hybrid = miniPdf({
    text: 'Rechnung',
    attachments: [
      // CEN example 2: complete Pflichtangaben, no hints — green (F22)
      {
        name: 'factur-x.xml',
        bytes: official('cen/CII_example2.xml'),
        mime: 'text/xml',
        relationship: 'Alternative',
      },
    ],
  });
  await upload(page, 'hybrid.pdf', hybrid, 'application/pdf');
  await expect(page.getByTestId('verdict')).toContainText('Anhang „factur-x.xml“');
  await expect(page.getByTestId('fixed-notice')).toContainText(
    'Maßgeblich sind die Daten in der XML',
  );
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
    'Rechnungsdaten mit Formatfehler: mehrere Rechnungs-XML im PDF',
  );
  // the values of both parts, without scrolling to them (audit Bedienung, E-04)
  await expect(page.getByTestId('differing')).toHaveText(
    /^Unterschiedlich: Rechnungsnummer \(.+ \/ X-2\)\.$/,
  );
  // F27/G-8: no full parts, the compared values side by side, the differing one marked
  const comparison = page.getByRole('table', { name: 'Vergleich der Rechnungsdaten' });
  await expect(comparison.getByRole('columnheader', { name: 'b.xml' })).toBeVisible();
  await expect(comparison.locator('tr.differs')).toHaveCount(1);
  await expect(comparison.locator('tr.differs')).toContainText('X-2');
  await expect(page.getByTestId('pflicht-summary')).toHaveCount(0);

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
  await expect(page.getByTestId('headline')).toHaveText(
    'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
  );
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
  await expect(page.getByTestId('headline')).toHaveText(
    'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
  );
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
    'Die Datei hat einen Formatfehler. Sie ist deshalb möglicherweise keine E-Rechnung (BMF-Schreiben vom 15.10.2025, Rn. 6a).',
  );
  await expect(page.getByRole('row', { name: /Schema \(XSD\)/ })).toContainText(
    'Abweichungen vom Schema UBL 2.1 (Invoice): ',
  );
  const list = page.getByTestId('schema-problems');
  await expect(list).not.toHaveAttribute('open');
  // QU-11: the jump link opens the closed messages it leads to — no second click
  await page.getByTestId('jump-links').getByRole('link', { name: 'Technische Meldungen' }).click();
  await expect(page).toHaveURL(/#technische-meldungen$/);
  await expect(list).toHaveAttribute('open', '');
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
  await expect(page.getByTestId('headline')).toHaveText(
    'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
  );
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-warn/);
  await expect(page.getByTestId('rules-summary')).toHaveText(
    'Mögliche Auffälligkeit: BR-CO-15, BR-CO-16.',
  );
  // F23: only the gross and due amount — ask before paying
  await expect(page.locator('.rule-advice')).toHaveText([
    'Sie könnten vor der Zahlung mit dem Lieferanten klären, welcher Betrag richtig ist.',
  ]);
  const rule = page.getByTestId('rule-BR-CO-15');
  await expect(rule).toContainText('mögliche Auffälligkeit');
  await expect(rule).toContainText('Gesamtbetrag mit Umsatzsteuer (BT-112): 346,90 EUR');
  await expect(rule).toContainText('Nach der Regel erwartet: 336,90 EUR');
  // QU-11: the fold-out names what it holds; open, it does not keep saying "anzeigen"
  await expect(page.locator('.rules-all summary')).toHaveText(/^Weitere geprüfte Regeln \(\d+\)$/);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// F29: Factur-X EXTENDED is checked by the FeRD rules (BR-FXEXT-…) and BR-CO-14, with a note
test('checks Factur-X EXTENDED by the calculation rules of FeRD', async ({ page }) => {
  const problems = await openApp(page);
  const extended = withSpecId(
    CII,
    'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
  );
  await upload(page, 'extended.xml', encode(extended), 'application/xml');
  await expect(page.getByTestId('headline')).toHaveText(/Profil EXTENDED/);
  await expect(page.getByTestId('rules-note')).toHaveText(
    'Für das Profil EXTENDED gelten die Rechenregeln von FeRD (Factur-X 1.09.2): Logistikkosten zählen als Zuschläge, Gruppen- und Infozeilen zählen nicht mit, kleine Abweichungen je Betrag sind erlaubt.',
  );
  await page.locator('.rules-all summary').click();
  await expect(page.getByTestId('rule-BR-FXEXT-CO-10')).toBeVisible();
  await expect(page.getByTestId('rule-BR-CO-14')).toBeVisible();
  await expect(
    page.locator('[data-testid^="rule-BR-CO-1"]:not([data-testid="rule-BR-CO-14"])'),
  ).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
